import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

export type StageKind =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'panorama'
  | 'storyboard'
  | 'image-batch'
  | 'image-picker'
  | 'timeline'

export interface ImagePickContext {
  index: string
  label?: string
  prompt?: string
  imageUrl?: string
}

export type StageVariant = 'generator' | 'loader' | 'transform'

export type TypedValueType =
  | 'COMFYTV_TEXT'
  | 'COMFYTV_IMAGE'
  | 'COMFYTV_VIDEO'
  | 'COMFYTV_AUDIO'
  | 'COMFYTV_PANORAMA'
  | 'COMFYTV_STORYBOARD'
  | 'COMFYTV_IMAGES'
  | 'COMFYTV_TIMELINE'

export type InputSource = 'upstream' | 'upstream-pending' | 'empty'

export interface ResolvedInput {
  slot: string
  type: TypedValueType
  source: InputSource
  content: string | null
}

export interface StageState {
  kind: StageKind
  variant: StageVariant
  outputType: TypedValueType
  output: string | null
  outputs: (string | null)[]
  running: boolean
  inputs: ResolvedInput[]
  mainPrompt: string
  pickedIndex?: number
  pool?: string | null
  progress?: { value: number; max: number; text?: string } | null
  error?: { message: string; type?: string; traceback?: string } | null
   outputId?: number | null
   preparingWorkflow?: boolean
}

const KIND_TO_TYPE: Record<StageKind, TypedValueType> = {
  text:           'COMFYTV_TEXT',
  image:          'COMFYTV_IMAGE',
  video:          'COMFYTV_VIDEO',
  audio:          'COMFYTV_AUDIO',
  panorama:       'COMFYTV_PANORAMA',
  storyboard:     'COMFYTV_STORYBOARD',
  'image-batch':  'COMFYTV_IMAGES',
  'image-picker': 'COMFYTV_IMAGE',
  timeline:       'COMFYTV_TIMELINE',
}

export const useStageStore = defineStore('comfytv-stage', () => {
  const stages = new WeakMap<object, StageState>()
  const stateTick = ref(0)

  function registerStage(
    node: object,
    kind: StageKind,
    variant: StageVariant = 'generator',
  ): StageState {
    const state = reactive<StageState>({
      kind,
      variant,
      outputType: KIND_TO_TYPE[kind],
      output: null,
      outputs: [null],
      running: false,
      inputs: [],
      mainPrompt: '',
    })
    stages.set(node, state)
    return state
  }

  function unregisterStage(node: object) {
    stages.delete(node)
  }

  function getStage(node: object): StageState | undefined {
    return stages.get(node)
  }

  function bumpStateTick() {
    stateTick.value++
  }

  function notifyDownstream() {
    bumpStateTick()
  }

  function refreshStageInputs(node: any, state: StageState, app: any) {
    const out: ResolvedInput[] = []
    const inputs = node.inputs || []
    for (const inp of inputs) {
      const slot = inp.name as string
      const type = (inp.type || 'COMFYTV_TEXT') as TypedValueType

      if (inp.link == null) {
        out.push({ slot, type, source: 'empty', content: null })
        continue
      }

      const linksMap: any = app?.graph?.links
      const link = (linksMap && typeof linksMap.get === 'function')
        ? linksMap.get(inp.link)
        : (linksMap?.[inp.link] ?? app?.graph?.getLink?.(inp.link))
      const srcNode = link ? app?.graph?.getNodeById?.(link.origin_id) : null
      const srcState = srcNode ? stages.get(srcNode) : null
      const srcSlot = Number(link?.origin_slot) || 0
      let upstream: string | null = null
      if (srcState) {
        const slotted = srcState.outputs?.[srcSlot]
        if (slotted != null) {
          upstream = slotted
        } else if (srcSlot === 0 && srcState.output) {
          upstream = srcState.output
        }
      }

      if (upstream != null && String(upstream).length > 0) {
        out.push({ slot, type, source: 'upstream', content: String(upstream) })
      } else {
        out.push({ slot, type, source: 'upstream-pending', content: null })
      }
    }
    state.inputs = out
  }

  function applyExecutedPayload(state: StageState, msg: any) {
    const payload = Array.isArray(msg?.output) ? msg.output[0] : msg?.output
    const picked = Array.isArray(msg?.picked) ? msg.picked[0] : msg?.picked
    const pickedIdxRaw = Array.isArray(msg?.picked_index) ? msg.picked_index[0] : msg?.picked_index
    const outId = Array.isArray(msg?.output_id) ? msg.output_id[0] : msg?.output_id
    state.running = false
    state.progress = null
    state.error = null  // success clears any prior error
    if (payload == null) return
    const s = typeof payload === 'string' ? payload : String(payload)
    state.output = s
    while (state.outputs.length < 1) state.outputs.push(null)
    state.outputs[0] = s
    if (picked !== undefined && picked !== null) {
      const p = typeof picked === 'string' ? picked : String(picked)
      while (state.outputs.length < 2) state.outputs.push(null)
      state.outputs[1] = p
    }
    if (pickedIdxRaw != null && pickedIdxRaw !== '') {
      const idx = Number(pickedIdxRaw)
      if (Number.isFinite(idx) && idx >= 1) state.pickedIndex = idx
    }
    state.outputId = (outId != null && outId !== '') ? Number(outId) : null
    bumpStateTick()
  }

  function setPickerPool(node: any, state: StageState, poolJson: string) {
    if (state.pool === poolJson) return
    state.pool = poolJson
    const w = node?.widgets?.find((x: any) => x.name === 'pool')
    if (w) w.value = poolJson
    bumpStateTick()
  }

  function clearPickerPool(node: any, state: StageState) {
    setPickerPool(node, state, '')
    state.pickedIndex = 1
    const idx = node?.widgets?.find((x: any) => x.name === 'selected_index')
    if (idx) idx.value = 1
    setOutputSlot(state, 0, null)
  }

  function setOutputSlot(state: StageState, slot: number, value: string | null) {
    while (state.outputs.length <= slot) state.outputs.push(null)
    if (state.outputs[slot] === value) return
    state.outputs[slot] = value
    if (slot === 0) state.output = value
    bumpStateTick()
  }

  function applyExecutionError(
    state: StageState,
    error: { message: string; type?: string; traceback?: string },
  ) {
    state.running = false
    state.progress = null
    state.error = error
  }

  function clearError(state: StageState) {
    state.error = null
  }

  return {
    stateTick,
    registerStage,
    unregisterStage,
    getStage,
    bumpStateTick,
    notifyDownstream,
    refreshStageInputs,
    applyExecutedPayload,
    applyExecutionError,
    clearError,
    setOutputSlot,
    setPickerPool,
    clearPickerPool,
  }
})

export function computePickedImageUrl(state: StageState): string | null {
  const source = state.pool
    ? state.pool
    : state.inputs.find(i => i.slot === 'batch')?.content
  if (!source) return null
  return computePickedFromBatch(source, state.pickedIndex ?? 1)
}

export function imagePoolCount(json: string | null | undefined): number {
  if (!json) return 0
  try {
    const p = JSON.parse(String(json))
    return Array.isArray(p?.images) ? p.images.length : 0
  } catch {
    return 0
  }
}

export function mergeImagePool(
  existingPoolJson: string | null | undefined,
  incomingJson: string | null | undefined,
): string {
  const parse = (s: string | null | undefined): Array<Record<string, any>> => {
    if (!s) return []
    try {
      const p = JSON.parse(String(s))
      return Array.isArray(p?.images) ? p.images : []
    } catch {
      return []
    }
  }
  const existing = parse(existingPoolJson)
  const seen = new Set(existing.map(im => String(im.image_url ?? '')))
  const fresh: Array<Record<string, any>> = []
  for (const im of parse(incomingJson)) {
    const url = String(im.image_url ?? '')
    if (!url || seen.has(url)) continue
    seen.add(url)
    fresh.push({ ...im })
  }
  const merged = [...fresh, ...existing]
  merged.forEach((im, i) => { im.index = String(i + 1) })
  return JSON.stringify({ images: merged })
}

export function computePickedFromBatch(batch: string | null | undefined, wantIdx: number): string | null {
  if (!batch) return null
  try {
    const parsed = JSON.parse(String(batch))
    const images: Array<{ index?: string; image_url?: string }> =
      Array.isArray(parsed?.images) ? parsed.images : []
    const match = images.find(im => Number(im.index) === wantIdx)
      ?? images[wantIdx - 1]
    return match?.image_url ?? null
  } catch {
    return null
  }
}

