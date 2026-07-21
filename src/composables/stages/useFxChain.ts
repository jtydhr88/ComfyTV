import { computed } from 'vue'
import { app, type LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import { collectUpstreamFxStack } from '@/composables/stages/useChainedFxPreview'
import { CHAIN_PREVIEW_STAGES } from '@/composables/stages/fxChainPreviewRegistry'

export interface FxSpecInfo {
  label: string
  count: number
}

function entryLabel(e: unknown): string | null {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null
  const v = e as Record<string, unknown>
  const label = typeof v.label === 'string' && v.label
    ? v.label
    : (typeof v.kind === 'string' ? v.kind : '')
  return label || null
}

export function parseFxSpec(content: string | null | undefined): FxSpecInfo | null {
  if (!content) return null
  let data: unknown
  try {
    data = JSON.parse(String(content))
  } catch {
    return null
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const chain = (data as Record<string, unknown>).chain
  const entries = Array.isArray(chain) ? chain : [data]
  const labels = entries.map(entryLabel)
  if (!labels.length || labels.some(l => l == null)) return null
  return { label: (labels as string[]).join(' → '), count: entries.length }
}

export interface FxChainRow {
  ordinal: number
  kind: string
  label: string
  preview: boolean
}

export function fxChainRowsOf(
  chainNode: unknown,
  graphApp: unknown = app,
): FxChainRow[] {
  return collectUpstreamFxStack(chainNode, graphApp).map((n, i) => {
    const cls = String((n as any)?.comfyClass ?? (n as any)?.type ?? '')
    return {
      ordinal: i + 1,
      kind: cls,
      label: String((n as any)?.title ?? cls),
      preview: cls in CHAIN_PREVIEW_STAGES,
    }
  })
}

export function useFxChain(node: LGraphNode, getState: () => StageState) {
  const rows = computed<FxChainRow[]>(() => {
    void getState().inputs
    return fxChainRowsOf(node)
  })

  const summary = computed(() => rows.value.map(r => r.label).join(' → '))

  return { rows, summary }
}
