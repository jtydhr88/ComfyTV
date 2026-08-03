import { TILE_SIZE, type TileData, type TileGrid } from '../tile/tileBuffer'

export const GUTTER = 8
export const SLOT_SIZE = TILE_SIZE + GUTTER * 2
export const ATLAS_SIZE = 4096
export const SLOTS_PER_ROW = Math.floor(ATLAS_SIZE / SLOT_SIZE)
export const SLOTS_PER_ATLAS = SLOTS_PER_ROW * SLOTS_PER_ROW

export interface AtlasSlot {
  atlas: number
  x: number
  y: number
  gen: number
}

interface AtlasTexture {
  tex: WebGLTexture
  used: number
}

export class TileAtlas {
  private gl: WebGL2RenderingContext
  private atlases: AtlasTexture[] = []
  private slots = new Map<TileData, AtlasSlot>()
  private freeSlots: Array<{ atlas: number; x: number; y: number }> = []
  private scratch: Uint8Array = new Uint8Array(SLOT_SIZE * SLOT_SIZE * 4)
  private generation = 0

  epoch = 0
  maxAtlases = 8

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
  }

  beginFrame(): void {
    this.generation += 1
  }

  texture(atlas: number): WebGLTexture | null {
    return this.atlases[atlas]?.tex ?? null
  }

  acquire(grid: TileGrid, index: number): AtlasSlot | null {
    const tile = grid.tiles[index]
    if (!tile.bytes) return null
    const hit = this.slots.get(tile)
    if (hit) {
      hit.gen = this.generation
      return hit
    }
    const pos = this.allocSlot()
    if (!pos) return null
    this.fillScratch(grid, index)
    const g = this.gl
    g.bindTexture(g.TEXTURE_2D, this.atlases[pos.atlas].tex)
    g.texSubImage2D(g.TEXTURE_2D, 0, pos.x, pos.y, SLOT_SIZE, SLOT_SIZE, g.RGBA, g.UNSIGNED_BYTE, this.scratch)
    const slot: AtlasSlot = { atlas: pos.atlas, x: pos.x, y: pos.y, gen: this.generation }
    this.slots.set(tile, slot)
    return slot
  }

  private allocSlot(): { atlas: number; x: number; y: number } | null {
    const free = this.freeSlots.pop()
    if (free) return free
    for (let a = 0; a < this.atlases.length; a++) {
      const at = this.atlases[a]
      if (at.used < SLOTS_PER_ATLAS) {
        const i = at.used++
        return { atlas: a, x: (i % SLOTS_PER_ROW) * SLOT_SIZE, y: Math.floor(i / SLOTS_PER_ROW) * SLOT_SIZE }
      }
    }
    if (this.atlases.length < this.maxAtlases) {
      const g = this.gl
      const tex = g.createTexture()
      if (!tex) return null
      g.bindTexture(g.TEXTURE_2D, tex)
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, ATLAS_SIZE, ATLAS_SIZE, 0, g.RGBA, g.UNSIGNED_BYTE, null)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
      this.atlases.push({ tex, used: 1 })
      return { atlas: this.atlases.length - 1, x: 0, y: 0 }
    }
    return this.evictOne() ? this.allocSlot() : null
  }

  private evictOne(): boolean {
    let victim: TileData | null = null
    let victimSlot: AtlasSlot | null = null
    for (const [tile, slot] of this.slots) {
      if (slot.gen >= this.generation) continue
      if (!victimSlot || slot.gen < victimSlot.gen) {
        victim = tile
        victimSlot = slot
      }
    }
    if (!victim || !victimSlot) return false
    this.slots.delete(victim)
    this.freeSlots.push({ atlas: victimSlot.atlas, x: victimSlot.x, y: victimSlot.y })
    this.epoch += 1
    return true
  }

  sweepDead(): void {
    for (const [tile, slot] of this.slots) {
      if (tile.refs <= 0) {
        this.slots.delete(tile)
        this.freeSlots.push({ atlas: slot.atlas, x: slot.x, y: slot.y })
        this.epoch += 1
      }
    }
  }

  private fillScratch(grid: TileGrid, index: number): void {
    const scratchRow = SLOT_SIZE * 4
    const cx = index % grid.cols
    const cy = (index / grid.cols) | 0
    for (let sy = 0; sy < SLOT_SIZE; sy++) {
      const gy = Math.max(0, Math.min(grid.height - 1, cy * TILE_SIZE + sy - GUTTER))
      const trow = Math.min(grid.rows - 1, Math.floor(gy / TILE_SIZE))
      const ly = gy - trow * TILE_SIZE

      const own = grid.tiles[trow * grid.cols + cx]
      const validW = Math.min(TILE_SIZE, grid.width - cx * TILE_SIZE)
      const dst = sy * scratchRow + GUTTER * 4
      if (own.bytes) {
        const src = ly * TILE_SIZE * 4
        this.scratch.set(own.bytes.subarray(src, src + validW * 4), dst)
        for (let i = validW; i < TILE_SIZE; i++) this.copyPixelWithin(dst + (validW - 1) * 4, dst + i * 4)
      } else {
        for (let i = 0; i < TILE_SIZE; i++) this.writePixel(own, Math.min(i, validW - 1), ly, dst + i * 4)
      }

      for (let i = 0; i < GUTTER; i++) {
        this.gutterPixel(grid, cx * TILE_SIZE - GUTTER + i, gy, sy * scratchRow + i * 4)
        this.gutterPixel(grid, (cx + 1) * TILE_SIZE + i, gy, sy * scratchRow + (GUTTER + TILE_SIZE + i) * 4)
      }
    }
  }

  private gutterPixel(grid: TileGrid, gxRaw: number, gy: number, off: number): void {
    const gx = Math.max(0, Math.min(grid.width - 1, gxRaw))
    const tcol = Math.min(grid.cols - 1, Math.floor(gx / TILE_SIZE))
    const trow = Math.min(grid.rows - 1, Math.floor(gy / TILE_SIZE))
    const tile = grid.tiles[trow * grid.cols + tcol]
    this.writePixel(tile, gx - tcol * TILE_SIZE, gy - trow * TILE_SIZE, off)
  }

  private copyPixelWithin(from: number, to: number): void {
    this.scratch[to] = this.scratch[from]
    this.scratch[to + 1] = this.scratch[from + 1]
    this.scratch[to + 2] = this.scratch[from + 2]
    this.scratch[to + 3] = this.scratch[from + 3]
  }

  private writePixel(tile: TileData, lx: number, ly: number, off: number): void {
    if (tile.uniform) {
      this.scratch[off] = tile.uniform[0]
      this.scratch[off + 1] = tile.uniform[1]
      this.scratch[off + 2] = tile.uniform[2]
      this.scratch[off + 3] = tile.uniform[3]
      return
    }
    if (!tile.bytes) {
      this.scratch[off] = this.scratch[off + 1] = this.scratch[off + 2] = this.scratch[off + 3] = 0
      return
    }
    const src = (ly * TILE_SIZE + lx) * 4
    this.scratch[off] = tile.bytes[src]
    this.scratch[off + 1] = tile.bytes[src + 1]
    this.scratch[off + 2] = tile.bytes[src + 2]
    this.scratch[off + 3] = tile.bytes[src + 3]
  }

  stats(): { atlases: number; residentSlots: number; vramBytes: number } {
    return {
      atlases: this.atlases.length,
      residentSlots: this.slots.size,
      vramBytes: this.atlases.length * ATLAS_SIZE * ATLAS_SIZE * 4,
    }
  }

  dispose(): void {
    for (const a of this.atlases) this.gl.deleteTexture(a.tex)
    this.atlases = []
    this.slots.clear()
    this.freeSlots = []
  }
}
