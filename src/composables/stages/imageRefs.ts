export const IMAGE_REFS_PROP = 'comfytv_image_refs'

export type AssetRefType = 'image' | 'video' | 'audio'

export interface ImageRef {
  asset_id?: number
  batch_index?: number
  batch_id?: string
  slot: number
  type?: AssetRefType
}

export function refType(r: ImageRef): AssetRefType {
  return r.type === 'video' || r.type === 'audio' ? r.type : 'image'
}

export function isBatchRef(r: ImageRef): boolean {
  return r.batch_index != null
}

export function refKey(r: ImageRef): string {
  if (r.batch_index != null) return `batch:${r.batch_id}:${r.batch_index}`
  return `asset:${r.asset_id}`
}

export function readImageRefs(node: unknown): ImageRef[] {
  const raw = (node as { properties?: Record<string, unknown> } | null)
    ?.properties?.[IMAGE_REFS_PROP]
  if (!Array.isArray(raw)) return []
  const out: ImageRef[] = []
  for (const r of raw) {
    const rawSlot = (r as { slot?: unknown })?.slot
    const slot = typeof rawSlot === 'number' ? rawSlot : NaN
    if (!Number.isInteger(slot)) continue
    const rawType = (r as { type?: unknown })?.type
    const type = rawType === 'video' || rawType === 'audio' ? rawType : undefined
    const batchIndex = Number((r as { batch_index?: unknown })?.batch_index)
    if (Number.isInteger(batchIndex) && batchIndex >= 0) {
      const rawBatchId = (r as { batch_id?: unknown })?.batch_id
      if (typeof rawBatchId === 'string' && rawBatchId) {
        out.push({ batch_index: batchIndex, batch_id: rawBatchId, slot })
      }
      continue
    }
    const id = Number((r as { asset_id?: unknown })?.asset_id)
    if (!Number.isInteger(id)) continue
    out.push(type ? { asset_id: id, slot, type } : { asset_id: id, slot })
  }
  return out
}

export function writeImageRefs(node: unknown, refs: ImageRef[]): void {
  const n = node as { properties?: Record<string, unknown> } | null
  if (!n) return
  if (!n.properties) n.properties = {}
  n.properties[IMAGE_REFS_PROP] = refs.map((r) => {
    if (r.batch_index != null) {
      return { batch_index: r.batch_index, batch_id: r.batch_id, slot: r.slot }
    }
    return r.type ? { asset_id: r.asset_id, slot: r.slot, type: r.type }
                  : { asset_id: r.asset_id, slot: r.slot }
  })
}
