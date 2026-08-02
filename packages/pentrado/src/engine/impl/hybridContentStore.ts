import type { ContentEdit, ContentEntry, ContentStore } from '../content'
import { generateId } from '../id'
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

interface PlainRecord {
  kind: 'plain'
  entry: ContentEntry
}

interface TiledRecord {
  kind: 'tiled'
  entry: ContentEntry
  grid: TileGrid

  material: HTMLCanvasElement | null
  thumb: HTMLCanvasElement | null
}

type Record_ = PlainRecord | TiledRecord

function singleUniform(grid: TileGrid): Uint8Array | null {
  const first = grid.tiles[0]
  if (!first.uniform) return null
  for (const t of grid.tiles) if (t !== first) return null
  return first.uniform
}

export class HybridContentStore implements ContentStore {
  private records = new Map<string, Record_>()
  private pool: UniformPool = new Map()
  private swap: SwapClient | null = null
  private onRestored: (() => void) | null = null
  private tileBudget = 512 * 1024 * 1024

  configureSwap(opts: { swap: SwapClient | null; onRestored?: () => void; tileBudgetBytes?: number }): void {
    this.swap = opts.swap
    this.onRestored = opts.onRestored ?? null
    if (opts.tileBudgetBytes != null) this.tileBudget = opts.tileBudgetBytes
  }

  setTileBudget(bytes: number): void {
    this.tileBudget = bytes
  }

  hasSwap(): boolean {
    return this.swap != null
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
    const rec: TiledRecord = {
      kind: 'tiled',
      grid,
      material: allUniform ? null : canvas,
      thumb: null,
      entry: this.makeTiledEntry(id, grid, opts?.uploadedUrl ?? null),
    }
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
    // Swapped-out tiles render as holes; don't cache — once the async
    // restores land, onRestored fires and the next materialize is complete.
    if (complete) rec.material = canvas
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
    if (rec.material) return rec.material
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
      const slot = t.swapId
      this.swap
        .read(slot)
        .then((bytes) => {
          t.swapPending = false
          if (t.refs <= 0 || t.bytes) {
            this.swap?.free(slot)
            return
          }
          t.bytes = bytes
          t.gen = nextGen()
          t.swapId = -1
          this.swap?.free(slot)
          this.onRestored?.()
        })
        .catch(() => {
          t.swapPending = false
        })
    }
    return complete
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
      if (rec.kind === 'tiled' && rec.material && !keep.has(id)) rec.material = null
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
        if (!pinnedTiles.has(t) && !t.swapPending) candidates.push(t)
      }
    }
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
    const bytes = t.bytes!
    const genAt = t.gen
    t.swapPending = true
    this.swap!.write(bytes)
      .then((slot) => {
        t.swapPending = false
        // Touched or died while the write was in flight → the disk copy is moot.
        if (t.refs <= 0 || t.bytes !== bytes || t.gen !== genAt) {
          this.swap?.free(slot)
          return
        }
        t.swapId = slot
        t.bytes = null
      })
      .catch(() => {
        t.swapPending = false
      })
  }

  derive(baseId: string, edits: ContentEdit[], opts?: { uploadedUrl?: string }): string | null {
    const base = this.records.get(baseId)
    if (!base || base.kind !== 'tiled') return null
    const grid = deriveGrid(base.grid, edits, this.pool)
    const id = generateId('content')
    // Steal the base's material and patch the edited rects — the base is
    // history now; if it's ever shown again (undo) it regathers from tiles.
    let material: HTMLCanvasElement | null = null
    if (base.material) {
      material = base.material
      base.material = null
      const g = material.getContext('2d')
      if (g) {
        for (const e of edits) {
          g.putImageData(new ImageData(e.pixels as Uint8ClampedArray<ArrayBuffer>, e.w, e.h), e.x, e.y)
        }
      } else {
        material = null
      }
    }
    const rec: TiledRecord = {
      kind: 'tiled',
      grid,
      material,
      thumb: null,
      entry: this.makeTiledEntry(id, grid, opts?.uploadedUrl ?? null),
    }
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
    this.records.set(id, {
      kind: 'tiled',
      grid,
      material: null,
      thumb: null,
      entry: this.makeTiledEntry(id, grid, null),
    })
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
    return rec.grid
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

  private thumbScratch: HTMLCanvasElement | null = null

  /** Tile-native thumbnail — never materializes the dense content. */
  thumbnailCanvas(id: string, maxDim: number): HTMLCanvasElement | null {
    const rec = this.records.get(id)
    if (!rec) return null
    if (rec.kind === 'plain') return rec.entry.canvas
    if (rec.thumb && Math.max(rec.thumb.width, rec.thumb.height) >= Math.min(maxDim, 256)) return rec.thumb
    const grid = rec.grid
    const scale = Math.min(1, maxDim / Math.max(grid.width, grid.height))
    const tw = Math.max(1, Math.round(grid.width * scale))
    const th = Math.max(1, Math.round(grid.height * scale))
    const out = document.createElement('canvas')
    out.width = tw
    out.height = th
    const g = out.getContext('2d')
    if (!g) return null
    g.imageSmoothingEnabled = true
    g.imageSmoothingQuality = 'medium'
    if (!this.thumbScratch) this.thumbScratch = document.createElement('canvas')
    const scratch = this.thumbScratch
    scratch.width = TILE_SIZE
    scratch.height = TILE_SIZE
    const sg = scratch.getContext('2d')
    for (let i = 0; i < grid.tiles.length; i++) {
      const tile = grid.tiles[i]
      const x = (i % grid.cols) * TILE_SIZE
      const y = ((i / grid.cols) | 0) * TILE_SIZE
      const w = Math.min(TILE_SIZE, grid.width - x)
      const h = Math.min(TILE_SIZE, grid.height - y)
      const dx = x * scale
      const dy = y * scale
      const dw = w * scale
      const dh = h * scale
      if (tile.uniform) {
        if (tile.uniform[3] === 0) continue
        g.fillStyle = `rgba(${tile.uniform[0]},${tile.uniform[1]},${tile.uniform[2]},${tile.uniform[3] / 255})`
        g.fillRect(dx, dy, dw, dh)
        continue
      }
      if (!tile.bytes || !sg) continue
      sg.putImageData(new ImageData(new Uint8ClampedArray(tile.bytes), TILE_SIZE, TILE_SIZE), 0, 0)
      g.drawImage(scratch, 0, 0, w, h, dx, dy, dw, dh)
    }
    rec.thumb = out
    return out
  }

  /** Drop dense material caches, keeping tiles as the source of truth. */
  dropMaterials(keep: Set<string>): number {
    let freed = 0
    for (const [id, rec] of this.records) {
      if (rec.kind !== 'tiled' || !rec.material || keep.has(id)) continue
      freed += rec.material.width * rec.material.height * 4
      rec.material = null
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
    return { plain, tiled, tileBytes: residentTileBytes(grids), materialBytes, poolSize: this.pool.size, swappedOut }
  }
}
