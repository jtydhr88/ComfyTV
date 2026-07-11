import { computed, ref, watch } from 'vue'

import { i18n } from '@/i18n'
import type { LGraphNode } from '@/lib/comfyApp'
import { app } from '@/lib/comfyApp'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import {
  bindWidgetCallback,
  onNodeConfigure,
  readWidgetNum,
  readWidgetStr,
  writeWidget
} from '@/utils/widget'
import { uploadBlobNamed } from '@/utils/uploadCanvas'
import type {
  TimelineDurationChange,
  TimelineTimeUpdate
} from '@/widgets/three/load3d/TimelineController'
import { isMeshModelUrl } from '@/widgets/three/modelFormats'
import { fetchCameraPresetManifest } from '@/widgets/three/load3d/cameraPresetAssets'
import type { CameraPresetManifestEntry } from '@/widgets/three/load3d/cameraPresetAssets'
import type { CameraPresetTuning } from '@/widgets/three/load3d/interfaces'
import type {
  Scene3dGizmoMode,
  Scene3dViewport
} from '@/widgets/three/scene3d/Scene3dViewport'
import { createScene3dViewport } from '@/widgets/three/scene3d/createScene3dViewport'
import { captureSceneImages } from '@/widgets/three/scene3d/capture/SceneImageCapture'
import {
  SceneVideoRecorder,
  isVideoRecordingSupported,
  type RecordProgress
} from '@/widgets/three/scene3d/capture/SceneVideoRecorder'
import type { SceneChannel } from '@/widgets/three/scene3d/capture/channelRender'
import {
  CAMERA_COLORS,
  TRACK_COLORS,
  type TimelineTracksData
} from '@/widgets/three/scene3d/timelineTracks'
import { SCENE_CHANNELS } from '@/widgets/three/scene3d/capture/channelRender'
import type { LightPresetName } from '@/widgets/three/scene3d/lightPresets'
import { createLightPreset } from '@/widgets/three/scene3d/lightPresets'
import { useAssetStore } from '@/stores/assetStore'
import type { Asset } from '@/api/schemas'
import {
  fetchScene3dManifest,
  getCharacterClipNames,
  getCustomModelClipNames
} from '@/widgets/three/scene3d/scene3dAssets'
import type { Scene3dCharacterManifestEntry } from '@/widgets/three/scene3d/scene3dAssets'
import { normalizeSceneValue } from '@/widgets/three/scene3d/sceneValue'
import type {
  CharacterAnimationConfig,
  CharacterTransform,
  PrimitiveShape,
  Scene3DState,
  SceneCameraEntry,
  SceneCharacterEntry,
  SceneEnvironmentConfig,
  SceneLightEntry,
  SceneLightType,
  SceneModelEntry,
  ScenePrimitiveEntry
} from '@/widgets/three/scene3d/types'
import {
  cloneScene,
  createDefaultCamera,
  createDefaultCharacter,
  createDefaultLight,
  createDefaultModel,
  createDefaultPrimitive
} from '@/widgets/three/scene3d/types'

const SCENE_WIDGET = 'scene_state'
const CHANNEL_WIDGET = 'channel'
const WIDTH_WIDGET = 'width'
const HEIGHT_WIDGET = 'height'
const IMAGE_WIDGET = 'captured_image'
const IMAGES_WIDGET = 'captured_images'
const VIDEO_WIDGET = 'captured_video'
const PROP_KEY = 'comfytv_scene3d_editor'

interface EditorProps {
  selectedId?: string | null
  pipCameraId?: string | null
  gizmoMode?: Scene3dGizmoMode
  timelinePlaying?: boolean
}

export interface UseScene3dStageOptions {
  onCaptured?: (url: string) => void
  onRecorded?: (url: string) => void
}

function toastError(detail: string): void {
  ;(app as any)?.extensionManager?.toast?.add?.({
    severity: 'error',
    summary: 'ComfyTV',
    detail,
    life: 5000
  })
}

export function useScene3dStage(
  node: LGraphNode,
  opts?: UseScene3dStageOptions
) {
  const t = i18n.global.t
  const assetStore = useAssetStore()
  let viewport: Scene3dViewport | null = null

  const state = ref<Scene3DState>(
    normalizeSceneValue(readWidgetStr(node, SCENE_WIDGET, '{}'))
  )
  const selectedId = ref<string | null>(null)
  const availableModels = ref<Scene3dCharacterManifestEntry[]>([])
  const clipNamesForSelected = ref<string[]>([])
  const gizmoMode = ref<Scene3dGizmoMode>('none')

  const cameraPresets = ref<CameraPresetManifestEntry[]>([])
  const lookThroughId = ref<string | null>(null)
  const pipCameraId = ref<string | null>(null)
  const timelinePlaying = ref(false)
  const timelineFrame = ref(0)
  const timelineLoop = ref(true)
  const timelineDataVersion = ref(0)

  const outputWidth = ref(readWidgetNum(node, WIDTH_WIDGET, 1024))
  const outputHeight = ref(readWidgetNum(node, HEIGHT_WIDGET, 1024))
  const channel = ref<SceneChannel>(readChannelWidget())
  const capturing = ref(false)
  const recording = ref(false)
  const recordProgress = ref<RecordProgress | null>(null)
  const capturedImageUrl = ref(readWidgetStr(node, IMAGE_WIDGET, ''))
  const capturedVideoUrl = ref(readWidgetStr(node, VIDEO_WIDGET, ''))
  const recordingSupported = isVideoRecordingSupported()

  function readChannelWidget(): SceneChannel {
    const raw = readWidgetStr(node, CHANNEL_WIDGET, 'color')
    return (SCENE_CHANNELS as readonly string[]).includes(raw)
      ? (raw as SceneChannel)
      : 'color'
  }

  const selectedCharacter = computed<SceneCharacterEntry | null>(
    () =>
      state.value.characters.find(
        (character) => character.id === selectedId.value
      ) ?? null
  )
  const selectedPrimitive = computed<ScenePrimitiveEntry | null>(
    () =>
      state.value.primitives.find(
        (primitive) => primitive.id === selectedId.value
      ) ?? null
  )
  const selectedLight = computed<SceneLightEntry | null>(
    () =>
      state.value.lights.find((light) => light.id === selectedId.value) ?? null
  )
  const selectedModel = computed<SceneModelEntry | null>(
    () =>
      state.value.models.find((model) => model.id === selectedId.value) ?? null
  )
  const modelAssets = computed(() =>
    assetStore.assets.filter(
      (asset) => asset.media_type === 'model' && isMeshModelUrl(asset.payload_url)
    )
  )
  const selectedCamera = computed<SceneCameraEntry | null>(
    () =>
      state.value.cameras.find((camera) => camera.id === selectedId.value) ??
      null
  )
  const outputCameraId = computed(() => state.value.output.cameraId)
  const hasRecordableDuration = computed(
    () =>
      state.value.output.frameCount > 0 ||
      state.value.cameras.some((camera) => camera.preset !== null) ||
      state.value.characters.length > 0 ||
      state.value.models.some((model) => model.animation.clip !== '')
  )

  function readEditorProps(): EditorProps {
    const stored = node?.properties?.[PROP_KEY]
    return stored && typeof stored === 'object' ? (stored as EditorProps) : {}
  }

  function writeEditorProps(patch: EditorProps): void {
    if (!node) return
    if (!node.properties) node.properties = {}
    node.properties[PROP_KEY] = { ...readEditorProps(), ...patch }
  }

  function firstSceneId(scene: Scene3DState): string | null {
    return (
      scene.characters[0]?.id ??
      scene.primitives[0]?.id ??
      scene.models[0]?.id ??
      scene.lights[0]?.id ??
      scene.cameras[0]?.id ??
      null
    )
  }

  function idExists(scene: Scene3DState, id: string | null): boolean {
    if (!id) return false
    return (
      scene.characters.some((entry) => entry.id === id) ||
      scene.primitives.some((entry) => entry.id === id) ||
      scene.models.some((entry) => entry.id === id) ||
      scene.lights.some((entry) => entry.id === id) ||
      scene.cameras.some((entry) => entry.id === id)
    )
  }

  function loadFromNode(): void {
    state.value = normalizeSceneValue(readWidgetStr(node, SCENE_WIDGET, '{}'))
    const props = readEditorProps()
    selectedId.value = idExists(state.value, props.selectedId ?? null)
      ? (props.selectedId as string)
      : firstSceneId(state.value)
    const pip = props.pipCameraId ?? null
    pipCameraId.value =
      pip && state.value.cameras.some((entry) => entry.id === pip) ? pip : null
    gizmoMode.value = props.gizmoMode ?? 'none'
    outputWidth.value = readWidgetNum(node, WIDTH_WIDGET, 1024)
    outputHeight.value = readWidgetNum(node, HEIGHT_WIDGET, 1024)
    channel.value = readChannelWidget()
    capturedImageUrl.value = readWidgetStr(node, IMAGE_WIDGET, '')
    capturedVideoUrl.value = readWidgetStr(node, VIDEO_WIDGET, '')
  }

  function pushStateToViewport(): void {
    if (!viewport) return
    viewport
      .applyState(cloneScene(state.value), selectedId.value)
      .then(() => {
        timelineDataVersion.value += 1
      })
      .catch((error) => {
        console.error('[ComfyTV/scene3d] applyState failed', error)
      })
  }

  function initScene(container: HTMLElement): void {
    try {
      container.setAttribute('data-capture-wheel', 'true')
      if (!container.hasAttribute('tabindex')) {
        container.setAttribute('tabindex', '-1')
      }
      container.style.outline = 'none'
      container.addEventListener('pointerenter', () => {
        container.focus?.({ preventScroll: true })
      })

      viewport = createScene3dViewport(
        container,
        {
          onTransformCommit: (id, transform) => commitTransform(id, transform),
          onSelectCharacter: (id) => selectObject(id),
          onLightChange: (id, patch) => patchLightById(id, patch),
          onCameraOffsetCommit: (id, offset) =>
            updateCameraTuning(id, { positionOffset: { ...offset } })
        },
        {
          getDimensions: () => ({
            width: outputWidth.value,
            height: outputHeight.value
          })
        }
      )
      wireViewportEvents(viewport)
      ;(
        container as HTMLElement & { __scene3dViewport?: Scene3dViewport }
      ).__scene3dViewport = viewport
      viewport.setGizmoMode(gizmoMode.value)
      viewport.setPreviewChannel(channel.value)
      viewport.setPipCamera(pipCameraId.value)
      viewport.setTimelinePlayIntent(readEditorProps().timelinePlaying ?? true)
      pushStateToViewport()
      wireNodeMouseStatus(node)
      assetStore.ensureHydrated()
      assetStore.installWebSocketSync()
      void loadManifests()
    } catch (error) {
      console.error('[ComfyTV/scene3d] failed to initialize viewport', error)
      toastError(t('scene3d.failedToInit'))
    }
  }

  function cleanup(): void {
    viewport?.remove()
    viewport = null
  }

  const handleMouseEnter = (): void => {
    viewport?.updateStatusMouseOnScene(true)
    viewport?.refreshViewport()
  }

  const handleMouseLeave = (): void => {
    viewport?.updateStatusMouseOnScene(false)
  }

  function wireNodeMouseStatus(target: LGraphNode): void {
    const host = target as LGraphNode & {
      onMouseEnter?: (...args: unknown[]) => void
      onMouseLeave?: (...args: unknown[]) => void
    }
    host.onMouseEnter = useChainCallback(host.onMouseEnter, () => {
      viewport?.updateStatusMouseOnNode(true)
      viewport?.refreshViewport()
    })
    host.onMouseLeave = useChainCallback(host.onMouseLeave, () => {
      viewport?.updateStatusMouseOnNode(false)
    })
  }

  async function loadManifests(): Promise<void> {
    availableModels.value = await fetchScene3dManifest()
    cameraPresets.value = await fetchCameraPresetManifest()
    await refreshClipNames()
  }

  async function refreshClipNames(): Promise<void> {
    const characterModel = selectedCharacter.value?.model
    const modelUrl = selectedModel.value?.url
    try {
      if (characterModel) {
        clipNamesForSelected.value = await getCharacterClipNames(characterModel)
      } else if (modelUrl) {
        clipNamesForSelected.value = await getCustomModelClipNames(modelUrl)
      } else {
        clipNamesForSelected.value = []
      }
    } catch {
      clipNamesForSelected.value = []
    }
  }

  watch(
    () => [selectedCharacter.value?.model, selectedModel.value?.url],
    () => void refreshClipNames()
  )


  function commit(next: Scene3DState): void {
    state.value = normalizeSceneValue(next)
    writeWidget(node, SCENE_WIDGET, JSON.stringify(state.value), {
      fireCallback: false
    })
    ensureLookThroughValid()
    ensurePipCameraValid()
    pushStateToViewport()
  }

  function ensureLookThroughValid(): void {
    if (
      lookThroughId.value &&
      !state.value.cameras.some((entry) => entry.id === lookThroughId.value)
    ) {
      setLookThrough(null)
    }
  }

  onNodeConfigure(node, () => {
    loadFromNode()
    setLookThrough(null)
    if (viewport) {
      viewport.setPipCamera(pipCameraId.value)
      viewport.setGizmoMode(gizmoMode.value)
      viewport.setPreviewChannel(channel.value)
      viewport.setTimelinePlayIntent(readEditorProps().timelinePlaying ?? true)
      viewport.refreshViewport()
      pushStateToViewport()
    }
  })

  bindWidgetCallback(node, SCENE_WIDGET, (value) => {
    if (!viewport) return
    state.value = normalizeSceneValue(value)
    if (!idExists(state.value, selectedId.value)) {
      selectedId.value = firstSceneId(state.value)
    }
    ensureLookThroughValid()
    ensurePipCameraValid()
    pushStateToViewport()
  })


  function selectObject(id: string | null): void {
    if (id && state.value.cameras.some((camera) => camera.id === id)) {
      setPipCamera(id)
    }
    if (selectedId.value === id) return
    selectedId.value = id
    writeEditorProps({ selectedId: id })
    viewport?.setSelected(id)
  }

  function setPipCamera(id: string | null): void {
    if (pipCameraId.value === id) return
    pipCameraId.value = id
    writeEditorProps({ pipCameraId: id })
    viewport?.setPipCamera(id)
  }

  function ensurePipCameraValid(): void {
    if (
      pipCameraId.value &&
      !state.value.cameras.some((entry) => entry.id === pipCameraId.value)
    ) {
      setPipCamera(null)
    }
  }

  async function addCharacter(model: string): Promise<void> {
    const character = createDefaultCharacter(model, allIds())
    try {
      const clipNames = await getCharacterClipNames(model)
      character.animation.clip = clipNames[0] ?? ''
    } catch {
      toastError(t('scene3d.failedToLoadAssets'))
      return
    }
    const next = cloneScene(state.value)
    next.characters.push(character)
    selectedId.value = character.id
    commit(next)
  }

  function addPrimitive(shape: PrimitiveShape): void {
    const primitive = createDefaultPrimitive(shape, allIds())
    const next = cloneScene(state.value)
    next.primitives.push(primitive)
    selectedId.value = primitive.id
    commit(next)
  }

  async function addModelFromAsset(asset: Asset): Promise<void> {
    const model = createDefaultModel(
      asset.payload_url,
      asset.name || 'model',
      allIds()
    )
    try {
      const clipNames = await getCustomModelClipNames(asset.payload_url)
      model.animation.clip = clipNames[0] ?? ''
    } catch (error) {
      console.error('[ComfyTV/scene3d] failed to load model asset', error)
      toastError(t('scene3d.failedToLoadModelAsset'))
      return
    }
    const next = cloneScene(state.value)
    next.models.push(model)
    selectedId.value = model.id
    commit(next)
  }

  function addLight(type: SceneLightType): void {
    const light = createDefaultLight(type, allIds())
    const next = cloneScene(state.value)
    next.lights.push(light)
    selectedId.value = light.id
    commit(next)
  }

  function applyLightPreset(name: LightPresetName): void {
    const next = cloneScene(state.value)
    next.lights = createLightPreset(name, [
      ...next.characters.map((entry) => entry.id),
      ...next.primitives.map((entry) => entry.id),
      ...next.models.map((entry) => entry.id),
      ...next.cameras.map((entry) => entry.id)
    ])
    if (state.value.lights.some((light) => light.id === selectedId.value)) {
      selectedId.value = next.lights[0]?.id ?? null
    }
    commit(next)
  }

  function removeSelected(): void {
    const id = selectedId.value
    if (!id) return
    const next = cloneScene(state.value)
    next.characters = next.characters.filter((entry) => entry.id !== id)
    next.primitives = next.primitives.filter((entry) => entry.id !== id)
    next.models = next.models.filter((entry) => entry.id !== id)
    next.lights = next.lights.filter((entry) => entry.id !== id)
    next.cameras = next.cameras.filter((entry) => entry.id !== id)
    if (next.output.cameraId === id) {
      next.output.cameraId = next.cameras[0]?.id ?? ''
    }
    selectedId.value = firstSceneId(next)
    commit(next)
  }

  function findLabelEntry(
    scene: Scene3DState,
    id: string
  ): { name?: string; hidden?: boolean } | undefined {
    return (
      scene.characters.find((entry) => entry.id === id) ??
      scene.primitives.find((entry) => entry.id === id) ??
      scene.models.find((entry) => entry.id === id) ??
      scene.lights.find((entry) => entry.id === id) ??
      scene.cameras.find((entry) => entry.id === id)
    )
  }

  function renameObject(id: string, name: string): void {
    const next = cloneScene(state.value)
    const entry = findLabelEntry(next, id)
    if (!entry) return
    entry.name = name.trim()
    commit(next)
  }

  function setObjectHidden(id: string, hidden: boolean): void {
    const next = cloneScene(state.value)
    const entry = findLabelEntry(next, id)
    if (!entry) return
    entry.hidden = hidden
    commit(next)
  }

  function toggleObjectHidden(id: string): void {
    setObjectHidden(id, !findLabelEntry(state.value, id)?.hidden)
  }

  function allIds(): string[] {
    return [
      ...state.value.characters.map((entry) => entry.id),
      ...state.value.primitives.map((entry) => entry.id),
      ...state.value.models.map((entry) => entry.id),
      ...state.value.lights.map((entry) => entry.id),
      ...state.value.cameras.map((entry) => entry.id)
    ]
  }


  function addCamera(): void {
    const camera = createDefaultCamera(allIds(), viewport?.getEditorCameraPose())
    const next = cloneScene(state.value)
    next.cameras.push(camera)
    if (!next.output.cameraId) next.output.cameraId = camera.id
    selectedId.value = camera.id
    commit(next)
    setPipCamera(camera.id)
    setLookThrough(camera.id)
  }

  function updateCameraById(
    id: string,
    mutate: (camera: SceneCameraEntry) => void
  ): void {
    const next = cloneScene(state.value)
    const camera = next.cameras.find((entry) => entry.id === id)
    if (!camera) return
    mutate(camera)
    commit(next)
  }

  function bindCameraPreset(id: string, presetId: string | null): void {
    if (!presetId) {
      updateCameraById(id, (camera) => {
        camera.preset = null
      })
      return
    }
    const entry = cameraPresets.value.find((preset) => preset.id === presetId)
    if (!entry) return
    updateCameraById(id, (camera) => {
      camera.preset = { presetId, file: entry.file, tuning: {}, speed: 1 }
    })
  }

  function updateCameraTuning(
    id: string,
    tuning: Partial<CameraPresetTuning>
  ): void {
    updateCameraById(id, (camera) => {
      if (!camera.preset) return
      camera.preset.tuning = { ...camera.preset.tuning, ...tuning }
    })
  }

  function setCameraFov(id: string, fov: number): void {
    if (!Number.isFinite(fov)) return
    updateCameraById(id, (camera) => {
      camera.fov = Math.min(Math.max(fov, 10), 140)
    })
  }

  function setOutputCamera(id: string): void {
    const next = cloneScene(state.value)
    next.output.cameraId = id
    commit(next)
  }

  function setLookThrough(id: string | null): void {
    if (lookThroughId.value === id) return
    lookThroughId.value = id
    viewport?.setLookThroughCamera(id)
  }

  function toggleLookThrough(id: string): void {
    setLookThrough(lookThroughId.value === id ? null : id)
  }

  function updateSelectedAnimation(
    patch: Partial<CharacterAnimationConfig>
  ): void {
    const id = selectedId.value
    if (!id) return
    updateCharacterAnimationById(id, patch)
  }

  function updateCharacterAnimationById(
    id: string,
    patch: Partial<CharacterAnimationConfig>
  ): void {
    const next = cloneScene(state.value)
    const target =
      next.characters.find((entry) => entry.id === id) ??
      next.models.find((entry) => entry.id === id)
    if (!target) return
    target.animation = { ...target.animation, ...patch }
    commit(next)
  }

  function buildTimelineData(): TimelineTracksData | null {
    if (!viewport) return null
    const fps = viewport.timelineController.getFps()
    const cameras = state.value.cameras.flatMap((entry, index) => {
      if (!entry.preset) return []
      const info = viewport!.sceneCameraManager.getPresetInfo(entry.id)
      if (!info) return []
      return [
        {
          id: entry.id,
          color: CAMERA_COLORS[index % CAMERA_COLORS.length],
          sourceFrames: Math.round((info.frameCount / info.fps) * fps),
          speed: entry.preset.speed
        }
      ]
    })
    const toTrack = (
      entry: { id: string; animation: CharacterAnimationConfig },
      sourceSeconds: number,
      index: number
    ) => {
      const speed = entry.animation.speed || 1
      return {
        id: entry.id,
        color: TRACK_COLORS[index % TRACK_COLORS.length],
        offsetFrames: Math.round(entry.animation.startOffset * fps),
        displayFrames: Math.max(1, Math.round((sourceSeconds / speed) * fps)),
        sourceFrames: Math.round(sourceSeconds * fps),
        loop: entry.animation.loop
      }
    }
    const characters = state.value.characters.map((entry, index) =>
      toTrack(entry, viewport!.characterManager.getClipDuration(entry.id), index)
    )
    const models = state.value.models.map((entry, index) =>
      toTrack(
        entry,
        viewport!.customModelManager.getClipDuration(entry.id),
        characters.length + index
      )
    )
    return { fps, cameras, characters: [...characters, ...models] }
  }

  function setCameraSpeedById(id: string, speed: number): void {
    updateCameraById(id, (camera) => {
      if (camera.preset) camera.preset.speed = speed
    })
  }

  function updateSelectedTransform(transform: CharacterTransform): void {
    const id = selectedId.value
    if (!id) return
    commitTransform(id, transform)
  }

  function updateSelectedPrimitive(
    patch: Partial<Pick<ScenePrimitiveEntry, 'color'>>
  ): void {
    const id = selectedId.value
    if (!id) return
    const next = cloneScene(state.value)
    const primitive = next.primitives.find((entry) => entry.id === id)
    if (!primitive) return
    Object.assign(primitive, patch)
    commit(next)
  }

  function updateSelectedLight(patch: Partial<SceneLightEntry>): void {
    const id = selectedId.value
    if (!id) return
    patchLightById(id, patch)
  }

  function patchLightById(id: string, patch: Partial<SceneLightEntry>): void {
    const next = cloneScene(state.value)
    const index = next.lights.findIndex((entry) => entry.id === id)
    if (index < 0) return
    next.lights[index] = { ...next.lights[index], ...patch, id }
    commit(next)
  }

  function updateEnvironment(patch: Partial<SceneEnvironmentConfig>): void {
    const next = cloneScene(state.value)
    next.environment = { ...next.environment, ...patch }
    commit(next)
  }

  function setGizmoMode(mode: Scene3dGizmoMode): void {
    gizmoMode.value = mode
    writeEditorProps({ gizmoMode: mode })
    viewport?.setGizmoMode(mode)
  }

  function commitTransform(id: string, transform: CharacterTransform): void {
    const next = cloneScene(state.value)
    const light = next.lights.find((entry) => entry.id === id)
    if (light) {
      light.position = { ...transform.position }
      commit(next)
      return
    }
    const camera = next.cameras.find((entry) => entry.id === id)
    if (camera) {
      camera.transform = {
        position: { ...transform.position },
        quaternion: { ...transform.quaternion }
      }
      camera.preset = null
      commit(next)
      return
    }
    const target =
      next.characters.find((entry) => entry.id === id) ??
      next.primitives.find((entry) => entry.id === id) ??
      next.models.find((entry) => entry.id === id)
    if (!target) return
    target.transform = transform
    commit(next)
  }


  function handleTimelineTogglePlay(): void {
    viewport?.timelineController.togglePlayPause()
  }

  function handleTimelineSeek(frame: number): void {
    viewport?.timelineController.seekToFrame(frame)
  }

  watch(timelineLoop, (loop) => {
    viewport?.timelineController.setLoopPlayback(loop)
  })

  function wireViewportEvents(target: Scene3dViewport): void {
    target.addEventListener(
      'timelineTimeUpdate',
      (data: TimelineTimeUpdate) => {
        timelineFrame.value = data.frame
      }
    )
    target.addEventListener('timelineDurationChange', () => {
      timelineDataVersion.value += 1
    })
    target.addEventListener(
      'timelineStateChange',
      (data: { playing: boolean; loop: boolean }) => {
        timelinePlaying.value = data.playing
        timelineLoop.value = data.loop
        writeEditorProps({ timelinePlaying: data.playing })
        viewport?.setTimelinePlayIntent(data.playing)
      }
    )
  }


  function setOutputSize(width: number | null, height: number | null): void {
    if (width !== null && Number.isFinite(width)) {
      outputWidth.value = Math.min(Math.max(Math.round(width), 64), 4096)
      writeWidget(node, WIDTH_WIDGET, outputWidth.value, {
        fireCallback: false
      })
    }
    if (height !== null && Number.isFinite(height)) {
      outputHeight.value = Math.min(Math.max(Math.round(height), 64), 4096)
      writeWidget(node, HEIGHT_WIDGET, outputHeight.value, {
        fireCallback: false
      })
    }
    viewport?.refreshViewport()
  }

  function setChannel(next: SceneChannel): void {
    channel.value = next
    writeWidget(node, CHANNEL_WIDGET, next, { fireCallback: false })
    viewport?.setPreviewChannel(next)
  }

  function setOutputFps(fps: number | null): void {
    if (fps === null || !Number.isFinite(fps)) return
    const next = cloneScene(state.value)
    next.output.fps = fps
    commit(next)
  }

  function setOutputFrameCount(frameCount: number | null): void {
    if (frameCount === null || !Number.isFinite(frameCount)) return
    const next = cloneScene(state.value)
    next.output.frameCount = frameCount
    commit(next)
  }


  async function capture(): Promise<void> {
    if (!viewport || capturing.value || recording.value) return
    capturing.value = true
    try {
      const cameraIds = state.value.cameras.map((camera) => camera.id)
      const targets: Array<string | null> =
        cameraIds.length === 0
          ? [null]
          : state.value.output.cameraId === ''
            ? [null, ...cameraIds]
            : cameraIds
      const shots = await captureSceneImages(
        viewport,
        {
          width: outputWidth.value,
          height: outputHeight.value,
          channel: channel.value
        },
        targets
      )
      const stamp = Date.now()
      const uploads: Array<{ label: string; url: string }> = []
      for (const shot of shots) {
        const label = shot.cameraId ?? 'view'
        const uploaded = await uploadBlobNamed(shot.blob, {
          subfolder: 'scene3d',
          filename: `comfytv-scene3d-${String(node?.id ?? 'unknown')}-${stamp}-${label}.png`
        })
        uploads.push({ label, url: uploaded.url })
      }

      const primaryIndex = Math.max(
        0,
        shots.findIndex((shot) =>
          state.value.output.cameraId === ''
            ? shot.cameraId === null
            : shot.cameraId === state.value.output.cameraId
        )
      )
      const batch = JSON.stringify({
        images: uploads.map((upload, index) => ({
          index: String(index + 1),
          label: upload.label,
          image_url: upload.url
        }))
      })
      capturedImageUrl.value = uploads[primaryIndex].url
      writeWidget(node, IMAGE_WIDGET, uploads[primaryIndex].url, {
        fireCallback: false
      })
      writeWidget(node, IMAGES_WIDGET, batch, { fireCallback: false })
      opts?.onCaptured?.(uploads[primaryIndex].url)
    } catch (error) {
      console.error('[ComfyTV/scene3d] capture failed', error)
      toastError(t('scene3d.captureFailed'))
    } finally {
      capturing.value = false
    }
  }

  function resolveFrameCount(fps: number): number {
    if (state.value.output.frameCount > 0) return state.value.output.frameCount
    const duration = viewport?.timelineController.totalDuration ?? 0
    return Math.max(1, Math.round(duration * fps))
  }

  async function record(): Promise<void> {
    if (!viewport || capturing.value || recording.value) return
    if (!recordingSupported) {
      toastError(t('scene3d.webcodecsUnsupported'))
      return
    }
    if (!hasRecordableDuration.value) {
      toastError(t('scene3d.noDurationToRecord'))
      return
    }
    recording.value = true
    recordProgress.value = null
    try {
      const fps = state.value.output.fps
      const blob = await new SceneVideoRecorder(viewport).record({
        width: outputWidth.value,
        height: outputHeight.value,
        channel: channel.value,
        fps,
        frameCount: resolveFrameCount(fps),
        onProgress: (progress) => {
          recordProgress.value = progress
        }
      })
      const uploaded = await uploadBlobNamed(blob, {
        subfolder: 'scene3d',
        filename: `comfytv-scene3d-${String(node?.id ?? 'unknown')}-${Date.now()}.webm`
      })
      capturedVideoUrl.value = uploaded.url
      writeWidget(node, VIDEO_WIDGET, uploaded.url, { fireCallback: false })
      opts?.onRecorded?.(uploaded.url)
    } catch (error) {
      console.error('[ComfyTV/scene3d] record failed', error)
      toastError(t('scene3d.recordFailed'))
    } finally {
      recording.value = false
      recordProgress.value = null
    }
  }

  loadFromNode()

  return {
    initScene,
    cleanup,
    handleMouseEnter,
    handleMouseLeave,
    state,
    selectedId,
    selectedCharacter,
    selectedPrimitive,
    selectedLight,
    selectedModel,
    selectedCamera,
    availableModels,
    modelAssets,
    clipNamesForSelected,
    gizmoMode,
    selectObject,
    addCharacter,
    addPrimitive,
    addModelFromAsset,
    addLight,
    applyLightPreset,
    removeSelected,
    renameObject,
    toggleObjectHidden,
    updateSelectedAnimation,
    updateSelectedTransform,
    updateSelectedPrimitive,
    updateSelectedLight,
    updateEnvironment,
    setGizmoMode,
    cameraPresets,
    addCamera,
    bindCameraPreset,
    updateCameraTuning,
    setCameraFov,
    setCameraSpeedById,
    outputCameraId,
    setOutputCamera,
    lookThroughId,
    toggleLookThrough,
    pipCameraId,
    setPipCamera,
    timelinePlaying,
    timelineFrame,
    timelineLoop,
    handleTimelineTogglePlay,
    handleTimelineSeek,
    updateCharacterAnimationById,
    buildTimelineData,
    timelineDataVersion,
    outputWidth,
    outputHeight,
    channel,
    capturing,
    recording,
    recordProgress,
    recordingSupported,
    hasRecordableDuration,
    capturedImageUrl,
    capturedVideoUrl,
    setOutputSize,
    setChannel,
    setOutputFps,
    setOutputFrameCount,
    capture,
    record
  }
}
