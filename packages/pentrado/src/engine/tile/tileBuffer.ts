

export const TILE_SIZE = 256

export interface TileData {

  bytes: Uint8Array | null

  uniform: Uint8Array | null
  refs: number

  gen: number

  swapId: number

  swapPending: boolean
}

export interface TileGrid {
  width: number
  height: number
  cols: number
  rows: number
  tiles: TileData[]

  residency?: number
}

export interface TileEdit {
  x: number
  y: number
  w: number
  h: number
  pixels: Uint8ClampedArray
}

export type UniformPool = Map<number, TileData>

let lruGen = 0
export function nextGen(): number {
  return ++lruGen
}

function uniformKey(r: number, g: number, b: number, a: number): number {
  return (((a << 24) | (b << 16) | (g << 8) | r) >>> 0)
}

export function acquireUniform(pool: UniformPool, r: number, g: number, b: number, a: number): TileData {
  const key = uniformKey(r, g, b, a)
  let tile = pool.get(key)
  if (!tile) {
    tile = { bytes: null, uniform: new Uint8Array([r, g, b, a]), refs: 0, gen: nextGen(), swapId: -1, swapPending: false }
    pool.set(key, tile)
  }
  tile.refs += 1
  return tile
}

function makeByteTile(bytes: Uint8Array): TileData {
  return { bytes, uniform: null, refs: 1, gen: nextGen(), swapId: -1, swapPending: false }
}

function detectUniform(bytes: Uint8Array, w = TILE_SIZE, h = TILE_SIZE): [number, number, number, number] | null {
  const u32 = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 2)
  const first = u32[0]
  if (w === TILE_SIZE) {
    const n = h * TILE_SIZE
    for (let i = 1; i < n; i++) if (u32[i] !== first) return null
  } else {
    for (let y = 0; y < h; y++) {
      const row = y * TILE_SIZE
      for (let x = 0; x < w; x++) if (u32[row + x] !== first) return null
    }
  }
  return [bytes[0], bytes[1], bytes[2], bytes[3]]
}

export function gridDims(width: number, height: number): { cols: number; rows: number } {
  return { cols: Math.ceil(width / TILE_SIZE), rows: Math.ceil(height / TILE_SIZE) }
}

export function tileifyPixels(data: Uint8ClampedArray, width: number, height: number, pool: UniformPool): TileGrid {
  const { cols, rows } = gridDims(width, height)
  const tiles: TileData[] = new Array(cols * rows)
  const tileRow = TILE_SIZE * 4
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const x0 = tx * TILE_SIZE
      const y0 = ty * TILE_SIZE
      const w = Math.min(TILE_SIZE, width - x0)
      const h = Math.min(TILE_SIZE, height - y0)
      const bytes = new Uint8Array(TILE_SIZE * TILE_SIZE * 4)
      for (let y = 0; y < h; y++) {
        const src = ((y0 + y) * width + x0) * 4
        bytes.set(data.subarray(src, src + w * 4), y * tileRow)
      }
      const uni = detectUniform(bytes, w, h)
      tiles[ty * cols + tx] = uni ? acquireUniform(pool, uni[0], uni[1], uni[2], uni[3]) : makeByteTile(bytes)
    }
  }
  return { width, height, cols, rows, tiles }
}

export function uniformGrid(width: number, height: number, pool: UniformPool, r = 0, g = 0, b = 0, a = 0): TileGrid {
  const { cols, rows } = gridDims(width, height)
  const tiles: TileData[] = new Array(cols * rows)
  for (let i = 0; i < tiles.length; i++) tiles[i] = acquireUniform(pool, r, g, b, a)
  return { width, height, cols, rows, tiles }
}

export function isBlankGrid(grid: TileGrid): boolean {
  for (const t of grid.tiles) {
    if (!t.uniform || t.uniform[3] !== 0 || t.uniform[0] !== 0 || t.uniform[1] !== 0 || t.uniform[2] !== 0) return false
  }
  return true
}

function scatterTile(grid: TileGrid, index: number, out: Uint8ClampedArray): void {
  const tile = grid.tiles[index]
  const tx = index % grid.cols
  const ty = (index / grid.cols) | 0
  const x0 = tx * TILE_SIZE
  const y0 = ty * TILE_SIZE
  const w = Math.min(TILE_SIZE, grid.width - x0)
  const h = Math.min(TILE_SIZE, grid.height - y0)
  if (tile.uniform) {
    const [r, g, b, a] = tile.uniform
    if (r === 0 && g === 0 && b === 0 && a === 0) return
    for (let y = 0; y < h; y++) {
      let off = ((y0 + y) * grid.width + x0) * 4
      for (let x = 0; x < w; x++, off += 4) {
        out[off] = r
        out[off + 1] = g
        out[off + 2] = b
        out[off + 3] = a
      }
    }
    return
  }
  if (!tile.bytes) return
  const tileRow = TILE_SIZE * 4
  for (let y = 0; y < h; y++) {
    const src = y * tileRow
    out.set(tile.bytes.subarray(src, src + w * 4), ((y0 + y) * grid.width + x0) * 4)
  }
}

export function gatherPixels(grid: TileGrid): Uint8ClampedArray {
  const out = new Uint8ClampedArray(grid.width * grid.height * 4)
  const gen = nextGen()
  for (let i = 0; i < grid.tiles.length; i++) {
    grid.tiles[i].gen = gen
    scatterTile(grid, i, out)
  }
  return out
}

export function tilesInRect(grid: TileGrid, x: number, y: number, w: number, h: number): number[] {
  const tx0 = Math.max(0, Math.floor(x / TILE_SIZE))
  const ty0 = Math.max(0, Math.floor(y / TILE_SIZE))
  const tx1 = Math.min(grid.cols - 1, Math.floor((x + w - 1) / TILE_SIZE))
  const ty1 = Math.min(grid.rows - 1, Math.floor((y + h - 1) / TILE_SIZE))
  const out: number[] = []
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) out.push(ty * grid.cols + tx)
  return out
}

export function deriveGrid(base: TileGrid, edits: TileEdit[], pool: UniformPool): TileGrid {
  const tiles = base.tiles.slice()
  const touched = new Set<number>()
  for (const e of edits) for (const i of tilesInRect(base, e.x, e.y, e.w, e.h)) touched.add(i)
  const gen = nextGen()
  for (let i = 0; i < tiles.length; i++) {
    if (!touched.has(i)) {
      tiles[i].refs += 1
      continue
    }
    const srcTile = tiles[i]
    const bytes = new Uint8Array(TILE_SIZE * TILE_SIZE * 4)

    if (srcTile.uniform) {
      const [r, g, b, a] = srcTile.uniform
      if ((r | g | b | a) !== 0) {
        const u32 = new Uint32Array(bytes.buffer)
        u32.fill(uniformKey(r, g, b, a))
      }
    } else if (srcTile.bytes) {
      bytes.set(srcTile.bytes)
    }

    const tx = i % base.cols
    const ty = (i / base.cols) | 0
    const x0 = tx * TILE_SIZE
    const y0 = ty * TILE_SIZE
    const tileRow = TILE_SIZE * 4
    for (const e of edits) {
      const ix0 = Math.max(x0, e.x)
      const iy0 = Math.max(y0, e.y)
      const ix1 = Math.min(x0 + TILE_SIZE, e.x + e.w, base.width)
      const iy1 = Math.min(y0 + TILE_SIZE, e.y + e.h, base.height)
      if (ix1 <= ix0 || iy1 <= iy0) continue
      const rowBytes = (ix1 - ix0) * 4
      for (let y = iy0; y < iy1; y++) {
        const src = ((y - e.y) * e.w + (ix0 - e.x)) * 4
        const dst = (y - y0) * tileRow + (ix0 - x0) * 4
        bytes.set(e.pixels.subarray(src, src + rowBytes), dst)
      }
    }
    const vw = Math.min(TILE_SIZE, base.width - x0)
    const vh = Math.min(TILE_SIZE, base.height - y0)
    const uni = detectUniform(bytes, vw, vh)
    const next = uni ? acquireUniform(pool, uni[0], uni[1], uni[2], uni[3]) : makeByteTile(bytes)
    next.gen = gen
    tiles[i] = next
  }
  return { width: base.width, height: base.height, cols: base.cols, rows: base.rows, tiles }
}

export function releaseGrid(grid: TileGrid, pool: UniformPool): TileData[] {
  const dead: TileData[] = []
  const seenThisCall = new Map<TileData, number>()
  for (const t of grid.tiles) seenThisCall.set(t, (seenThisCall.get(t) ?? 0) + 1)
  for (const [t, count] of seenThisCall) {
    t.refs -= count
    if (t.refs <= 0) {
      if (t.uniform) {
        pool.delete(uniformKey(t.uniform[0], t.uniform[1], t.uniform[2], t.uniform[3]))
      }
      dead.push(t)
    }
  }
  return dead
}

export function residentTileBytes(grids: Iterable<TileGrid>, seen = new Set<TileData>()): number {
  let n = 0
  for (const g of grids) {
    for (const t of g.tiles) {
      if (t.bytes && !seen.has(t)) {
        seen.add(t)
        n += t.bytes.byteLength
      }
    }
  }
  return n
}
