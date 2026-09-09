export type MediaType = 'image' | 'video' | 'audio'
export const MEDIA_TYPES: readonly MediaType[] = ['image', 'video', 'audio']

export type MediaSource = 'link' | 'asset' | 'batch'

export interface MediaEntry {
  key: string
  src: MediaSource
  link?: number
  from?: [number, number]
  asset_id?: number
  batch_id?: string
  batch_index?: number
}

export type MediaTable = Record<MediaType, MediaEntry[]>

export type PositionRemap = Partial<Record<MediaType, Map<number, number | null>>>

export const MEDIA_PROP = 'comfytv_media'
export const LEGACY_REFS_PROP = 'comfytv_image_refs'

export const AUTOGROW_KEY_RE: Record<MediaType, RegExp> = {
  image: /^images\.image(\d+)$/,
  video: /^videos\.video(\d+)$/,
  audio: /^audio\.audio(\d+)$/,
}

const AUTOGROW_GROUP: Record<MediaType, string> = { image: 'images', video: 'videos', audio: 'audio' }
const AUTOGROW_PREFIX: Record<MediaType, string> = { image: 'image', video: 'video', audio: 'audio' }
const DEFAULT_MAX: Record<MediaType, number> = { image: 12, video: 6, audio: 3 }

export function autogrowKey(type: MediaType, index: number): string {
  return `${AUTOGROW_GROUP[type]}.${AUTOGROW_PREFIX[type]}${index}`
}

export function emptyTable(): MediaTable {
  return { image: [], video: [], audio: [] }
}

export function entryKey(e: Omit<MediaEntry, 'key'>): string {
  if (e.src === 'link') return `l${e.link}`
  if (e.src === 'batch') return `b${e.batch_id}:${e.batch_index}`
  return `a${e.asset_id}`
}

export function assetEntry(asset_id: number): MediaEntry {
  return { key: `a${asset_id}`, src: 'asset', asset_id }
}

export function batchEntry(batch_id: string, batch_index: number): MediaEntry {
  return { key: `b${batch_id}:${batch_index}`, src: 'batch', batch_id, batch_index }
}

function linkEntry(l: LiveLink): MediaEntry {
  const e: MediaEntry = { key: `l${l.link}`, src: 'link', link: l.link }
  if (l.from) e.from = l.from
  return e
}

type AnyNode = {
  inputs?: Array<{ name?: unknown; link?: unknown; type?: unknown }>
  properties?: Record<string, unknown>
  comfyDynamic?: { autogrow?: Record<string, { max?: number }> }
} | null | undefined

type AnyGraph = { links?: any; getLink?: (id: number) => any } | null | undefined

function normalizeEntry(raw: unknown): MediaEntry | null {
  const r = raw as Record<string, unknown> | null
  if (!r || typeof r !== 'object') return null
  if (r.src === 'link') {
    const link = Number(r.link)
    if (!Number.isInteger(link)) return null
    const e: MediaEntry = { key: `l${link}`, src: 'link', link }
    const from = r.from
    if (Array.isArray(from) && from.length === 2) e.from = [Number(from[0]), Number(from[1])]
    return e
  }
  if (r.src === 'batch') {
    const idx = Number(r.batch_index)
    const id = r.batch_id
    if (typeof id !== 'string' || !id || !Number.isInteger(idx) || idx < 0) return null
    return batchEntry(id, idx)
  }
  if (r.src === 'asset') {
    const id = Number(r.asset_id)
    if (!Number.isInteger(id)) return null
    return assetEntry(id)
  }
  return null
}

export function hasMediaTable(node: unknown): boolean {
  const raw = (node as AnyNode)?.properties?.[MEDIA_PROP]
  return !!raw && typeof raw === 'object'
}

export function readMediaTable(node: unknown): MediaTable {
  const out = emptyTable()
  const raw = (node as AnyNode)?.properties?.[MEDIA_PROP] as Record<string, unknown> | undefined
  if (!raw || typeof raw !== 'object') return out
  for (const type of MEDIA_TYPES) {
    const list = raw[type]
    if (!Array.isArray(list)) continue
    const seen = new Set<string>()
    for (const item of list) {
      const e = normalizeEntry(item)
      if (!e || seen.has(e.key)) continue
      seen.add(e.key)
      out[type].push(e)
    }
  }
  return out
}

const tableListeners = new WeakMap<object, Set<() => void>>()

export function subscribeMediaTable(node: unknown, listener: () => void): () => void {
  if (!node || typeof node !== 'object') return () => {}
  let set = tableListeners.get(node)
  if (!set) {
    set = new Set()
    tableListeners.set(node, set)
  }
  set.add(listener)
  return () => set!.delete(listener)
}

function serializeEntry(e: MediaEntry): Record<string, unknown> {
  if (e.src === 'link') return e.from ? { src: 'link', link: e.link, from: e.from } : { src: 'link', link: e.link }
  if (e.src === 'batch') return { src: 'batch', batch_id: e.batch_id, batch_index: e.batch_index }
  return { src: 'asset', asset_id: e.asset_id }
}

export function writeMediaTable(node: unknown, table: MediaTable): void {
  const n = node as { properties?: Record<string, unknown> } | null
  if (!n) return
  if (!n.properties) n.properties = {}
  n.properties[MEDIA_PROP] = {
    image: table.image.map(serializeEntry),
    video: table.video.map(serializeEntry),
    audio: table.audio.map(serializeEntry),
  }
  tableListeners.get(n as object)?.forEach(fn => fn())
}

export function tablesEqual(a: MediaTable, b: MediaTable): boolean {
  return MEDIA_TYPES.every(t =>
    a[t].length === b[t].length && a[t].every((e, i) => e.key === b[t][i]!.key))
}

export interface LiveLink {
  link: number
  slot: number
  inputName: string
  inputIndex: number
  from: [number, number] | null
}

export function hasPlainAudioInput(node: unknown): boolean {
  return !!(node as AnyNode)?.inputs?.some(i => i?.name === 'audio')
}

export function nodeAcceptsMedia(node: unknown, type: MediaType): boolean {
  const inputs = (node as AnyNode)?.inputs
  if (!Array.isArray(inputs)) return false
  return inputs.some(i => typeof i?.name === 'string'
    && (AUTOGROW_KEY_RE[type].test(i.name) || (type === 'audio' && i.name === 'audio')))
}

function lookupLink(graph: AnyGraph, id: number): any {
  const links = graph?.links
  if (!links) return graph?.getLink?.(id) ?? null
  if (typeof links.get === 'function') return links.get(id) ?? null
  return links[id] ?? null
}

export function liveLinks(node: unknown, type: MediaType, graph?: AnyGraph): LiveLink[] {
  const inputs = (node as AnyNode)?.inputs
  if (!Array.isArray(inputs)) return []
  const out: LiveLink[] = []
  inputs.forEach((inp, inputIndex) => {
    if (typeof inp?.name !== 'string' || inp.link == null) return
    let slot: number | null = null
    const m = AUTOGROW_KEY_RE[type].exec(inp.name)
    if (m) slot = Number(m[1])
    else if (type === 'audio' && inp.name === 'audio') slot = 0
    if (slot == null) return
    const link = Number(inp.link)
    const info = graph ? lookupLink(graph, link) : null
    const from: [number, number] | null = info && info.origin_id != null
      ? [Number(info.origin_id), Number(info.origin_slot) || 0]
      : null
    out.push({ link, slot, inputName: inp.name, inputIndex, from })
  })
  return out.sort((a, b) => a.slot - b.slot)
}

export function mediaMax(node: unknown, type: MediaType): number {
  const max = (node as AnyNode)?.comfyDynamic?.autogrow?.[AUTOGROW_GROUP[type]]?.max
  return typeof max === 'number' && max > 0 ? max : DEFAULT_MAX[type]
}

export function positionRemap(prev: MediaEntry[], next: MediaEntry[]): Map<number, number | null> {
  const map = new Map<number, number | null>()
  prev.forEach((e, i) => {
    const j = next.findIndex(n => n.key === e.key)
    if (j !== i) map.set(i + 1, j >= 0 ? j + 1 : null)
  })
  return map
}

function reconcileType(prev: MediaEntry[], live: LiveLink[]): MediaEntry[] {
  const claimed = new Set<number>()
  const next: MediaEntry[] = []
  const seen = new Set<string>()
  for (const e of prev) {
    if (e.src !== 'link') {
      if (!seen.has(e.key)) { seen.add(e.key); next.push(e) }
      continue
    }
    let match = live.find(l => l.link === e.link && !claimed.has(l.link))
    if (!match && e.from) {
      match = live.find(l => !claimed.has(l.link) && l.from != null
        && l.from[0] === e.from![0] && l.from[1] === e.from![1])
    }
    if (!match) continue
    claimed.add(match.link)
    next.push(linkEntry(match))
  }
  for (const l of live) {
    if (claimed.has(l.link)) continue
    claimed.add(l.link)
    next.push(linkEntry(l))
  }
  return next
}

interface LegacyRef { slot: number; type: MediaType; entry: MediaEntry }

function readLegacyRefs(node: unknown): LegacyRef[] | null {
  const raw = (node as AnyNode)?.properties?.[LEGACY_REFS_PROP]
  if (!Array.isArray(raw)) return null
  const out: LegacyRef[] = []
  for (const r of raw as Array<Record<string, unknown>>) {
    const slot = Number(r?.slot)
    if (!Number.isInteger(slot)) continue
    const type: MediaType = r?.type === 'video' || r?.type === 'audio' ? r.type : 'image'
    const batchIndex = Number(r?.batch_index)
    if (Number.isInteger(batchIndex) && batchIndex >= 0) {
      if (typeof r?.batch_id === 'string' && r.batch_id) {
        out.push({ slot, type, entry: batchEntry(r.batch_id, batchIndex) })
      }
      continue
    }
    const id = Number(r?.asset_id)
    if (Number.isInteger(id)) out.push({ slot, type, entry: assetEntry(id) })
  }
  return out
}

function migrateType(
  type: MediaType, live: LiveLink[], refs: LegacyRef[],
): { entries: MediaEntry[]; remap: Map<number, number | null> } {
  const slots = new Set<number>(live.map(l => l.slot))
  for (const r of refs) if (r.type === type) slots.add(r.slot)
  const entries: MediaEntry[] = []
  const remap = new Map<number, number | null>()
  const seen = new Set<string>()
  for (const slot of [...slots].sort((a, b) => a - b)) {
    remap.set(slot, entries.length + 1)
    const wired = live.find(l => l.slot === slot)
    if (wired) entries.push(linkEntry(wired))
    for (const r of refs) {
      if (r.type !== type || r.slot !== slot || seen.has(r.entry.key)) continue
      seen.add(r.entry.key)
      entries.push(r.entry)
    }
  }
  return { entries, remap }
}

export interface ReconcileResult {
  table: MediaTable
  changed: boolean
  remap: PositionRemap
  migrated: boolean
  hadLegacy: boolean
}

export function reconcileTable(node: unknown, graph?: AnyGraph): ReconcileResult {
  const legacy = readLegacyRefs(node)
  const hadTable = hasMediaTable(node)
  const prev = readMediaTable(node)
  const table = emptyTable()
  const remap: PositionRemap = {}

  if (!hadTable) {
    for (const type of MEDIA_TYPES) {
      const m = migrateType(type, liveLinks(node, type, graph), legacy ?? [])
      table[type] = m.entries
      if (legacy && m.remap.size) remap[type] = m.remap
    }
    const migrated = legacy != null && legacy.length > 0
    return { table, changed: true, remap: migrated ? remap : {}, migrated, hadLegacy: legacy != null }
  }

  for (const type of MEDIA_TYPES) {
    let next = reconcileType(prev[type], liveLinks(node, type, graph))
    if (legacy) {
      for (const r of legacy) {
        if (r.type === type && !next.some(e => e.key === r.entry.key)) next = [...next, r.entry]
      }
    }
    table[type] = next
    const m = positionRemap(prev[type], next)
    if (m.size) remap[type] = m
  }
  return { table, changed: !tablesEqual(prev, table), remap, migrated: false, hadLegacy: legacy != null }
}

export function dropLegacyRefs(node: unknown): void {
  const props = (node as AnyNode)?.properties
  if (props && LEGACY_REFS_PROP in props) delete props[LEGACY_REFS_PROP]
}

export function currentMediaTable(node: unknown, graph?: AnyGraph): MediaTable {
  return hasMediaTable(node) ? readMediaTable(node) : reconcileTable(node, graph).table
}

export function moveEntry<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list.slice()
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item!)
  return next
}

export function applyPositions<T>(list: T[], positions: number[]): T[] {
  const n = list.length
  if (positions.length !== n) {
    throw new Error(`expected ${n} positions, got ${positions.length}`)
  }
  const seen = new Set<number>()
  for (const p of positions) {
    if (!Number.isInteger(p) || p < 1 || p > n || seen.has(p)) {
      throw new Error(`positions must be a permutation of 1..${n}`)
    }
    seen.add(p)
  }
  return positions.map(p => list[p - 1]!)
}

export function positionOfLink(table: MediaTable, type: MediaType, link: number): number | null {
  const i = table[type].findIndex(e => e.src === 'link' && e.link === link)
  return i < 0 ? null : i + 1
}

export function positionsOf(table: MediaTable, type: MediaType): number[] {
  return table[type].map((_, i) => i + 1)
}

export function materializeMedia(
  inputs: Record<string, unknown>,
  node: unknown,
  table: MediaTable,
  resolveUrl: (entry: MediaEntry, type: MediaType) => string | null,
): string[] {
  const warnings: string[] = []
  const nodeInputs = (node as AnyNode)?.inputs ?? []
  for (const type of MEDIA_TYPES) {
    if (!nodeAcceptsMedia(node, type)) continue
    const plainAudio = type === 'audio' && hasPlainAudioInput(node)
    const values: unknown[] = []
    table[type].forEach((e, i) => {
      if (e.src === 'link') {
        const inp = nodeInputs.find(x => x?.link != null && Number(x.link) === e.link)
        const key = typeof inp?.name === 'string' ? inp.name : null
        const v = key ? inputs[key] : undefined
        if (v === undefined) {
          warnings.push(`${type} ${i + 1} is wired but its input carries no value — skipped`)
          return
        }
        values.push(v)
        return
      }
      const url = resolveUrl(e, type)
      if (!url) {
        warnings.push(`${type} ${i + 1} (${e.key}) could not be resolved — skipped`)
        return
      }
      values.push(url)
    })
    for (const k of Object.keys(inputs)) {
      if (AUTOGROW_KEY_RE[type].test(k) || (plainAudio && k === 'audio')) delete inputs[k]
    }
    if (plainAudio) {
      if (values.length > 0) inputs.audio = values[0]
      if (values.length > 1) warnings.push('this stage takes a single audio input — only audio 1 is sent')
      continue
    }
    const max = mediaMax(node, type)
    if (values.length > max) {
      warnings.push(`this stage accepts at most ${max} ${type} inputs — ${values.length - max} dropped`)
    }
    values.slice(0, max).forEach((v, i) => { inputs[autogrowKey(type, i)] = v })
  }
  return warnings
}
