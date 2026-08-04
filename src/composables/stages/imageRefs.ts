export const IMAGE_REFS_PROP = 'comfytv_image_refs'

export type AssetRefType = 'image' | 'video' | 'audio'

export interface ImageRef {
  asset_id: number
  slot: number
  type?: AssetRefType
}

export function refType(r: ImageRef): AssetRefType {
  return r.type === 'video' || r.type === 'audio' ? r.type : 'image'
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
    const rawType = (r as { type?: unknown })?.type
    const type = rawType === 'video' || rawType === 'audio' ? rawType : undefined
    out.push(type ? { asset_id: id, slot, type } : { asset_id: id, slot })
  }
  return out
}

export function writeImageRefs(node: unknown, refs: ImageRef[]): void {
  const n = node as { properties?: Record<string, unknown> } | null
  if (!n) return
  if (!n.properties) n.properties = {}
  n.properties[IMAGE_REFS_PROP] = refs.map(r =>
    r.type ? { asset_id: r.asset_id, slot: r.slot, type: r.type }
           : { asset_id: r.asset_id, slot: r.slot })
}
