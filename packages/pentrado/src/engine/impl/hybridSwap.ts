import { nextGen, TILE_SIZE, type TileData, type TileGrid } from '../tile/tileBuffer'
import { scheduleEnforce } from './hybridBudget'
import { patchScaled } from './hybridMips'
import {
  clampedView,
  gridComplete,
  MAX_INFLIGHT_READS,
  MAX_INFLIGHT_WRITES,
  tileRect,
  type StoreState,
} from './hybridTypes'

export function ensureResident(st: StoreState, grid: TileGrid, tiles?: Iterable<TileData>): boolean {
  let complete = true
  for (const t of new Set(tiles ?? grid.tiles)) {
    if (t.bytes || t.uniform) continue
    complete = false
    if (t.swapId < 0 || t.swapPending || !st.swap) continue
    t.swapPending = true
    st.readQueue.push({ t, slot: t.swapId })
  }
  pumpIO(st)
  return complete
}

export function pumpIO(st: StoreState): void {
  while (st.swap && st.inflightReads < MAX_INFLIGHT_READS && st.readQueue.length) {
    startRead(st, st.readQueue.shift()!)
  }
  while (st.swap && st.inflightWrites < MAX_INFLIGHT_WRITES && st.writeQueue.length) {
    startWrite(st, st.writeQueue.shift()!)
  }
}

function startRead(st: StoreState, req: { t: TileData; slot: number }): void {
  const { t, slot } = req
  if (t.refs <= 0 || t.bytes || t.swapId !== slot) {
    t.swapPending = false
    return
  }
  st.inflightReads += 1
  st.swap!.read(slot)
    .then((bytes) => {
      st.inflightReads -= 1
      t.swapPending = false
      if (t.refs <= 0 || t.bytes) {
        st.swap?.free(slot)
        pumpIO(st)
        return
      }
      t.bytes = bytes
      t.gen = nextGen()
      t.swapId = -1
      st.swap?.free(slot)
      st.restoredBatch.add(t)
      scheduleFlush(st)
      pumpIO(st)
    })
    .catch(() => {
      st.inflightReads -= 1
      t.swapPending = false
      scheduleFlush(st)
      pumpIO(st)
    })
}

function startWrite(st: StoreState, req: { t: TileData; gen: number }): void {
  const { t, gen } = req
  if (t.refs <= 0 || !t.bytes || t.gen !== gen) {
    t.swapPending = false
    return
  }
  const bytes = t.bytes
  st.inflightWrites += 1
  st.swap!.write(bytes)
    .then((slot) => {
      st.inflightWrites -= 1
      t.swapPending = false
      if (t.refs <= 0 || t.bytes !== bytes || t.gen !== gen) {
        st.swap?.free(slot)
        pumpIO(st)
        return
      }
      t.swapId = slot
      t.bytes = null
      pumpIO(st)
    })
    .catch(() => {
      st.inflightWrites -= 1
      t.swapPending = false
      pumpIO(st)
    })
}

function scheduleFlush(st: StoreState): void {
  if (st.flushScheduled) return
  st.flushScheduled = true
  const run = () => {
    st.flushScheduled = false
    flushRestored(st)
  }
  if (st.schedule) st.schedule(run)
  else if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run)
  else setTimeout(run, 16)
}

function flushRestored(st: StoreState): void {
  const batch = st.restoredBatch
  st.restoredBatch = new Set()
  if (batch.size === 0) {
    const waiters = st.afterFlushWaiters
    st.afterFlushWaiters = []
    for (const w of waiters) w()
    return
  }
  for (const rec of st.records.values()) {
    if (rec.kind !== 'tiled') continue
    let touched: number[] | null = null
    for (let i = 0; i < rec.grid.tiles.length; i++) {
      if (batch.has(rec.grid.tiles[i])) (touched ??= []).push(i)
    }
    if (!touched) continue
    rec.grid.residency = (rec.grid.residency ?? 0) + 1
    const rects = touched.map((i) => tileRect(rec.grid, i))
    if (rec.material) {
      const g = rec.material.getContext('2d')
      if (g) {
        for (const i of touched) {
          const t = rec.grid.tiles[i]
          if (!t.bytes) continue
          const r = tileRect(rec.grid, i)
          g.putImageData(new ImageData(clampedView(t.bytes), TILE_SIZE, TILE_SIZE), r.x, r.y, 0, 0, r.w, r.h)
        }
        rec.materialVersion += 1
        rec.materialDirty = rects
        if (!rec.materialComplete) rec.materialComplete = gridComplete(rec.grid)
      } else {
        rec.material = null
        rec.materialComplete = false
      }
    }
    for (const [level, mip] of rec.mips) {
      const scale = 1 / (1 << level)
      if (patchScaled(st, rec.grid, touched, mip.canvas, scale)) {
        mip.version += 1
        mip.dirty = rects.map((r) => ({
          x: Math.floor(r.x * scale),
          y: Math.floor(r.y * scale),
          w: Math.ceil(r.w * scale) + 1,
          h: Math.ceil(r.h * scale) + 1,
        }))
        if (!mip.complete) mip.complete = gridComplete(rec.grid)
      } else {
        rec.mips.delete(level)
      }
    }
    if (rec.thumb && !rec.thumbComplete) rec.thumb = null
  }
  scheduleEnforce(st)
  const waiters = st.afterFlushWaiters
  st.afterFlushWaiters = []
  for (const w of waiters) w()
  st.onRestored?.()
}

export function swapOut(st: StoreState, t: TileData): void {
  t.swapPending = true
  st.writeQueue.push({ t, gen: t.gen })
  pumpIO(st)
}

export async function restoreAll(st: StoreState, ids?: string[]): Promise<void> {
  for (let rounds = 0; rounds < 100; rounds++) {
    let complete = true
    const recs = ids ? ids.map((id) => st.records.get(id)) : [...st.records.values()]
    for (const rec of recs) {
      if (rec?.kind === 'tiled' && !ensureResident(st, rec.grid)) complete = false
    }
    if (complete || !st.swap) return
    if (st.inflightReads === 0 && st.readQueue.length === 0) return
    await new Promise<void>((r) => st.afterFlushWaiters.push(r))
  }
}

export function releaseTiles(st: StoreState, dead: TileData[]): void {
  for (const t of dead) {
    t.bytes = null
    if (t.swapId >= 0) {
      st.swap?.free(t.swapId)
      t.swapId = -1
    }
  }
}
