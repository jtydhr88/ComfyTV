import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import {
  LightBallWidget,
  type LightTransformGizmoMode
} from '@/widgets/three/light/LightBallWidget'
import { normalizeLightsValue, parseLightsData } from '@/widgets/three/light/lightsValue'
import {
  cloneLights,
  createDefaultLight,
  type LightInfoEntry,
  type LightInfoType
} from '@/widgets/three/light/types'
import {
  bindWidgetCallback,
  onNodeConfigure,
  readWidgetStr,
  writeWidget
} from '@/utils/widget'
import { uploadBlobNamed } from '@/utils/uploadCanvas'

const LIGHTS_WIDGET = 'lights_data'
const RENDER_WIDGET = 'light_render_url'
const PROP_KEY = 'comfytv_relight_editor'
const UPLOAD_DEBOUNCE_MS = 1000

interface EditorProps {
  selectedIndex?: number
  gizmosOn?: boolean
  transformMode?: LightTransformGizmoMode
  cameraLocked?: boolean
  renderHash?: string
}

export interface UseLightBallOptions {
  onRenderUploaded?: (url: string | null) => void
}

export function useLightBall(node: LGraphNode, opts?: UseLightBallOptions) {
  const lights = ref<LightInfoEntry[]>([])
  const selectedIndex = ref(-1)
  const gizmosOn = ref(true)
  const transformMode = ref<LightTransformGizmoMode>('none')
  const cameraLocked = ref(false)

  const selectedLight = computed<LightInfoEntry | null>(
    () => lights.value[selectedIndex.value] ?? null
  )

  let widget: LightBallWidget | null = null
  let uploadTimer: ReturnType<typeof setTimeout> | null = null
  let uploading = false
  let reuploadQueued = false

  function readEditorProps(): EditorProps {
    const stored = node?.properties?.[PROP_KEY]
    return stored && typeof stored === 'object' ? (stored as EditorProps) : {}
  }

  function writeEditorProps(patch: EditorProps): void {
    if (!node) return
    if (!node.properties) node.properties = {}
    node.properties[PROP_KEY] = { ...readEditorProps(), ...patch }
  }

  function loadFromNode(): void {
    lights.value = parseLightsData(readWidgetStr(node, LIGHTS_WIDGET, ''))
    const props = readEditorProps()
    const stored = Number(props.selectedIndex)
    selectedIndex.value =
      Number.isInteger(stored) && stored >= 0 && stored < lights.value.length
        ? stored
        : lights.value.length
          ? 0
          : -1
    gizmosOn.value = props.gizmosOn !== false
    transformMode.value = props.transformMode ?? 'none'
    cameraLocked.value = props.cameraLocked === true
  }

  loadFromNode()

  function syncWidgetView(): void {
    if (!widget) return
    widget.applyLights(cloneLights(lights.value), selectedIndex.value)
    widget.setGizmosVisible(gizmosOn.value)
    widget.setTransformGizmoMode(transformMode.value)
    widget.setCameraLocked(cameraLocked.value)
  }

  function renderIsStale(): boolean {
    if (!lights.value.length) return false
    const url = readWidgetStr(node, RENDER_WIDGET, '')
    if (!url) return true
    return readEditorProps().renderHash !== JSON.stringify(lights.value)
  }

  function initScene(container: HTMLElement): void {
    widget = new LightBallWidget({
      container,
      initialLights: cloneLights(lights.value),
      onLightsChange: (next) => {
        lights.value = next
        writeLightsWidget(next)
      },
      onSelectLight: (index) => {
        selectedIndex.value = index
        writeEditorProps({ selectedIndex: index })
      }
    })
    syncWidgetView()
    if (renderIsStale()) scheduleRenderUpload(300)
  }

  function cleanup(): void {
    if (uploadTimer !== null) {
      clearTimeout(uploadTimer)
      uploadTimer = null
    }
    widget?.dispose()
    widget = null
  }

  onNodeConfigure(node, () => {
    loadFromNode()
    syncWidgetView()
    if (widget && renderIsStale()) scheduleRenderUpload(300)
  })

  bindWidgetCallback(node, LIGHTS_WIDGET, (value) => {
    lights.value = parseLightsData(value)
    if (selectedIndex.value >= lights.value.length) {
      selectedIndex.value = lights.value.length - 1
    } else if (selectedIndex.value < 0 && lights.value.length) {
      selectedIndex.value = 0
    }
    widget?.applyLights(cloneLights(lights.value), selectedIndex.value)
    scheduleRenderUpload()
  })

  function writeLightsWidget(next: LightInfoEntry[]): void {
    writeWidget(node, LIGHTS_WIDGET, JSON.stringify(next), {
      fireCallback: false
    })
    scheduleRenderUpload()
  }

  function scheduleRenderUpload(delay = UPLOAD_DEBOUNCE_MS): void {
    if (uploadTimer !== null) clearTimeout(uploadTimer)
    uploadTimer = setTimeout(() => {
      uploadTimer = null
      void uploadRender()
    }, delay)
  }

  async function uploadRender(): Promise<void> {
    if (!widget) return
    if (uploading) {
      reuploadQueued = true
      return
    }
    const hash = JSON.stringify(lights.value)

    if (!lights.value.length) {
      writeWidget(node, RENDER_WIDGET, '', { fireCallback: false })
      writeEditorProps({ renderHash: hash })
      opts?.onRenderUploaded?.(null)
      return
    }

    uploading = true
    try {
      const canvas = widget.snapshotOutputView()
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      )
      if (!blob) return

      const nodeId = String(node?.id ?? 'unknown')
      const uploaded = await uploadBlobNamed(blob, {
        subfolder: 'comfytv/lightball',
        filename: `comfytv-lightball-${nodeId}-${Date.now()}.png`
      })
      writeWidget(node, RENDER_WIDGET, uploaded.url, { fireCallback: false })
      writeEditorProps({ renderHash: hash })
      opts?.onRenderUploaded?.(uploaded.url)
    } catch (e) {
      console.error('[ComfyTV/lightball] render upload failed', e)
    } finally {
      uploading = false
      if (reuploadQueued) {
        reuploadQueued = false
        scheduleRenderUpload(0)
      }
    }
  }

  function commit(next: LightInfoEntry[]): void {
    lights.value = next
    if (selectedIndex.value >= next.length) {
      selectedIndex.value = next.length - 1
    }
    writeLightsWidget(next)
    writeEditorProps({ selectedIndex: selectedIndex.value })
    widget?.applyLights(cloneLights(next), selectedIndex.value)
  }

  function selectLight(index: number): void {
    if (index < 0 || index >= lights.value.length) return
    selectedIndex.value = index
    writeEditorProps({ selectedIndex: index })
    widget?.applyLights(cloneLights(lights.value), index)
  }

  function addLight(type: LightInfoType): void {
    const next = [...cloneLights(lights.value), createDefaultLight(type)]
    selectedIndex.value = next.length - 1
    commit(next)
  }

  function removeSelectedLight(): void {
    if (selectedIndex.value < 0) return
    const next = cloneLights(lights.value)
    next.splice(selectedIndex.value, 1)
    selectedIndex.value = Math.min(selectedIndex.value, next.length - 1)
    commit(next)
  }

  function updateSelectedLight(patch: Partial<LightInfoEntry>): void {
    const current = selectedLight.value
    if (!current) return
    const next = cloneLights(lights.value)
    next[selectedIndex.value] = normalizeLightsValue([
      { ...current, ...patch }
    ])[0]
    commit(next)
  }

  function setSelectedLightType(type: LightInfoType): void {
    const current = selectedLight.value
    if (!current || current.type === type) return
    const base = createDefaultLight(type)
    const next = cloneLights(lights.value)
    next[selectedIndex.value] = {
      ...base,
      color: current.color,
      position: { ...current.position },
      ...(base.target && current.target
        ? { target: { ...current.target } }
        : {})
    }
    commit(next)
  }

  function applyPreset(entries: LightInfoEntry[]): void {
    const next = normalizeLightsValue(cloneLights(entries))
    selectedIndex.value = next.length ? 0 : -1
    commit(next)
  }

  function setGizmosVisible(on: boolean): void {
    gizmosOn.value = on
    writeEditorProps({ gizmosOn: on })
    widget?.setGizmosVisible(on)
  }

  function setTransformGizmoMode(mode: LightTransformGizmoMode): void {
    transformMode.value = mode
    writeEditorProps({ transformMode: mode })
    widget?.setTransformGizmoMode(mode)
  }

  function resetViewToOutput(): void {
    widget?.resetViewToOutput()
  }

  function setCameraLocked(locked: boolean): void {
    cameraLocked.value = locked
    writeEditorProps({ cameraLocked: locked })
    widget?.setCameraLocked(locked)
  }

  return {
    lights,
    selectedIndex,
    selectedLight,
    gizmosOn,
    transformMode,
    cameraLocked,
    initScene,
    cleanup,
    selectLight,
    addLight,
    removeSelectedLight,
    updateSelectedLight,
    setSelectedLightType,
    applyPreset,
    setGizmosVisible,
    setTransformGizmoMode,
    resetViewToOutput,
    setCameraLocked
  }
}
