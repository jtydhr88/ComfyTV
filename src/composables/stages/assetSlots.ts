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


export const AUTOGROW_IMAGE_KEY_RE = /^images\.image(\d+)$/

export interface ResolvedImageRef {
  id: number
  url: string
  slot: number
}

export function assetChipLabel(asset: Asset | undefined, id: number): string {
  return asset?.name || `asset:${id}`
}

export function nodeAcceptsAutogrowImages(node: unknown): boolean {
  const inputs = (node as { inputs?: Array<{ name?: unknown }> } | null)?.inputs
  if (!Array.isArray(inputs)) return false
  return inputs.some(
    i => typeof i?.name === 'string' && AUTOGROW_IMAGE_KEY_RE.test(i.name),
  )
}

export function wiredImageSlots(node: unknown): number[] {
  const inputs = (node as { inputs?: Array<{ name?: unknown; link?: unknown }> } | null)?.inputs
  if (!Array.isArray(inputs)) return []
  const out: number[] = []
  for (const i of inputs) {
    if (typeof i?.name !== 'string') continue
    const m = AUTOGROW_IMAGE_KEY_RE.exec(i.name)
    if (m && i.link != null) out.push(Number(m[1]))
  }
  return out
}

export function refCoveredImageSlots(
  refs: Array<{ slot: number }>,
): Set<number> {
  return new Set(refs.map(r => r.slot))
}

export function missingRequiredImageSlots(
  requiredSlots: Iterable<number>,
  wired: Iterable<number>,
  refCovered: Iterable<number>,
): number[] {
  const have = new Set<number>([...wired, ...refCovered])
  return [...requiredSlots].filter(idx => !have.has(idx))
}

export type RefSlotWarning =
  | { kind: 'duplicate'; slot: number }
  | { kind: 'override'; slot: number }
  | { kind: 'overflow'; count: number; total: number }
  | { kind: 'noSlots' }

export function refSlotWarnings(
  refs: Array<{ slot: number }>,
  wired: number[],
  options: ImageSlotOption[] | null,
): RefSlotWarning[] {
  const out: RefSlotWarning[] = []
  if (refs.length === 0) return out

  const pinCounts = new Map<number, number>()
  for (const r of refs) pinCounts.set(r.slot, (pinCounts.get(r.slot) ?? 0) + 1)
  const wiredSet = new Set(wired)
  for (const [slot, count] of [...pinCounts.entries()].sort((a, b) => a[0] - b[0])) {
    if (count > 1) out.push({ kind: 'duplicate', slot })
    if (wiredSet.has(slot)) out.push({ kind: 'override', slot })
  }

  if (options != null) {
    if (options.length === 0) {
      out.push({ kind: 'noSlots' })
    } else {
      const bound = new Set(options.map(o => o.slot))
      const unused = refs.filter(r => !bound.has(r.slot)).length
      if (unused > 0) out.push({ kind: 'overflow', count: unused, total: options.length })
    }
  }
  return out
}

export function injectImageRefs(
  inputs: Record<string, unknown>,
  refs: ResolvedImageRef[],
): string[] {
  if (refs.length === 0) return []

  const wired = new Set<number>()
  for (const key of Object.keys(inputs)) {
    const m = AUTOGROW_IMAGE_KEY_RE.exec(key)
    if (m) wired.add(Number(m[1]))
  }

  const warnings: string[] = []
  const seen = new Set<number>()
  for (const ref of refs) {
    if (seen.has(ref.slot)) {
      warnings.push(`reference slot #${ref.slot} pinned by two images — the later one wins`)
    } else if (wired.has(ref.slot)) {
      warnings.push(`reference slot #${ref.slot} had an upstream connection — the pinned image overrides it`)
    }
    seen.add(ref.slot)
  }

  for (const ref of refs) {
    inputs[`images.image${ref.slot}`] = ref.url
  }
  return warnings
}
