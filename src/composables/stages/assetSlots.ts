import { apiFetch } from '@/api'
import { WorkflowConfigSchema, type Asset } from '@/api/schemas'
import { getStageMeta } from '@/composables/stages/stageMeta'
import { useSelectionStore } from '@/stores/selectionStore'
import { getWidget } from '@/utils/widget'

const SLOT_BINDING_RE = /^upstream_image:(?:annotated|value|masked)\[(\d+)\]$/

export interface ImageSlotOption {
  slot: number
  nodeTitles: string[]
}

interface BindingWidget {
  node_title: string
  node_type: string
  stage_binding: string | null
}

export function imageSlotsFromConfig(widgets: BindingWidget[]): ImageSlotOption[] {
  const bySlot = new Map<number, Set<string>>()
  for (const w of widgets) {
    const m = w.stage_binding?.match(SLOT_BINDING_RE)
    if (!m) continue
    const slot = Number(m[1])
    const titles = bySlot.get(slot) ?? new Set<string>()
    titles.add(w.node_title || w.node_type)
    bySlot.set(slot, titles)
  }
  return [...bySlot.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([slot, titles]) => ({ slot, nodeTitles: [...titles] }))
}

export function workflowRefOfNode(node: unknown): { kind: string; label: string } | null {
  const comfyClass = String((node as { comfyClass?: unknown } | null)?.comfyClass ?? '')
  const kind = getStageMeta(comfyClass)?.workflow_kind
  if (!kind) return null
  const label = String(getWidget(node as any, 'workflow')?.value ?? '')
  if (!label) return null
  return { kind, label }
}

export function mentionWorkflowRef(
  node: unknown,
  graph: { links?: any; getNodeById?: (id: unknown) => unknown } | undefined,
): { kind: string; label: string } | null {
  const own = workflowRefOfNode(node)
  if (own) return own
  const outputs = (node as { outputs?: Array<{ links?: unknown[] | null }> } | null)?.outputs
  if (!Array.isArray(outputs) || !graph) return null
  for (const out of outputs) {
    for (const lid of out?.links ?? []) {
      const link = graph.links?.get?.(lid) ?? graph.links?.[lid as any]
      const target = link != null ? graph.getNodeById?.((link as any).target_id) : null
      const wf = workflowRefOfNode(target)
      if (wf) return wf
    }
  }
  return null
}

export async function fetchImageSlotOptions(
  kind: string,
  label: string,
): Promise<ImageSlotOption[]> {
  const config = await apiFetch(
    `/comfytv/workflows/config?kind=${encodeURIComponent(kind)}&label=${encodeURIComponent(label)}`,
    WorkflowConfigSchema,
  )
  return imageSlotsFromConfig(config.exposed_widgets as BindingWidget[])
}

const _slotOptionsCache = new Map<string, Promise<ImageSlotOption[]>>()

export function fetchImageSlotOptionsCached(
  kind: string,
  label: string,
): Promise<ImageSlotOption[]> {
  const version = useSelectionStore().bindingsVersion
  const key = `${kind}::${label}::v${version}`
  let hit = _slotOptionsCache.get(key)
  if (!hit) {
    _slotOptionsCache.clear()
    hit = fetchImageSlotOptions(kind, label).catch((e) => {
      _slotOptionsCache.delete(key)
      throw e
    })
    _slotOptionsCache.set(key, hit)
  }
  return hit
}

const _workflowMetaCache = new Map<string, Promise<Record<string, unknown>>>()

export function fetchWorkflowMetaCached(
  kind: string,
  label: string,
): Promise<Record<string, unknown>> {
  const version = useSelectionStore().bindingsVersion
  const key = `${kind}::${label}::v${version}`
  let hit = _workflowMetaCache.get(key)
  if (!hit) {
    _workflowMetaCache.clear()
    hit = apiFetch(
      `/comfytv/workflows/config?kind=${encodeURIComponent(kind)}&label=${encodeURIComponent(label)}`,
      WorkflowConfigSchema,
    ).then(config => (config.meta ?? {}) as Record<string, unknown>)
      .catch((e) => {
        _workflowMetaCache.delete(key)
        throw e
      })
    _workflowMetaCache.set(key, hit)
  }
  return hit
}

export function assetChipLabel(asset: Asset | undefined, id: number): string {
  return asset?.name || `asset:${id}`
}

export function missingRequiredPositions(
  requiredIndexes: Iterable<number>,
  count: number,
): number[] {
  return [...requiredIndexes].filter(idx => idx >= count)
}

export type MediaBindingWarning =
  | { kind: 'overflow'; count: number; total: number }
  | { kind: 'noSlots' }

export function mediaBindingWarnings(
  count: number,
  options: ImageSlotOption[] | null,
): MediaBindingWarning[] {
  if (count === 0 || options == null) return []
  if (options.length === 0) return [{ kind: 'noSlots' }]
  const unused = count - options.length
  return unused > 0 ? [{ kind: 'overflow', count: unused, total: options.length }] : []
}
