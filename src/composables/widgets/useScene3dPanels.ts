import { computed, ref } from 'vue'

import { i18n } from '@/i18n'
import type { LGraphNode } from '@/lib/comfyApp'
import type { useScene3dStage } from '@/composables/widgets/useScene3dStage'
import { useStageStore, type StageState } from '@/stores/stageStore'
import { onNodeConfigure, readWidgetStr } from '@/utils/widget'
import type { Scene3dGizmoMode } from '@/widgets/three/scene3d/Scene3dViewport'
import type { LightPresetName } from '@/widgets/three/scene3d/lightPresets'
import type {
  PrimitiveShape,
  SceneCameraEntry,
  SceneCharacterEntry,
  SceneLightEntry,
  SceneLightType,
  ScenePrimitiveEntry
} from '@/widgets/three/scene3d/types'
import { CAMERA_COLORS, TRACK_COLORS } from '@/widgets/three/scene3d/timelineTracks'

export type Scene3dStage = ReturnType<typeof useScene3dStage>

export const FREE_CAMERA_VALUE = '__free__'

export function useScene3dFullscreen() {
  const fullscreen = ref(false)

  function toggleFullscreen(): void {
    fullscreen.value = !fullscreen.value
  }

  function onFullscreenKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && fullscreen.value) {
      fullscreen.value = false
      event.stopPropagation()
    }
  }

  return { fullscreen, toggleFullscreen, onFullscreenKeydown }
}

export function useScene3dOutputSlots(node: LGraphNode, stageState: StageState) {
  const stageStore = useStageStore()

  function syncOutputSlots(imageUrl?: string, videoUrl?: string): void {
    const image = imageUrl ?? readWidgetStr(node, 'captured_image', '')
    const video = videoUrl ?? readWidgetStr(node, 'captured_video', '')
    const images = readWidgetStr(node, 'captured_images', '')
    stageStore.setOutputSlot(stageState, 0, image || null)
    stageStore.setOutputSlot(stageState, 1, video || null)
    stageStore.setOutputSlot(stageState, 2, images || null)
  }

  onNodeConfigure(node, () => syncOutputSlots())

  return { syncOutputSlots }
}

export function useScene3dPanels(stage: Scene3dStage) {
  const t = i18n.global.t
  const {
    state,
    selectedCharacter,
    selectedPrimitive,
    selectedLight,
    selectedModel,
    selectedCamera,
    availableModels,
    modelAssets,
    cameraPresets,
    lookThroughId,
    recordProgress,
    recordingSupported,
    hasRecordableDuration,
    buildTimelineData,
    timelineDataVersion,
    addCharacter,
    addPrimitive,
    addModelFromAsset,
    addLight,
    applyLightPreset,
    setOutputCamera,
    updateEnvironment
  } = stage

  function modelLabel(model: string): string {
    return (
      availableModels.value.find((entry) => entry.id === model)?.name ?? model
    )
  }

  function characterColor(index: number): string {
    return TRACK_COLORS[index % TRACK_COLORS.length]
  }

  function modelColor(index: number): string {
    return TRACK_COLORS[
      (state.value.characters.length + index) % TRACK_COLORS.length
    ]
  }

  function cameraColor(index: number): string {
    return CAMERA_COLORS[index % CAMERA_COLORS.length]
  }

  function cameraLabel(camera: SceneCameraEntry): string {
    if (!camera.preset) return camera.id
    const presetId = camera.preset.presetId
    const entry = cameraPresets.value.find((preset) => preset.id === presetId)
    return `${camera.id} · ${entry?.name ?? presetId}`
  }

  function characterDisplayLabel(character: SceneCharacterEntry): string {
    return character.name?.trim() || modelLabel(character.model)
  }

  function primitiveDisplayLabel(primitive: ScenePrimitiveEntry): string {
    return primitive.name?.trim() || t(`scene3d.${primitive.shape}`)
  }

  function lightDisplayLabel(light: SceneLightEntry): string {
    return light.name?.trim() || t(`scene3d.${light.type}`)
  }

  function cameraDisplayLabel(camera: SceneCameraEntry): string {
    return camera.name?.trim() || cameraLabel(camera)
  }

  const timelineData = computed(() => {
    void timelineDataVersion.value
    void state.value
    return buildTimelineData()
  })

  const timelineLegend = computed(() => [
    ...state.value.cameras.flatMap((camera, index) =>
      camera.preset
        ? [
            {
              id: camera.id,
              label: cameraDisplayLabel(camera),
              color: CAMERA_COLORS[index % CAMERA_COLORS.length]
            }
          ]
        : []
    ),
    ...state.value.characters.map((character, index) => ({
      id: character.id,
      label: characterDisplayLabel(character),
      color: TRACK_COLORS[index % TRACK_COLORS.length]
    })),
    ...state.value.models
      .filter((model) => model.animation.clip !== '')
      .map((model, index) => ({
        id: model.id,
        label: model.name || model.id,
        color:
          TRACK_COLORS[
            (state.value.characters.length + index) % TRACK_COLORS.length
          ]
      }))
  ])

  function gizmoModeDisabled(mode: Scene3dGizmoMode): boolean {
    if (selectedLight.value) return true
    if (selectedCamera.value) {
      if (lookThroughId.value === selectedCamera.value.id) return true
      if (mode === 'scale') return true
      if (mode === 'rotate' && selectedCamera.value.preset) return true
    }
    return false
  }

  const allGizmoDisabled = computed(
    () =>
      !!selectedLight.value ||
      (!!selectedCamera.value &&
        lookThroughId.value === selectedCamera.value.id)
  )

  const gizmoDisabledHint = computed(() => {
    if (selectedLight.value) return t('scene3d.lightGizmoHint')
    if (
      selectedCamera.value &&
      lookThroughId.value === selectedCamera.value.id
    ) {
      return t('scene3d.lookThroughGizmoHint')
    }
    if (selectedCamera.value?.preset) return t('scene3d.cameraPresetGizmoHint')
    return undefined
  })

  const outputCameraOptions = computed(() => [
    { value: FREE_CAMERA_VALUE, label: t('scene3d.freeCamera') },
    ...state.value.cameras.map((camera) => ({
      value: camera.id,
      label: cameraLabel(camera)
    }))
  ])

  function onSetOutputCamera(id: string): void {
    setOutputCamera(id === FREE_CAMERA_VALUE ? '' : id)
  }

  const objectsSummary = computed(() => {
    if (selectedCharacter.value) {
      return characterDisplayLabel(selectedCharacter.value)
    }
    if (selectedPrimitive.value) {
      return primitiveDisplayLabel(selectedPrimitive.value)
    }
    if (selectedLight.value) return lightDisplayLabel(selectedLight.value)
    if (selectedModel.value) {
      return selectedModel.value.name || selectedModel.value.id
    }
    if (selectedCamera.value) return cameraDisplayLabel(selectedCamera.value)
    return t('scene3d.noSelection')
  })

  const recordingLabel = computed(() => {
    const progress = recordProgress.value
    if (!progress) return t('scene3d.recording')
    if (progress.status === 'rendering' && progress.frame !== undefined) {
      return `${progress.frame + 1} / ${progress.totalFrames}`
    }
    return t('scene3d.recording')
  })

  const recordTitle = computed(() => {
    if (!recordingSupported) return t('scene3d.webcodecsUnsupported')
    if (!hasRecordableDuration.value) return t('scene3d.noDurationToRecord')
    return t('scene3d.record')
  })

  function onAddCharacter(event: Event): void {
    const select = event.target as HTMLSelectElement
    const model = select.value
    select.value = ''
    if (model) void addCharacter(model)
  }

  function onAddModel(event: Event): void {
    const select = event.target as HTMLSelectElement
    const assetId = Number(select.value)
    select.value = ''
    const asset = modelAssets.value.find((entry) => entry.id === assetId)
    if (asset) void addModelFromAsset(asset)
  }

  function onAddPrimitive(event: Event): void {
    const select = event.target as HTMLSelectElement
    const shape = select.value as PrimitiveShape
    select.value = ''
    if (shape) addPrimitive(shape)
  }

  function onAddLight(event: Event): void {
    const select = event.target as HTMLSelectElement
    const type = select.value as SceneLightType
    select.value = ''
    if (type) addLight(type)
  }

  function onApplyLightPreset(event: Event): void {
    const select = event.target as HTMLSelectElement
    const preset = select.value as LightPresetName
    select.value = ''
    if (preset) applyLightPreset(preset)
  }

  function onBackgroundInput(event: Event): void {
    updateEnvironment({ background: (event.target as HTMLInputElement).value })
  }

  return {
    modelLabel,
    characterColor,
    modelColor,
    cameraColor,
    cameraLabel,
    characterDisplayLabel,
    primitiveDisplayLabel,
    lightDisplayLabel,
    cameraDisplayLabel,
    timelineData,
    timelineLegend,
    gizmoModeDisabled,
    allGizmoDisabled,
    gizmoDisabledHint,
    outputCameraOptions,
    onSetOutputCamera,
    objectsSummary,
    recordingLabel,
    recordTitle,
    onAddCharacter,
    onAddModel,
    onAddPrimitive,
    onAddLight,
    onApplyLightPreset,
    onBackgroundInput
  }
}
