import { apiFetch, WorkflowInfoSchema } from '@/api'
import {
  missingRequiredImageSlots,
  nodeAcceptsAutogrowImages,
  refCoveredImageSlots,
  wiredImageSlots,
} from '@/composables/stages/assetSlots'
import { type ImageRef, readImageRefs } from '@/composables/stages/imageRefs'

export type SlotWarningStatus = 'wired_but_unused' | 'required_but_missing'

export interface SlotWarning {
  status: SlotWarningStatus
  message: string
}

export type SlotWarningMap = Record<string, SlotWarning>

export interface ValidateOpts {
  imageRefs?: ImageRef[]
  assetExists?: (id: number) => boolean
}

type Kind = 'image' | 'video' | 'audio' | 'text'

interface UsageEntry {
  uses:       Record<Kind, boolean>
  requires:   Record<Kind, boolean>
  required_slots?: Record<Kind, number[]>
  max_inputs: Record<Kind, number | null>
}

type WorkflowInfo = Record<string, Record<string, UsageEntry>>

function requiredSlotsOf(entry: UsageEntry, kind: Kind): number[] {
  const explicit = entry.required_slots?.[kind]
  if (explicit) return explicit
  return entry.requires[kind] ? [0] : []
}

let _infoPromise: Promise<WorkflowInfo> | null = null

export function loadWorkflowInfo(): Promise<WorkflowInfo> {
  if (!_infoPromise) {
    _infoPromise = apiFetch('/comfytv/workflow_info', WorkflowInfoSchema)
      .then(info => info as WorkflowInfo)
      .catch(err => {
        console.warn('[ComfyTV/validator] workflow_info fetch failed:', err)
        return {}
      })
  }
  return _infoPromise
}

export function invalidateWorkflowInfo() {
  _infoPromise = null
}

function slotKind(type: string | undefined | null): Kind | null {
  switch (type) {
    case 'COMFYTV_IMAGE':
    case 'COMFYTV_IMAGES': return 'image'
    case 'COMFYTV_VIDEO':  return 'video'
    case 'COMFYTV_AUDIO':  return 'audio'
    case 'COMFYTV_TEXT':   return 'text'
    default: return null
  }
}

function emptySlotsOfKind(node: any, kind: Kind): any[] {
  return (node?.inputs ?? []).filter(
    (inp: any) => slotKind(inp?.type) === kind && inp.link == null,
  )
}

function countWiredOfKind(node: any, kind: Kind): number {
  let n = 0
  for (const inp of node?.inputs ?? []) {
    if (slotKind(inp?.type) !== kind) continue
    if (inp.link != null) n += 1
  }
  return n
}

export async function validateNode(
  node: any,
  _stageKind: string,
  opts: ValidateOpts = {},
): Promise<SlotWarningMap> {
  const info = await loadWorkflowInfo()
  const out: SlotWarningMap = {}

  const wfWidget = node?.widgets?.find((w: any) => w.name === 'workflow')
  const label = wfWidget ? String(wfWidget.value ?? '') : ''
  if (!label) return out

  let entry: UsageEntry | undefined
  for (const labels of Object.values(info)) {
    if (labels && label in labels) { entry = labels[label]; break }
  }
  if (!entry) return out

  const imageRefs = opts.imageRefs ?? readImageRefs(node)
  const assetExists = opts.assetExists ?? (() => true)

  const wiredCount: Record<Kind, number> = { image: 0, video: 0, audio: 0, text: 0 }
  for (const inp of node?.inputs ?? []) {
    if (inp.link == null) continue
    const kind = slotKind(inp?.type)
    if (!kind) continue
    const slotName = String(inp.name || '')
    wiredCount[kind] += 1
    const max = entry.max_inputs[kind]

    if (max === 0) {
      out[slotName] = {
        status: 'wired_but_unused',
        message: `"${label}" doesn't consume ${kind} input — this ` +
          `connection will be ignored at run time.`,
      }
    } else if (max !== null && wiredCount[kind] > max) {
      out[slotName] = {
        status: 'wired_but_unused',
        message: `"${label}" only consumes ${max} ${kind} input` +
          `${max === 1 ? '' : 's'} — this extra connection will be ` +
          `ignored at run time.`,
      }
    }
  }

  if (nodeAcceptsAutogrowImages(node)) {
    const required = requiredSlotsOf(entry, 'image')
    if (required.length) {
      const wired = wiredImageSlots(node)
      const resolvedRefs = imageRefs.filter(r => assetExists(r.asset_id))
      const refCovered = refCoveredImageSlots(resolvedRefs)
      const missing = missingRequiredImageSlots(required, wired, refCovered)
      const total = required.length
      for (const idx of missing) {
        const msg = total === 1
          ? `"${label}" requires an image — wire one into this slot or add an image reference.`
          : `"${label}" image slot #${idx + 1} has no source — wire one in or add an image ` +
            `reference (${total - missing.length}/${total} ready).`
        out[`images.image${idx}`] = { status: 'required_but_missing', message: msg }
      }
    }
  }

  const otherKinds = nodeAcceptsAutogrowImages(node)
    ? (['video', 'audio', 'text'] as const)
    : (['image', 'video', 'audio', 'text'] as const)
  for (const kind of otherKinds) {
    const needed = requiredSlotsOf(entry, kind).length
    if (needed === 0) continue
    const wired = countWiredOfKind(node, kind)
    if (wired >= needed) continue
    const missing = needed - wired
    const empties = emptySlotsOfKind(node, kind).slice(0, missing)
    for (const target of empties) {
      const msg = needed === 1
        ? `"${label}" requires a ${kind} input — wire one into this slot.`
        : `"${label}" requires ${needed} ${kind} inputs — wire one into this slot ` +
          `(${wired}/${needed} wired so far).`
      out[String(target.name || '')] = {
        status: 'required_but_missing',
        message: msg,
      }
    }
  }

  return out
}

const COMFYTV_WARN_TYPE = 'comfytv-validation'

interface NodeErrorEntry {
  type: string
  message: string
  details: string
  extra_info?: { input_name?: string }
}

interface NodeError {
  errors: NodeErrorEntry[]
  class_type: string
  dependent_outputs: unknown[]
}

let _errStore: any = null
function findHostPinia(): any {
  const win = window as any
  if (win.__comfytv_host_pinia) return win.__comfytv_host_pinia
  for (const sel of ['#vue-app', '#app']) {
    const root: any = document.querySelector(sel)
    const vueApp = root?.__vue_app__
    const pinia = vueApp?.config?.globalProperties?.$pinia
                  ?? vueApp?._context?.config?.globalProperties?.$pinia
    if (pinia) return pinia
  }
  return win.app?.extensionManager?._p ?? null
}
function getErrorStore(): any {
  if (_errStore) return _errStore
  const hostPinia = findHostPinia()
  const store = hostPinia?._s?.get?.('executionError') ?? null
  if (store) _errStore = store
  return _errStore
}

function syncToErrorStore(node: any, warnings: SlotWarningMap): void {
  const store = getErrorStore()
  if (!store) return

  const nodeId = String(node.id)
  const current: Record<string, NodeError> | null = store.lastNodeErrors ?? null
  const existing = current?.[nodeId]

  const preserved: NodeErrorEntry[] =
    existing?.errors.filter(e => e.type !== COMFYTV_WARN_TYPE) ?? []
  const ours: NodeErrorEntry[] = Object.entries(warnings).map(
    ([slotName, w]) => ({
      type: COMFYTV_WARN_TYPE,
      message: w.message,
      details: w.message,
      extra_info: { input_name: slotName },
    }),
  )
  const merged = [...preserved, ...ours]

  const next: Record<string, NodeError> = { ...(current ?? {}) }
  if (merged.length === 0) {
    delete next[nodeId]
  } else {
    next[nodeId] = {
      errors: merged,
      class_type: String(node.comfyClass ?? ''),
      dependent_outputs: [],
    }
  }
  store.lastNodeErrors = Object.keys(next).length > 0 ? next : null
}

const LEGACY_WARN_COLORS = new Set(['#ff6b6b', '#ffb84d'])
const LEGACY_PREFIX = '⚠ '

export function applySlotWarnings(node: any): void {
  const warnings: SlotWarningMap = node._comfytvSlotWarnings ?? {}

  for (const inp of node?.inputs ?? []) {
    const name = String(inp.name || '')
    const warn = warnings[name]

    if (typeof inp.label === 'string' && inp.label.startsWith(LEGACY_PREFIX)) {
      const stripped = inp.label.slice(LEGACY_PREFIX.length)
      inp.label = stripped === name ? undefined : stripped
    }
    if (inp.color_off && LEGACY_WARN_COLORS.has(inp.color_off)) inp.color_off = undefined
    if (inp.color_on  && LEGACY_WARN_COLORS.has(inp.color_on))  inp.color_on  = undefined

    inp.hasErrors = !!warn
    inp.tooltip   = warn ? warn.message : undefined
  }

  syncToErrorStore(node, warnings)
}
