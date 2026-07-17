import { computed, ref, watch } from 'vue'

import type { LGraphNode } from '@/lib/comfyApp'
import type { ResolvedInput, StageState } from '@/stores/stageStore'
import { toastLoaderUploadFailed } from '@/composables/stages/useLoaderFileDrop'
import { uploadBlobNamed, uploadCanvas } from '@/utils/uploadCanvas'
import { getWidget, onNodeConfigure, readWidgetStr, writeWidget } from '@/utils/widget'
import { parseMaterialState, type MaterialParams } from '@/widgets/material/types'
import { convertModelFileToGlb, isConvertibleModelFile } from '@/widgets/three/convertToGlb'

export const CAPTURE_SIZE = 1024
export const CAPTURE_DELAY_MS = 700
export const MENU_PANEL_WIDTH = 380

export interface MaterialSlotOption {
  slot: string
  label: string
  color: string
}

export function parseBindings(json: string): Record<string, string> {
  if (!json) return {}
  try {
    const data = JSON.parse(json)
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'string' && v) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

export function inputFileUrl(path: string): string {
  if (!path) return ''
  const slash = path.lastIndexOf('/')
  const subfolder = slash >= 0 ? path.slice(0, slash) : ''
  const name = slash >= 0 ? path.slice(slash + 1) : path
  const params = new URLSearchParams({ filename: name, type: 'input' })
  if (subfolder) params.set('subfolder', subfolder)
  return `/view?${params.toString()}`
}

export function baseName(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash >= 0 ? path.slice(slash + 1) : path
}

export function menuPanelStyle(
  rect: { left: number; bottom: number },
  viewportWidth: number,
  viewportHeight: number,
): Record<string, string> {
  const left = Math.max(8, Math.min(rect.left, viewportWidth - MENU_PANEL_WIDTH - 8))
  const top = Math.min(rect.bottom + 4, viewportHeight - 380)
  return { left: `${left}px`, top: `${Math.max(8, top)}px` }
}

export function computeMaterialSlots(inputs: ResolvedInput[]): MaterialSlotOption[] {
  const out: MaterialSlotOption[] = []
  for (const inp of inputs) {
    if (inp.type !== 'COMFYTV_MATERIAL' || inp.source !== 'upstream' || !inp.content) continue
    out.push({
      slot: inp.slot,
      label: `M${out.length + 1}`,
      color: parseMaterialState(inp.content).color,
    })
  }
  return out
}

export function computePartMaterials(
  inputs: ResolvedInput[],
  bindings: Record<string, string>,
): Record<string, MaterialParams | null> {
  const bySlot = new Map<string, MaterialParams>()
  for (const inp of inputs) {
    if (inp.type === 'COMFYTV_MATERIAL' && inp.source === 'upstream' && inp.content) {
      bySlot.set(inp.slot, parseMaterialState(inp.content))
    }
  }
  const out: Record<string, MaterialParams | null> = {}
  for (const [part, slot] of Object.entries(bindings)) {
    out[part] = bySlot.get(slot) ?? null
  }
  return out
}

export interface UseModelLoaderOptions {
  getState: () => StageState
  onAction: (id: string, context?: { imageUrl?: string }) => void
  captureCanvas: () => HTMLCanvasElement | null
  onSelected?: () => void
}

export function useModelLoader(node: LGraphNode, opts: UseModelLoaderOptions) {
  const files = ref<string[]>([])
  const selected = ref('')
  const query = ref('')
  const uploading = ref(false)
  const uploadError = ref('')

  const filteredFiles = computed(() => {
    const q = query.value.trim().toLowerCase()
    if (!q) return files.value
    return files.value.filter((f) => f.toLowerCase().includes(q))
  })

  const modelSrc = computed(() => opts.getState().output || inputFileUrl(selected.value))

  const partKeys = ref<string[]>([])
  const selectedPart = ref<string | null>(null)
  const bindings = ref<Record<string, string>>(
    parseBindings(readWidgetStr(node, 'material_bindings', '')),
  )

  const materialSlots = computed(() => computeMaterialSlots(opts.getState().inputs))

  const partMaterials = computed<Record<string, MaterialParams | null>>(
    () => computePartMaterials(opts.getState().inputs, bindings.value),
  )

  const boundEntries = computed(() => Object.entries(bindings.value))

  function slotColor(slot: string): string {
    return materialSlots.value.find((s) => s.slot === slot)?.color ?? '#666'
  }

  function onPartsChanged(keys: string[]): void {
    partKeys.value = keys
    if (selectedPart.value && !keys.includes(selectedPart.value)) selectedPart.value = null
  }

  function onPartPick(key: string | null): void {
    selectedPart.value = key
  }

  function bindSelected(slot: string): void {
    if (!selectedPart.value) return
    bindings.value = { ...bindings.value, [selectedPart.value]: slot }
  }

  function unbind(part: string): void {
    const next = { ...bindings.value }
    delete next[part]
    bindings.value = next
  }

  watch(bindings, (v) => {
    writeWidget(node, 'material_bindings',
                Object.keys(v).length ? JSON.stringify(v) : '')
  }, { deep: true })

  onNodeConfigure(node, () => {
    bindings.value = parseBindings(readWidgetStr(node, 'material_bindings', ''))
    selectedPart.value = null
  })

  function widgetOptionValues(): string[] {
    const w = getWidget(node, 'model') as any
    const values = w?.options?.values
    return Array.isArray(values) ? values.filter((v: unknown) => typeof v === 'string' && v) : []
  }

  function onPick(file: string): void {
    selected.value = file
    writeWidget(node, 'model', file)
    opts.onSelected?.()
  }

  function registerFile(path: string): void {
    if (!files.value.includes(path)) files.value = [...files.value, path].sort()
    const w = getWidget(node, 'model') as any
    const values = w?.options?.values
    if (Array.isArray(values) && !values.includes(path)) values.push(path)
  }

  async function uploadModelFiles(picked: File[]): Promise<void> {
    if (!picked.length || uploading.value) return
    uploading.value = true
    uploadError.value = ''
    try {
      let lastPath = ''
      for (const file of picked) {
        const toUpload = isConvertibleModelFile(file.name) ? await convertModelFileToGlb(file) : file
        const uploaded = await uploadBlobNamed(toUpload, { subfolder: '3d', filename: toUpload.name })
        lastPath = `3d/${uploaded.name}`
        registerFile(lastPath)
      }
      if (lastPath) onPick(lastPath)
    } catch (e) {
      console.error('[ComfyTV/model-loader] upload failed', e)
      uploadError.value = String((e as Error)?.message ?? e)
      toastLoaderUploadFailed(e)
    } finally {
      uploading.value = false
    }
  }

  async function onPickFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const picked = Array.from(input.files ?? [])
    input.value = ''
    await uploadModelFiles(picked)
  }

  let captureTimer: number | null = null
  let captureSeq = 0

  function scheduleCapture(): void {
    if (captureTimer != null) window.clearTimeout(captureTimer)
    captureTimer = window.setTimeout(() => {
      captureTimer = null
      void runCapture()
    }, CAPTURE_DELAY_MS)
  }

  async function runCapture(): Promise<void> {
    const canvas = opts.captureCanvas()
    if (!canvas) return
    const mySeq = ++captureSeq
    try {
      const url = await uploadCanvas(canvas, {
        subfolder: 'model3d-view',
        filename: `comfytv-model-view-${Date.now()}.png`,
      })
      if (mySeq !== captureSeq) return
      opts.onAction('model-capture-view', { imageUrl: url })
    } catch (e) {
      console.error('[ComfyTV/model-loader] capture upload failed', e)
    }
  }

  function init(): void {
    for (const w of (node as any).widgets ?? []) {
      if (w.name === 'model' || w.type === 'button') w.hidden = true
    }
    files.value = [...widgetOptionValues()].sort()
    const saved = readWidgetStr(node, 'model', '')
    if (saved) {
      selected.value = saved
      if (!files.value.includes(saved)) files.value = [...files.value, saved].sort()
    }
  }

  function teardown(): void {
    captureSeq++
    if (captureTimer != null) window.clearTimeout(captureTimer)
    captureTimer = null
  }

  return {
    files,
    selected,
    query,
    uploading,
    uploadError,
    filteredFiles,
    modelSrc,
    partKeys,
    selectedPart,
    bindings,
    materialSlots,
    partMaterials,
    boundEntries,
    slotColor,
    onPartsChanged,
    onPartPick,
    bindSelected,
    unbind,
    onPick,
    registerFile,
    uploadModelFiles,
    onPickFiles,
    scheduleCapture,
    init,
    teardown,
  }
}
