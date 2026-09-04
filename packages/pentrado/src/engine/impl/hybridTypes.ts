import type { ContentEntry } from '../content'
import type { Rect } from '../node'
import type { SwapClient } from '../tile/swapClient'
import { TILE_SIZE, type TileData, type TileGrid, type UniformPool } from '../tile/tileBuffer'

export const TILE_THRESHOLD_PX = 2048 * 2048
export const MAX_MIP_LEVEL = 4
export const PROXY_MIP_LEVEL = 3
export const MAX_INFLIGHT_READS = 64
export const MAX_INFLIGHT_WRITES = 64

export interface PlainRecord {
  kind: 'plain'
  entry: ContentEntry
}

export interface MipEntry {
  canvas: HTMLCanvasElement
  complete: boolean
  version: number
  dirty: Rect[] | null
}

export interface TiledRecord {
  kind: 'tiled'
  entry: ContentEntry
  grid: TileGrid
  material: HTMLCanvasElement | null
  materialComplete: boolean
  materialVersion: number
  materialDirty: Rect[] | null
  mips: Map<number, MipEntry>
  thumb: HTMLCanvasElement | null
  thumbComplete: boolean
}

export type Record_ = PlainRecord | TiledRecord

export interface StoreState {
  records: Map<string, Record_>
  pool: UniformPool
  swap: SwapClient | null
  onRestored: (() => void) | null
  schedule: ((fn: () => void) => void) | null
  tileBudget: number
  hardLimit: number
  coldMark: number
  lastPinned: Set<string> | null
  readQueue: Array<{ t: TileData; slot: number }>
  writeQueue: Array<{ t: TileData; gen: number }>
  inflightReads: number
  inflightWrites: number
  restoredBatch: Set<TileData>
  flushScheduled: boolean
  enforceScheduled: boolean
  afterFlushWaiters: Array<() => void>
  lastWarn: number
  scratch: HTMLCanvasElement | null
  enforce: () => void
}

export function createStoreState(): StoreState {
  return {
    records: new Map(),
    pool: new Map(),
    swap: null,
    onRestored: null,
    schedule: null,
    tileBudget: 512 * 1024 * 1024,
    hardLimit: 1024 * 1024 * 1024,
    coldMark: 0,
    lastPinned: null,
    readQueue: [],
    writeQueue: [],
    inflightReads: 0,
    inflightWrites: 0,
    restoredBatch: new Set(),
    flushScheduled: false,
    enforceScheduled: false,
    afterFlushWaiters: [],
    lastWarn: 0,
    scratch: null,
    enforce: () => {},
  }
}

export function singleUniform(grid: TileGrid): Uint8Array | null {
  const first = grid.tiles[0]
  if (!first.uniform) return null
  for (const t of grid.tiles) if (t !== first) return null
  return first.uniform
}

export function clampedView(bytes: Uint8Array): Uint8ClampedArray<ArrayBuffer> {
  return new Uint8ClampedArray(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength)
}

export function tileRect(grid: TileGrid, index: number): Rect {
  const x = (index % grid.cols) * TILE_SIZE
  const y = ((index / grid.cols) | 0) * TILE_SIZE
  return { x, y, w: Math.min(TILE_SIZE, grid.width - x), h: Math.min(TILE_SIZE, grid.height - y) }
}

export function gridComplete(grid: TileGrid): boolean {
  for (const t of grid.tiles) if (!t.bytes && !t.uniform) return false
  return true
}

export function pinnedTileSet(st: StoreState): Set<TileData> {
  const out = new Set<TileData>()
  for (const id of st.lastPinned ?? []) {
    const r = st.records.get(id)
    if (r?.kind === 'tiled') for (const t of r.grid.tiles) out.add(t)
  }
  return out
}
