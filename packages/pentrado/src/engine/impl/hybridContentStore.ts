import type { ContentEdit, ContentEntry, ContentStore, RenderSource } from '../content'
import { generateId } from '../id'
import { deriveGrid, isBlankGrid, releaseGrid, residentTileBytes, tileifyPixels, uniformGrid, type TileData, type TileGrid, type TileRegion } from '../tile/tileBuffer'
import type { SwapClient } from '../tile/swapClient'
import * as budget from './hybridBudget'
import * as mips from './hybridMips'
import * as swap from './hybridSwap'
import {
  createStoreState,
  gridComplete,
  singleUniform,
  TILE_THRESHOLD_PX,
  type StoreState,
  type TiledRecord,
} from './hybridTypes'
import { idleMs, pressureLevel } from './memoryPressure'

export { TILE_THRESHOLD_PX, MAX_MIP_LEVEL, PROXY_MIP_LEVEL } from './hybridTypes'
export { HEADROOM_WAIT_MS, pageResidentTileBytes, waitForBudgetHeadroom, __resetStoreRegistryForTests } from './hybridBudget'

export class HybridContentStore implements ContentStore {
  private readonly st: StoreState = createStoreState()
  private registeredGlobally = false
  private disposed = false

  constructor() {
    this.st.enforce = () => this.enforceBudget()
  }

  configureSwap(opts: {
    swap: SwapClient | null
    onRestored?: () => void
    tileBudgetBytes?: number
    hardLimitBytes?: number
    schedule?: (fn: () => void) => void
  }): void {
    const st = this.st
    st.swap = opts.swap
    st.onRestored = opts.onRestored ?? null
    st.schedule = opts.schedule ?? null
    if (opts.tileBudgetBytes != null) st.tileBudget = opts.tileBudgetBytes
    if (opts.hardLimitBytes != null) st.hardLimit = opts.hardLimitBytes
    if (st.swap && !this.registeredGlobally) {
      this.registeredGlobally = true
      budget.registerStore(this)
    }
    if (!st.swap) {
      for (const q of st.readQueue) q.t.swapPending = false
      for (const q of st.writeQueue) q.t.swapPending = false
      st.readQueue = []
      st.writeQueue = []
    }
  }

  hardLimitBytes(): number {
    return this.st.hardLimit
  }

  setTileBudget(bytes: number): void {
    this.st.tileBudget = bytes
  }

  hasSwap(): boolean {
    return this.st.swap != null
  }

  private makeTiledRecord(
    id: string,
    grid: TileGrid,
    uploadedUrl: string | null,
    material: HTMLCanvasElement | null = null,
    materialComplete = false
  ): TiledRecord {
    return {
      kind: 'tiled',
      grid,
      material,
      materialComplete,
      materialVersion: 1,
      materialDirty: null,
      mips: new Map(),
      thumb: null,
      thumbComplete: false,
      entry: this.makeTiledEntry(id, grid, uploadedUrl),
    }
  }

  register(
    canvas: HTMLCanvasElement,
    opts?: {
      id?: string
      uploadedUrl?: string
      uniform?: [number, number, number, number]
      pixels?: Uint8ClampedArray
      transient?: boolean
    }
  ): string {
    const st = this.st
    const id = opts?.id ?? generateId('content')
    const w = canvas.width
    const h = canvas.height
    if (opts?.transient || w * h < TILE_THRESHOLD_PX) {
      st.records.set(id, {
        kind: 'plain',
        entry: { id, canvas, width: w, height: h, uploadedUrl: opts?.uploadedUrl ?? null },
      })
      return id
    }
    let grid: TileGrid | null = null
    if (opts?.uniform) {
      const [r, g, b, a] = opts.uniform
      grid = uniformGrid(w, h, st.pool, r, g, b, a)
    } else {
      const data = opts?.pixels ?? canvas.getContext('2d')?.getImageData(0, 0, w, h).data
      if (data) grid = tileifyPixels(data, w, h, st.pool)
    }
    if (!grid) {
      st.records.set(id, {
        kind: 'plain',
        entry: { id, canvas, width: w, height: h, uploadedUrl: opts?.uploadedUrl ?? null },
      })
      return id
    }
    const allUniform = singleUniform(grid) != null
    const rec = this.makeTiledRecord(id, grid, opts?.uploadedUrl ?? null, allUniform ? null : canvas, !allUniform)
    st.records.set(id, rec)
    budget.scheduleEnforce(st)
    return id
  }

  private makeTiledEntry(id: string, grid: TileGrid, uploadedUrl: string | null): ContentEntry {
    const st = this.st
    const entry = {
      id,
      width: grid.width,
      height: grid.height,
      uploadedUrl,
      isBlank: isBlankGrid(grid),
      get canvas(): HTMLCanvasElement {
        return mips.materialize(st, id)
      },
    }
    return entry as ContentEntry
  }

  exportCanvas(id: string): HTMLCanvasElement | null {
    return mips.exportCanvas(this.st, id)
  }

  trim(pinned: Set<string>, keepMaterial?: Set<string>): void {
    const keep = keepMaterial ?? pinned
    for (const [id, rec] of this.st.records) {
      if (rec.kind === 'tiled' && rec.material && !keep.has(id)) {
        rec.material = null
        rec.materialComplete = false
      }
    }
    this.st.lastPinned = new Set(pinned)
    this.enforceBudget()
  }

  residentBytesOwn(): number {
    const grids: TileGrid[] = []
    for (const rec of this.st.records.values()) if (rec.kind === 'tiled') grids.push(rec.grid)
    return residentTileBytes(grids)
  }

  enforceBudget(): void {
    budget.enforceBudget(this.st, this)
  }

  suspendAll(): void {
    budget.suspendAll(this.st)
  }

  resumePrefetch(): void {
    budget.resumePrefetch(this.st)
  }

  isFullyResident(id: string): boolean {
    const rec = this.st.records.get(id)
    if (!rec) return false
    if (rec.kind === 'plain') return true
    return gridComplete(rec.grid)
  }

  restoreAll(ids?: string[]): Promise<void> {
    return swap.restoreAll(this.st, ids)
  }

  derive(baseId: string, edits: ContentEdit[], opts?: { uploadedUrl?: string }): string | null {
    const st = this.st
    const base = st.records.get(baseId)
    if (!base || base.kind !== 'tiled') return null
    const grid = deriveGrid(base.grid, edits, st.pool)
    const id = generateId('content')
    let material: HTMLCanvasElement | null = null
    let materialComplete = false
    if (base.material) {
      material = base.material
      materialComplete = base.materialComplete
      base.material = null
      base.materialComplete = false
      const g = material.getContext('2d')
      if (g) {
        for (const e of edits) {
          g.putImageData(new ImageData(e.pixels as Uint8ClampedArray<ArrayBuffer>, e.w, e.h), e.x, e.y)
        }
      } else {
        material = null
        materialComplete = false
      }
    }
    const rec = this.makeTiledRecord(id, grid, opts?.uploadedUrl ?? null, material, materialComplete)
    st.records.set(id, rec)
    budget.scheduleEnforce(st)
    return id
  }

  registerUniform(width: number, height: number, rgba: [number, number, number, number]): string {
    if (width * height < TILE_THRESHOLD_PX) {
      const c = document.createElement('canvas')
      c.width = width
      c.height = height
      const g = c.getContext('2d')
      if (g && rgba[3] > 0) {
        g.fillStyle = `rgba(${rgba[0]},${rgba[1]},${rgba[2]},${rgba[3] / 255})`
        g.fillRect(0, 0, width, height)
      }
      return this.register(c)
    }
    const id = generateId('content')
    const grid = uniformGrid(width, height, this.st.pool, rgba[0], rgba[1], rgba[2], rgba[3])
    this.st.records.set(id, this.makeTiledRecord(id, grid, null))
    return id
  }

  tileGridOf(id: string, region?: TileRegion | null): TileGrid | null {
    return budget.tileGridOf(this.st, id, region)
  }

  residencyOf(id: string): number {
    const rec = this.st.records.get(id)
    return rec?.kind === 'tiled' ? (rec.grid.residency ?? 0) : 0
  }

  proxyTile(id: string, index: number): Uint8Array | null {
    return mips.proxyTile(this.st, id, index)
  }

  reclaimIdle(): void {
    budget.reclaimIdle(this.st)
  }

  renderSource(id: string, scale: number): RenderSource | null {
    return mips.renderSource(this.st, id, scale)
  }

  alphaAt(id: string, x: number, y: number): number | null {
    return mips.alphaAt(this.st, id, x, y)
  }

  thumbnailCanvas(id: string, maxDim: number): HTMLCanvasElement | null {
    return mips.thumbnailCanvas(this.st, id, maxDim)
  }

  dropMaterials(keep: Set<string>): number {
    let freed = 0
    for (const [id, rec] of this.st.records) {
      if (rec.kind !== 'tiled' || !rec.material || keep.has(id)) continue
      freed += rec.material.width * rec.material.height * 4
      rec.material = null
      rec.materialComplete = false
    }
    return freed
  }

  get(id: string): ContentEntry | undefined {
    return this.st.records.get(id)?.entry
  }

  has(id: string): boolean {
    return this.st.records.has(id)
  }

  dirtyIds(): string[] {
    const out: string[] = []
    for (const r of this.st.records.values()) if (r.entry.uploadedUrl === null) out.push(r.entry.id)
    return out
  }

  markUploaded(id: string, url: string): void {
    const r = this.st.records.get(id)
    if (r) r.entry.uploadedUrl = url
  }

  collectGarbage(liveIds: Set<string>): void {
    const st = this.st
    for (const [id, rec] of [...st.records]) {
      if (liveIds.has(id)) continue
      if (rec.kind === 'tiled') this.releaseTiles(releaseGrid(rec.grid, st.pool))
      st.records.delete(id)
    }
  }

  isDisposed(): boolean {
    return this.disposed
  }

  dispose(): void {
    const st = this.st
    this.disposed = true
    for (const rec of st.records.values()) {
      if (rec.kind === 'tiled') this.releaseTiles(releaseGrid(rec.grid, st.pool))
    }
    st.records.clear()
    st.pool.clear()
    st.readQueue = []
    st.writeQueue = []
    st.lastPinned = null
    st.swap = null
    st.onRestored = null
  }

  protected releaseTiles(dead: TileData[]): void {
    swap.releaseTiles(this.st, dead)
  }

  totalBytes(): number {
    let n = 0
    const grids: TileGrid[] = []
    for (const r of this.st.records.values()) {
      if (r.kind === 'plain') {
        n += r.entry.width * r.entry.height * 4
      } else {
        grids.push(r.grid)
        if (r.material) n += r.material.width * r.material.height * 4
      }
    }
    return n + residentTileBytes(grids)
  }

  stats(): {
    plain: number
    tiled: number
    tileBytes: number
    materialBytes: number
    poolSize: number
    swappedOut: number
    queuedReads: number
    queuedWrites: number
    inflightReads: number
    inflightWrites: number
    residentByBin: [number, number, number]
    idleMs: number
    pressure: number
  } {
    const st = this.st
    const residentByBin: [number, number, number] = [0, 0, 0]
    let plain = 0
    let tiled = 0
    let materialBytes = 0
    let swappedOut = 0
    const grids: TileGrid[] = []
    const seen = new Set<TileData>()
    for (const r of st.records.values()) {
      if (r.kind === 'plain') {
        plain++
      } else {
        tiled++
        grids.push(r.grid)
        if (r.material) materialBytes += r.material.width * r.material.height * 4
        for (const t of r.grid.tiles) {
          if (!seen.has(t)) {
            seen.add(t)
            if (t.swapId >= 0 && !t.bytes) swappedOut++
            if (t.bytes) residentByBin[Math.min(2, Math.max(0, t.bin))]++
          }
        }
      }
    }
    return {
      plain,
      tiled,
      tileBytes: residentTileBytes(grids),
      materialBytes,
      poolSize: st.pool.size,
      swappedOut,
      queuedReads: st.readQueue.length,
      queuedWrites: st.writeQueue.length,
      inflightReads: st.inflightReads,
      inflightWrites: st.inflightWrites,
      residentByBin,
      idleMs: Math.round(idleMs()),
      pressure: pressureLevel(),
    }
  }
}
