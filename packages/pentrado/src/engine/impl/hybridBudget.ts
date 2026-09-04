import {
  nextGen,
  TILE_BIN_EVENTUALLY,
  TILE_BIN_NOW,
  TILE_BIN_SOON,
  TILE_SIZE,
  tileIndexesIn,
  type TileData,
  type TileGrid,
  type TileRegion,
} from '../tile/tileBuffer'
import { ensureResident, restoreAll, swapOut } from './hybridSwap'
import { mipEntry } from './hybridMips'
import { gridComplete, pinnedTileSet, PROXY_MIP_LEVEL, type StoreState } from './hybridTypes'
import { IDLE_SLEEP_MS, IDLE_TRIM_MS, idleMs, pressureScale } from './memoryPressure'

export interface BudgetStore {
  isDisposed(): boolean
  enforceBudget(): void
  reclaimIdle(): void
  residentBytesOwn(): number
  hardLimitBytes(): number
}

const storeRegistry = new Set<WeakRef<BudgetStore>>()
let globalTickScheduled = false

export function registerStore(store: BudgetStore): void {
  storeRegistry.add(new WeakRef(store))
}

export function liveStores(): BudgetStore[] {
  const out: BudgetStore[] = []
  for (const ref of [...storeRegistry]) {
    const s = ref.deref()
    if (!s || s.isDisposed()) storeRegistry.delete(ref)
    else out.push(s)
  }
  return out
}

export function scheduleGlobalEnforce(): void {
  if (globalTickScheduled) return
  globalTickScheduled = true
  setTimeout(() => {
    globalTickScheduled = false
    const stores = liveStores()
    for (const s of stores) {
      s.enforceBudget()
      s.reclaimIdle()
    }
    if (stores.length) scheduleGlobalEnforce()
  }, 1000)
}

export const HEADROOM_WAIT_MS = 2000

export function pageResidentTileBytes(): number {
  let n = 0
  for (const s of liveStores()) n += s.residentBytesOwn()
  return n
}

export function waitForBudgetHeadroom(limitBytes?: number, maxWaitMs = HEADROOM_WAIT_MS): Promise<void> {
  const stores = liveStores()
  const limit = limitBytes ?? Math.max(...stores.map((s) => s.hardLimitBytes()), 0)
  if (!stores.length || !limit || pageResidentTileBytes() < limit) return Promise.resolve()
  for (const s of stores) s.enforceBudget()
  return new Promise<void>((resolve) => {
    const deadline = Date.now() + maxWaitMs
    const check = (): void => {
      if (pageResidentTileBytes() < limit || Date.now() >= deadline) {
        resolve()
        return
      }
      setTimeout(check, 50)
    }
    setTimeout(check, 50)
  })
}

export function __resetStoreRegistryForTests(): void {
  storeRegistry.clear()
}

export function enforceBudget(st: StoreState, self: BudgetStore): void {
  const pinned = st.lastPinned
  if (!st.swap || !pinned) return
  const pinnedTiles = new Set<TileData>()
  for (const id of pinned) {
    const r = st.records.get(id)
    if (r?.kind === 'tiled') for (const t of r.grid.tiles) pinnedTiles.add(t)
  }
  const seen = new Set<TileData>()
  const cold: TileData[] = []
  const hot: TileData[] = []
  let resident = 0
  let pendingOut = 0
  for (const rec of st.records.values()) {
    if (rec.kind !== 'tiled') continue
    for (const t of rec.grid.tiles) {
      if (!t.bytes || seen.has(t)) continue
      seen.add(t)
      resident += t.bytes.byteLength
      if (t.swapPending) pendingOut += t.bytes.byteLength
      if (pinnedTiles.has(t) || t.swapPending) continue
      ;(t.gen <= st.coldMark ? cold : hot).push(t)
    }
  }
  st.coldMark = nextGen()
  let others = 0
  for (const s of liveStores()) if (s !== self) others += s.residentBytesOwn()
  const scale = pressureScale()
  const byBinThenAge = (a: TileData, b: TileData) => (b.bin - a.bin) || (a.gen - b.gen)
  const softAllowance = Math.max(0, st.tileBudget * scale - others)
  if (resident > softAllowance) {
    cold.sort(byBinThenAge)
    let excess = resident - softAllowance
    for (const t of cold) {
      if (excess <= 0) break
      excess -= t.bytes!.byteLength
      resident -= t.bytes!.byteLength
      swapOut(st, t)
    }
  }
  const hardAllowance = Math.max(0, st.hardLimit * scale - others)
  if (resident > hardAllowance) {
    hot.sort(byBinThenAge)
    let excess = resident - hardAllowance
    for (const t of hot) {
      if (excess <= 0) break
      excess -= t.bytes!.byteLength
      resident -= t.bytes!.byteLength
      swapOut(st, t)
    }
    if (resident - pendingOut > hardAllowance) warnOverLimit(st, resident - pendingOut, hardAllowance)
  }
  if (resident > softAllowance && hot.length > 0) scheduleEnforce(st)
}

function warnOverLimit(st: StoreState, resident: number, allowance: number): void {
  const t = Date.now()
  if (t - st.lastWarn < 10_000) return
  st.lastWarn = t
  const mb = (n: number) => (n / 1048576) | 0
  console.warn('[pentrado] pinned tiles hold ' + mb(resident) + 'MB against a ' + mb(allowance) + 'MB limit; offscreen layers render from proxies until memory frees')
}

export function scheduleEnforce(st: StoreState): void {
  if (st.enforceScheduled) return
  st.enforceScheduled = true
  setTimeout(() => {
    st.enforceScheduled = false
    st.enforce()
  }, 1000)
  scheduleGlobalEnforce()
}

export function suspendAll(st: StoreState): void {
  if (!st.swap) return
  const pinnedTiles = pinnedTileSet(st)
  const seen = new Set<TileData>()
  for (const rec of st.records.values()) {
    if (rec.kind !== 'tiled') continue
    if (rec.material) {
      rec.material = null
      rec.materialComplete = false
    }
    for (const t of rec.grid.tiles) {
      if (!t.bytes || seen.has(t) || t.swapPending || pinnedTiles.has(t)) continue
      seen.add(t)
      swapOut(st, t)
    }
  }
}

export function resumePrefetch(st: StoreState): void {
  if (st.lastPinned?.size) void restoreAll(st, [...st.lastPinned])
}

export function reclaimIdle(st: StoreState): void {
  const idle = idleMs()
  if (idle < IDLE_TRIM_MS || !st.swap) return
  const pinnedTiles = pinnedTileSet(st)
  const seen = new Set<TileData>()
  for (const [id, rec] of st.records) {
    if (rec.kind !== 'tiled') continue
    if (idle >= IDLE_SLEEP_MS && rec.material && !st.lastPinned?.has(id)) {
      rec.material = null
      rec.materialComplete = false
    }
    for (const t of rec.grid.tiles) {
      if (!t.bytes || seen.has(t) || t.swapPending || pinnedTiles.has(t)) continue
      if (idle < IDLE_SLEEP_MS && t.bin !== TILE_BIN_EVENTUALLY) continue
      seen.add(t)
      swapOut(st, t)
    }
  }
}

export function tileGridOf(st: StoreState, id: string, region?: TileRegion | null): TileGrid | null {
  const rec = st.records.get(id)
  if (!rec || rec.kind !== 'tiled') return null
  const grid = rec.grid
  const gen = nextGen()
  const now = region ? tileIndexesIn(grid, region) : null
  const soon = region ? tileIndexesIn(grid, region, TILE_SIZE) : null
  const wanted: TileData[] = []
  for (let i = 0; i < grid.tiles.length; i++) {
    const t = grid.tiles[i]
    const c = i % grid.cols
    const r = (i / grid.cols) | 0
    let bin = TILE_BIN_NOW
    if (region) {
      bin = TILE_BIN_EVENTUALLY
      if (soon && c >= soon.c0 && c <= soon.c1 && r >= soon.r0 && r <= soon.r1) bin = TILE_BIN_SOON
      if (now && c >= now.c0 && c <= now.c1 && r >= now.r0 && r <= now.r1) bin = TILE_BIN_NOW
    }
    if (bin === TILE_BIN_EVENTUALLY) {
      if (t.gen !== gen) t.bin = TILE_BIN_EVENTUALLY
      continue
    }
    t.bin = t.gen === gen ? Math.min(t.bin, bin) : bin
    t.gen = gen
    wanted.push(t)
  }
  ensureResident(st, grid, wanted)
  if (!rec.mips.has(PROXY_MIP_LEVEL) && gridComplete(grid)) mipEntry(st, rec, PROXY_MIP_LEVEL)
  return grid
}
