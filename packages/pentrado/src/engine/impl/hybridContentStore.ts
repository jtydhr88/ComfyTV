import type { ContentEdit, ContentEntry, ContentStore, RenderSource } from '../content'
import { generateId } from '../id'
import type { Rect } from '../node'
import type { SwapClient } from '../tile/swapClient'
import {
  deriveGrid,
  gatherPixels,
  isBlankGrid,
  nextGen,
  releaseGrid,
  residentTileBytes,
  TILE_SIZE,
  tileifyPixels,
  uniformGrid,
  type TileData,
  type TileGrid,
  type UniformPool,
} from '../tile/tileBuffer'

export const TILE_THRESHOLD_PX = 2048 * 2048

export const MAX_MIP_LEVEL = 4

const MAX_INFLIGHT_READS = 64
const MAX_INFLIGHT_WRITES = 64

interface PlainRecord {
  kind: 'plain'
  entry: ContentEntry
}

interface MipEntry {
  canvas: HTMLCanvasElement
  complete: boolean
  version: number
  dirty: Rect[] | null
}

interface TiledRecord {
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

type Record_ = PlainRecord | TiledRecord

function singleUniform(grid: TileGrid): Uint8Array | null {
  const first = grid.tiles[0]
  if (!first.uniform) return null
  for (const t of grid.tiles) if (t !== first) return null
  return first.uniform
}

function clampedView(bytes: Uint8Array): Uint8ClampedArray<ArrayBuffer> {
  return new Uint8ClampedArray(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength)
}

function tileRect(grid: TileGrid, index: number): Rect {
  const x = (index % grid.cols) * TILE_SIZE
  const y = ((index / grid.cols) | 0) * TILE_SIZE
  return { x, y, w: Math.min(TILE_SIZE, grid.width - x), h: Math.min(TILE_SIZE, grid.height - y) }
}

export class HybridContentStore implements ContentStore {
  private records = new Map<string, Record_>()
  private pool: UniformPool = new Map()
  private swap: SwapClient | null = null
  private onRestored: (() => void) | null = null
  private schedule: ((fn: () => void) => void) | null = null
  private tileBudget = 512 * 1024 * 1024

  private coldMark = 0

  private readQueue: Array<{ t: TileData; slot: number }> = []
  private writeQueue: Array<{ t: TileData; gen: number }> = []
  private inflightReads = 0
  private inflightWrites = 0

  private restoredBatch = new Set<TileData>()
  private flushScheduled = false

  configureSwap(opts: {
    swap: SwapClient | null
    onRestored?: () => void
    tileBudgetBytes?: number
    schedule?: (fn: () => void) => void
  }): void {
    this.swap = opts.swap
    this.onRestored = opts.onRestored ?? null
    this.schedule = opts.schedule ?? null
    if (opts.tileBudgetBytes != null) this.tileBudget = opts.tileBudgetBytes
    if (!this.swap) {
      for (const q of this.readQueue) q.t.swapPending = false
      for (const q of this.writeQueue) q.t.swapPending = false
      this.readQueue = []
      this.writeQueue = []
    }
  }

  setTileBudget(bytes: number): void {
    this.tileBudget = bytes
  }

  hasSwap(): boolean {
    return this.swap != null
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
    const id = opts?.id ?? generateId('content')
    const w = canvas.width
    const h = canvas.height
    if (opts?.transient || w * h < TILE_THRESHOLD_PX) {
      this.records.set(id, {
        kind: 'plain',
        entry: { id, canvas, width: w, height: h, uploadedUrl: opts?.uploadedUrl ?? null },
      })
      return id
    }
    let grid: TileGrid | null = null
    if (opts?.uniform) {
      const [r, g, b, a] = opts.uniform
      grid = uniformGrid(w, h, this.pool, r, g, b, a)
    } else {
      const data = opts?.pixels ?? canvas.getContext('2d')?.getImageData(0, 0, w, h).data
      if (data) grid = tileifyPixels(data, w, h, this.pool)
    }
    if (!grid) {

      this.records.set(id, {
        kind: 'plain',
        entry: { id, canvas, width: w, height: h, uploadedUrl: opts?.uploadedUrl ?? null },
      })
      return id
    }
    const allUniform = singleUniform(grid) != null
    const rec = this.makeTiledRecord(id, grid, opts?.uploadedUrl ?? null, allUniform ? null : canvas, !allUniform)
    this.records.set(id, rec)
    return id
  }

  private makeTiledEntry(id: string, grid: TileGrid, uploadedUrl: string | null): ContentEntry {
    const store = this
    const entry = {
      id,
      width: grid.width,
      height: grid.height,
      uploadedUrl,
      isBlank: isBlankGrid(grid),
      get canvas(): HTMLCanvasElement {
        return store.materialize(id)
      },
    }
    return entry as ContentEntry
  }

  private materialize(id: string): HTMLCanvasElement {
    const rec = this.records.get(id)
    if (!rec || rec.kind !== 'tiled') throw new Error(`materialize: not tiled: ${id}`)
    if (rec.material) return rec.material
    const complete = this.ensureResident(rec.grid)
    const canvas = this.buildDense(rec.grid)
    rec.material = canvas
    rec.materialComplete = complete
    rec.materialVersion += 1
    rec.materialDirty = null
    return canvas
  }

  private buildDense(grid: TileGrid): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = grid.width
    canvas.height = grid.height
    const g = canvas.getContext('2d')
    if (g) {
      const uni = singleUniform(grid)
      if (uni) {
        if (uni[3] !== 0 || uni[0] !== 0 || uni[1] !== 0 || uni[2] !== 0) {
          g.fillStyle = `rgba(${uni[0]},${uni[1]},${uni[2]},${uni[3] / 255})`
          g.fillRect(0, 0, canvas.width, canvas.height)
        }
      } else {
        const pixels = gatherPixels(grid) as Uint8ClampedArray<ArrayBuffer>
        g.putImageData(new ImageData(pixels, grid.width, grid.height), 0, 0)
      }
    }
    return canvas
  }

  /** Transient dense canvas for one-shot export paths — never cached. */
  exportCanvas(id: string): HTMLCanvasElement | null {
    const rec = this.records.get(id)
    if (!rec) return null
    if (rec.kind === 'plain') return rec.entry.canvas
    if (rec.material && rec.materialComplete) return rec.material
    this.ensureResident(rec.grid)
    return this.buildDense(rec.grid)
  }

  /** Kick async restores for swapped-out tiles; true when everything is resident. */
  private ensureResident(grid: TileGrid): boolean {
    let complete = true
    for (const t of new Set(grid.tiles)) {
      if (t.bytes || t.uniform) continue
      complete = false
      if (t.swapId < 0 || t.swapPending || !this.swap) continue
      t.swapPending = true
      this.readQueue.push({ t, slot: t.swapId })
    }
    this.pumpIO()
    return complete
  }

  private pumpIO(): void {
    while (this.swap && this.inflightReads < MAX_INFLIGHT_READS && this.readQueue.length) {
      this.startRead(this.readQueue.shift()!)
    }
    while (this.swap && this.inflightWrites < MAX_INFLIGHT_WRITES && this.writeQueue.length) {
      this.startWrite(this.writeQueue.shift()!)
    }
  }

  private startRead(req: { t: TileData; slot: number }): void {
    const { t, slot } = req
    if (t.refs <= 0 || t.bytes || t.swapId !== slot) {
      t.swapPending = false
      return
    }
    this.inflightReads += 1
    this.swap!.read(slot)
      .then((bytes) => {
        this.inflightReads -= 1
        t.swapPending = false
        if (t.refs <= 0 || t.bytes) {
          this.swap?.free(slot)
          this.pumpIO()
          return
        }
        t.bytes = bytes
        t.gen = nextGen()
        t.swapId = -1
        this.swap?.free(slot)
        this.restoredBatch.add(t)
        this.scheduleFlush()
        this.pumpIO()
      })
      .catch(() => {
        this.inflightReads -= 1
        t.swapPending = false
        this.pumpIO()
      })
  }

  private startWrite(req: { t: TileData; gen: number }): void {
    const { t, gen } = req
    if (t.refs <= 0 || !t.bytes || t.gen !== gen) {
      t.swapPending = false
      return
    }
    const bytes = t.bytes
    this.inflightWrites += 1
    this.swap!.write(bytes)
      .then((slot) => {
        this.inflightWrites -= 1
        t.swapPending = false
        // Touched or died while the write was in flight → the disk copy is moot.
        if (t.refs <= 0 || t.bytes !== bytes || t.gen !== gen) {
          this.swap?.free(slot)
          this.pumpIO()
          return
        }
        t.swapId = slot
        t.bytes = null
        this.pumpIO()
      })
      .catch(() => {
        this.inflightWrites -= 1
        t.swapPending = false
        this.pumpIO()
      })
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return
    this.flushScheduled = true
    const run = () => {
      this.flushScheduled = false
      this.flushRestored()
    }
    if (this.schedule) this.schedule(run)
    else if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run)
    else setTimeout(run, 16)
  }

  private flushRestored(): void {
    const batch = this.restoredBatch
    this.restoredBatch = new Set()
    if (batch.size === 0) return
    for (const rec of this.records.values()) {
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
          if (!rec.materialComplete) rec.materialComplete = this.gridComplete(rec.grid)
        } else {
          rec.material = null
          rec.materialComplete = false
        }
      }
      for (const [level, mip] of rec.mips) {
        const scale = 1 / (1 << level)
        if (this.patchScaled(rec.grid, touched, mip.canvas, scale)) {
          mip.version += 1
          mip.dirty = rects.map((r) => ({
            x: Math.floor(r.x * scale),
            y: Math.floor(r.y * scale),
            w: Math.ceil(r.w * scale) + 1,
            h: Math.ceil(r.h * scale) + 1,
          }))
          if (!mip.complete) mip.complete = this.gridComplete(rec.grid)
        } else {
          rec.mips.delete(level)
        }
      }
      if (rec.thumb && !rec.thumbComplete) rec.thumb = null
    }
    this.onRestored?.()
  }

  private gridComplete(grid: TileGrid): boolean {
    for (const t of grid.tiles) if (!t.bytes && !t.uniform) return false
    return true
  }

  /**
   * Memory pressure valve, called after history changes: drop dense material
   * caches (the GPU composites tiled contents straight from the atlas, so
   * only actively-edited contents keep theirs for paint checkouts), then swap
   * the least-recently-used history tiles out to OPFS until under budget.
   * Pinned (live) contents are never swapped — derivation and painting need
   * their tiles synchronously.
   */
  trim(pinned: Set<string>, keepMaterial?: Set<string>): void {
    const keep = keepMaterial ?? pinned
    for (const [id, rec] of this.records) {
      if (rec.kind === 'tiled' && rec.material && !keep.has(id)) {
        rec.material = null
        rec.materialComplete = false
      }
    }
    if (!this.swap) return
    const pinnedTiles = new Set<TileData>()
    for (const id of pinned) {
      const r = this.records.get(id)
      if (r?.kind === 'tiled') for (const t of r.grid.tiles) pinnedTiles.add(t)
    }
    const seen = new Set<TileData>()
    const candidates: TileData[] = []
    let resident = 0
    for (const rec of this.records.values()) {
      if (rec.kind !== 'tiled') continue
      for (const t of rec.grid.tiles) {
        if (!t.bytes || seen.has(t)) continue
        seen.add(t)
        resident += t.bytes.byteLength
        if (!pinnedTiles.has(t) && !t.swapPending && t.gen <= this.coldMark) candidates.push(t)
      }
    }
    this.coldMark = nextGen()
    if (resident <= this.tileBudget) return
    candidates.sort((a, b) => a.gen - b.gen)
    let excess = resident - this.tileBudget
    for (const t of candidates) {
      if (excess <= 0) break
      excess -= t.bytes!.byteLength
      this.swapOut(t)
    }
  }

  private swapOut(t: TileData): void {
    t.swapPending = true
    this.writeQueue.push({ t, gen: t.gen })
    this.pumpIO()
  }

  derive(baseId: string, edits: ContentEdit[], opts?: { uploadedUrl?: string }): string | null {
    const base = this.records.get(baseId)
    if (!base || base.kind !== 'tiled') return null
    const grid = deriveGrid(base.grid, edits, this.pool)
    const id = generateId('content')
    // Steal the base's material and patch the edited rects — the base is
    // history now; if it's ever shown again (undo) it regathers from tiles.
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
    this.records.set(id, rec)
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
    const grid = uniformGrid(width, height, this.pool, rgba[0], rgba[1], rgba[2], rgba[3])
    this.records.set(id, this.makeTiledRecord(id, grid, null))
    return id
  }

  /**
   * The CPU tile grid backing a tiled content, for direct GPU-atlas
   * compositing. Also kicks async restores for any swapped-out tiles so the
   * compositor can render partial now and be invalidated when they land.
   */
  tileGridOf(id: string): TileGrid | null {
    const rec = this.records.get(id)
    if (!rec || rec.kind !== 'tiled') return null
    this.ensureResident(rec.grid)
    const gen = nextGen()
    for (const t of rec.grid.tiles) t.gen = gen
    return rec.grid
  }

  renderSource(id: string, scale: number): RenderSource | null {
    const rec = this.records.get(id)
    if (!rec || rec.kind !== 'tiled') return null
    if (!(scale > 0) || scale >= 0.5) {
      const bitmap = this.materialize(id)
      return { bitmap, version: rec.materialVersion, dirtyRects: rec.materialDirty }
    }
    const level = Math.min(MAX_MIP_LEVEL, Math.floor(Math.log2(1 / scale)))
    const mip = this.mipEntry(rec, level)
    if (!mip) {
      const bitmap = this.materialize(id)
      return { bitmap, version: rec.materialVersion, dirtyRects: rec.materialDirty }
    }
    return { bitmap: mip.canvas, version: mip.version, dirtyRects: mip.dirty }
  }

  private mipEntry(rec: TiledRecord, level: number): MipEntry | null {
    const hit = rec.mips.get(level)
    if (hit) {
      if (!hit.complete) this.ensureResident(rec.grid)
      return hit
    }
    const complete = this.ensureResident(rec.grid)
    const scale = 1 / (1 << level)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(rec.grid.width * scale))
    canvas.height = Math.max(1, Math.round(rec.grid.height * scale))
    if (!this.drawGridScaled(rec.grid, canvas, scale)) return null
    const entry: MipEntry = { canvas, complete, version: 1, dirty: null }
    rec.mips.set(level, entry)
    return entry
  }

  private scratch: HTMLCanvasElement | null = null

  private scratchCtx(): CanvasRenderingContext2D | null {
    if (!this.scratch) {
      this.scratch = document.createElement('canvas')
      this.scratch.width = TILE_SIZE
      this.scratch.height = TILE_SIZE
    }
    return this.scratch.getContext('2d')
  }

  private drawGridScaled(grid: TileGrid, out: HTMLCanvasElement, scale: number): boolean {
    const g = out.getContext('2d')
    if (!g) return false
    g.imageSmoothingEnabled = true
    g.imageSmoothingQuality = 'medium'
    const sg = this.scratchCtx()
    for (let i = 0; i < grid.tiles.length; i++) {
      this.drawTileScaled(grid, i, g, sg, scale)
    }
    return true
  }

  private patchScaled(grid: TileGrid, indexes: number[], out: HTMLCanvasElement, scale: number): boolean {
    const g = out.getContext('2d')
    if (!g) return false
    g.imageSmoothingEnabled = true
    g.imageSmoothingQuality = 'medium'
    const sg = this.scratchCtx()
    for (const i of indexes) this.drawTileScaled(grid, i, g, sg, scale)
    return true
  }

  private drawTileScaled(
    grid: TileGrid,
    index: number,
    g: CanvasRenderingContext2D,
    sg: CanvasRenderingContext2D | null,
    scale: number
  ): void {
    const tile = grid.tiles[index]
    const r = tileRect(grid, index)
    const dx = r.x * scale
    const dy = r.y * scale
    const dw = r.w * scale
    const dh = r.h * scale
    if (tile.uniform) {
      const [cr, cg, cb, ca] = tile.uniform
      g.clearRect(dx, dy, dw, dh)
      if (ca === 0) return
      g.fillStyle = `rgba(${cr},${cg},${cb},${ca / 255})`
      g.fillRect(dx, dy, dw, dh)
      return
    }
    if (!tile.bytes || !sg) return
    sg.putImageData(new ImageData(clampedView(tile.bytes), TILE_SIZE, TILE_SIZE), 0, 0)
    g.clearRect(dx, dy, dw, dh)
    g.drawImage(sg.canvas, 0, 0, r.w, r.h, dx, dy, dw, dh)
  }

  /** Alpha at a content pixel without materializing (layer picking). */
  alphaAt(id: string, x: number, y: number): number | null {
    const rec = this.records.get(id)
    if (!rec || rec.kind !== 'tiled') return null
    const grid = rec.grid
    if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return 0
    const tile = grid.tiles[Math.floor(y / TILE_SIZE) * grid.cols + Math.floor(x / TILE_SIZE)]
    if (tile.uniform) return tile.uniform[3] / 255
    if (!tile.bytes) return 1
    const lx = x % TILE_SIZE
    const ly = y % TILE_SIZE
    return tile.bytes[(ly * TILE_SIZE + lx) * 4 + 3] / 255
  }

  /** Tile-native thumbnail — never materializes the dense content. */
  thumbnailCanvas(id: string, maxDim: number): HTMLCanvasElement | null {
    const rec = this.records.get(id)
    if (!rec) return null
    if (rec.kind === 'plain') return rec.entry.canvas
    if (rec.thumb && Math.max(rec.thumb.width, rec.thumb.height) >= Math.min(maxDim, 256)) return rec.thumb
    const grid = rec.grid
    const complete = this.ensureResident(grid)
    const scale = Math.min(1, maxDim / Math.max(grid.width, grid.height))
    const out = document.createElement('canvas')
    out.width = Math.max(1, Math.round(grid.width * scale))
    out.height = Math.max(1, Math.round(grid.height * scale))
    if (!this.drawGridScaled(grid, out, scale)) return null
    rec.thumb = out
    rec.thumbComplete = complete
    return out
  }

  /** Drop dense material caches, keeping tiles as the source of truth. */
  dropMaterials(keep: Set<string>): number {
    let freed = 0
    for (const [id, rec] of this.records) {
      if (rec.kind !== 'tiled' || !rec.material || keep.has(id)) continue
      freed += rec.material.width * rec.material.height * 4
      rec.material = null
      rec.materialComplete = false
    }
    return freed
  }

  get(id: string): ContentEntry | undefined {
    return this.records.get(id)?.entry
  }

  has(id: string): boolean {
    return this.records.has(id)
  }

  dirtyIds(): string[] {
    const out: string[] = []
    for (const r of this.records.values()) if (r.entry.uploadedUrl === null) out.push(r.entry.id)
    return out
  }

  markUploaded(id: string, url: string): void {
    const r = this.records.get(id)
    if (r) r.entry.uploadedUrl = url
  }

  collectGarbage(liveIds: Set<string>): void {
    for (const [id, rec] of [...this.records]) {
      if (liveIds.has(id)) continue
      if (rec.kind === 'tiled') this.releaseTiles(releaseGrid(rec.grid, this.pool))
      this.records.delete(id)
    }
  }

  protected releaseTiles(dead: TileData[]): void {
    for (const t of dead) {
      t.bytes = null
      if (t.swapId >= 0) {
        this.swap?.free(t.swapId)
        t.swapId = -1
      }
    }
  }

  totalBytes(): number {
    let n = 0
    const grids: TileGrid[] = []
    for (const r of this.records.values()) {
      if (r.kind === 'plain') {
        n += r.entry.width * r.entry.height * 4
      } else {
        grids.push(r.grid)
        if (r.material) n += r.material.width * r.material.height * 4
      }
    }
    return n + residentTileBytes(grids)
  }

  /** Introspection for tests and the memory panel. */
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
  } {
    let plain = 0
    let tiled = 0
    let materialBytes = 0
    let swappedOut = 0
    const grids: TileGrid[] = []
    const seen = new Set<TileData>()
    for (const r of this.records.values()) {
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
          }
        }
      }
    }
    return {
      plain,
      tiled,
      tileBytes: residentTileBytes(grids),
      materialBytes,
      poolSize: this.pool.size,
      swappedOut,
      queuedReads: this.readQueue.length,
      queuedWrites: this.writeQueue.length,
      inflightReads: this.inflightReads,
      inflightWrites: this.inflightWrites,
    }
  }
}
