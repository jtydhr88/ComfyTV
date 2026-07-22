import { computed, reactive, ref, watch } from 'vue'

import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import { app } from '@/lib/comfyApp'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import type { ControlDef } from '@/composables/stages/useMeshOp'
import { downloadFile } from '@/utils/download'
import { bindWidgetCallback, getWidget, onNodeConfigure, writeWidget } from '@/utils/widget'

export const LINE_ART_CONTROLS: ControlDef[] = [
  { widget: 'width', labelKey: 'lineArt.width', type: 'int', min: 256, max: 4096, step: 64 },
  { widget: 'height', labelKey: 'lineArt.height', type: 'int', min: 256, max: 4096, step: 64 },
  { widget: 'thickness', labelKey: 'lineArt.thickness', type: 'float', min: 0.5, max: 8, step: 0.5 },
  { widget: 'silhouette', labelKey: 'lineArt.silhouette', type: 'bool' },
  { widget: 'crease', labelKey: 'lineArt.crease', type: 'bool' },
  { widget: 'crease_angle', labelKey: 'lineArt.creaseAngle', type: 'float', min: 1, max: 179, step: 1,
    showIf: { widget: 'crease', equals: 'true' } },
  { widget: 'boundary', labelKey: 'lineArt.boundary', type: 'bool' },
  { widget: 'occlusion', labelKey: 'lineArt.occlusion', type: 'bool' },
  { widget: 'invert', labelKey: 'lineArt.invert', type: 'bool' },
]

const DEFAULTS: Record<string, string | number | boolean> = {
  width: 1024, height: 1024, thickness: 2,
  silhouette: true, crease: true, crease_angle: 60,
  boundary: true, occlusion: true, invert: false,
}

export interface LineArtCamera {
  position: number[]
  target: number[]
  fov: number
}

export function useLineArt(node: LGraphNode, stageState: StageState) {
  const values = reactive<Record<string, string | number | boolean>>({})
  for (const c of LINE_ART_CONTROLS) {
    const w = getWidget(node, c.widget)
    values[c.widget] = (w?.value as string | number | boolean | undefined) ?? DEFAULTS[c.widget]
    bindWidgetCallback(node, c.widget, (value) => {
      values[c.widget] = c.type === 'bool' ? Boolean(value) : Number(value)
    })
  }

  onNodeConfigure(node, () => {
    for (const c of LINE_ART_CONTROLS) {
      const w = getWidget(node, c.widget)
      if (w != null) values[c.widget] = w.value as string | number | boolean
    }
  })

  const visibleControls = computed(() =>
    LINE_ART_CONTROLS.filter((c) => !c.showIf || String(values[c.showIf.widget]) === c.showIf.equals))

  function setValue(c: ControlDef, raw: string | number | boolean): void {
    let v: string | number | boolean = raw
    if (c.type === 'bool') {
      v = Boolean(raw)
    } else {
      let n = Number(raw)
      if (!Number.isFinite(n)) return
      if (c.min != null) n = Math.max(c.min, n)
      if (c.max != null) n = Math.min(c.max, n)
      if (c.type === 'int') n = Math.round(n)
      v = n
    }
    values[c.widget] = v
    writeWidget(node, c.widget, v)
  }

  function writeCamera(cam: LineArtCamera | null): void {
    if (!cam) return
    writeWidget(node, 'camera', JSON.stringify(cam))
  }

  const sourceUrl = computed(() => pickSourceImageUrl(stageState.inputs, 'model'))
  const resultUrl = computed(() => stageState.output || null)

  const showResult = ref(false)
  watch(resultUrl, (v) => { if (v) showResult.value = true })

  function assetUrl(path: string): string {
    const api = (app as { api?: { fileURL?: (p: string) => string } }).api
    return typeof api?.fileURL === 'function' ? api.fileURL(path) : path
  }

  async function onDownloadResult(): Promise<void> {
    if (!resultUrl.value) return
    try {
      await downloadFile(resultUrl.value)
    } catch (e) {
      console.error('[ComfyTV/line-art] download failed', e)
    }
  }

  return {
    values,
    visibleControls,
    setValue,
    writeCamera,
    sourceUrl,
    resultUrl,
    showResult,
    assetUrl,
    onDownloadResult,
  }
}
