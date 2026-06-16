export const IMAGE_REFS_PROP = 'comfytv_image_refs'

export interface ImageRef {
  asset_id: number
  slot: number
}

export function readImageRefs(node: unknown): ImageRef[] {
  const raw = (node as { properties?: Record<string, unknown> } | null)
    ?.properties?.[IMAGE_REFS_PROP]
  if (!Array.isArray(raw)) return []
  const out: ImageRef[] = []
  for (const r of raw) {
    const id = Number((r as { asset_id?: unknown })?.asset_id)
    const rawSlot = (r as { slot?: unknown })?.slot
    const slot = typeof rawSlot === 'number' ? rawSlot : NaN
    if (!Number.isInteger(id) || !Number.isInteger(slot)) continue
    out.push({ asset_id: id, slot })
  }
  return out
}

export function writeImageRefs(node: unknown, refs: ImageRef[]): void {
  const n = node as { properties?: Record<string, unknown> } | null
  if (!n) return
  if (!n.properties) n.properties = {}
  n.properties[IMAGE_REFS_PROP] = refs.map(r => ({ asset_id: r.asset_id, slot: r.slot }))
}
