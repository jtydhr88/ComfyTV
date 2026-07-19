import { computed } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { ResolvedInput, StageState } from '@/stores/stageStore'
import {
  moveDown,
  moveUp,
  normalizeOrder,
  parseOrder,
  serializeOrder,
} from '@/composables/stages/fxChainOrder'
import { useStrWidget } from '@/composables/widgets/useWidgetModel'

export type FxDomain = 'video' | 'audio'

export interface FxSpecInfo {
  kind: string
  label: string
  domain: FxDomain
  specCount: number
}

export interface FxChainRow {
  slot: string
  ordinal: number
  known: boolean
  kind: string
  label: string
  domain: FxDomain
}

export function parseFxSpec(content: string | null | undefined): FxSpecInfo | null {
  if (!content) return null
  try {
    const v = JSON.parse(String(content)) as Record<string, unknown>
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null
    const kind = typeof v.kind === 'string' ? v.kind : ''
    const label = typeof v.label === 'string' && v.label ? v.label : kind
    if (!label) return null
    return {
      kind,
      label,
      domain: v.domain === 'audio' ? 'audio' : 'video',
      specCount: Array.isArray(v.specs) ? v.specs.length : 0,
    }
  } catch {
    return null
  }
}

export function fxChainRowsFromInputs(inputs: ResolvedInput[]): FxChainRow[] {
  const out: FxChainRow[] = []
  for (const inp of inputs) {
    if (inp.type !== 'COMFYTV_FXSPEC' || inp.source === 'empty') continue
    const ordinal = out.length + 1
    const spec = parseFxSpec(inp.content)
    out.push(spec
      ? { slot: inp.slot, ordinal, known: true, kind: spec.kind, label: spec.label, domain: spec.domain }
      : { slot: inp.slot, ordinal, known: false, kind: '', label: '', domain: 'video' })
  }
  return out
}

export function useFxChain(node: LGraphNode, getState: () => StageState) {
  const orderRaw = useStrWidget(node, 'chain_order', '')

  const rows = computed(() => fxChainRowsFromInputs(getState().inputs))

  const order = computed(() =>
    normalizeOrder(parseOrder(orderRaw.value, rows.value.length), rows.value.length))

  const orderedRows = computed<FxChainRow[]>(() => {
    const byOrdinal = new Map(rows.value.map(r => [r.ordinal, r]))
    return order.value
      .map(n => byOrdinal.get(n))
      .filter((r): r is FxChainRow => !!r)
  })

  function write(next: number[]): void {
    orderRaw.value = serializeOrder(next)
  }

  function onMoveUp(index: number): void {
    write(moveUp(order.value, index))
  }

  function onMoveDown(index: number): void {
    write(moveDown(order.value, index))
  }

  const orderedSummary = computed(() =>
    orderedRows.value.map(r => (r.known ? r.label : '?')).join(' → '))

  return { rows, order, orderedRows, onMoveUp, onMoveDown, orderedSummary }
}
