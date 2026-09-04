import type { RenderSource } from '../content'
import { gatherPixels, TILE_SIZE, type TileGrid } from '../tile/tileBuffer'
import { ensureResident } from './hybridSwap'
import {
  clampedView,
  MAX_MIP_LEVEL,
  PROXY_MIP_LEVEL,
  singleUniform,
  tileRect,
  type MipEntry,
  type StoreState,
  type TiledRecord,
} from './hybridTypes'

export function materialize(st: StoreState, id: string): HTMLCanvasElement {
  const rec = st.records.get(id)
  if (!rec || rec.kind !== 'tiled') throw new Error(`materialize: not tiled: ${id}`)
  if (rec.material) return rec.material
  const complete = ensureResident(st, rec.grid)
  const canvas = buildDense(rec.grid)
  rec.material = canvas
  rec.materialComplete = complete
  rec.materialVersion += 1
  rec.materialDirty = null
  return canvas
}

export function buildDense(grid: TileGrid): HTMLCanvasElement {
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

export function exportCanvas(st: StoreState, id: string): HTMLCanvasElement | null {
  const rec = st.records.get(id)
  if (!rec) return null
  if (rec.kind === 'plain') return rec.entry.canvas
  if (rec.material && rec.materialComplete) return rec.material
  ensureResident(st, rec.grid)
  return buildDense(rec.grid)
}

export function renderSource(st: StoreState, id: string, scale: number): RenderSource | null {
  const rec = st.records.get(id)
  if (!rec || rec.kind !== 'tiled') return null
  if (!(scale > 0) || scale >= 0.5) {
    const bitmap = materialize(st, id)
    return { bitmap, version: rec.materialVersion, dirtyRects: rec.materialDirty }
  }
  const level = Math.min(MAX_MIP_LEVEL, Math.floor(Math.log2(1 / scale)))
  const mip = mipEntry(st, rec, level)
  if (!mip) {
    const bitmap = materialize(st, id)
    return { bitmap, version: rec.materialVersion, dirtyRects: rec.materialDirty }
  }
  return { bitmap: mip.canvas, version: mip.version, dirtyRects: mip.dirty }
}

export function mipEntry(st: StoreState, rec: TiledRecord, level: number): MipEntry | null {
  const hit = rec.mips.get(level)
  if (hit) {
    if (!hit.complete) ensureResident(st, rec.grid)
    return hit
  }
  const complete = ensureResident(st, rec.grid)
  const scale = 1 / (1 << level)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(rec.grid.width * scale))
  canvas.height = Math.max(1, Math.round(rec.grid.height * scale))
  if (!drawGridScaled(st, rec.grid, canvas, scale)) return null
  const entry: MipEntry = { canvas, complete, version: 1, dirty: null }
  rec.mips.set(level, entry)
  return entry
}

export function scratchCtx(st: StoreState): CanvasRenderingContext2D | null {
  if (!st.scratch) {
    st.scratch = document.createElement('canvas')
    st.scratch.width = TILE_SIZE
    st.scratch.height = TILE_SIZE
  }
  return st.scratch.getContext('2d')
}

function drawGridScaled(st: StoreState, grid: TileGrid, out: HTMLCanvasElement, scale: number): boolean {
  const g = out.getContext('2d')
  if (!g) return false
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'medium'
  const sg = scratchCtx(st)
  for (let i = 0; i < grid.tiles.length; i++) {
    drawTileScaled(grid, i, g, sg, scale)
  }
  return true
}

export function patchScaled(st: StoreState, grid: TileGrid, indexes: number[], out: HTMLCanvasElement, scale: number): boolean {
  const g = out.getContext('2d')
  if (!g) return false
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'medium'
  const sg = scratchCtx(st)
  for (const i of indexes) drawTileScaled(grid, i, g, sg, scale)
  return true
}

function drawTileScaled(
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

export function proxyTile(st: StoreState, id: string, index: number): Uint8Array | null {
  const rec = st.records.get(id)
  if (!rec || rec.kind !== 'tiled') return null
  let level = -1
  for (const l of [1, 2, PROXY_MIP_LEVEL]) {
    const m = rec.mips.get(l)
    if (m?.complete) { level = l; break }
  }
  if (level < 0) return null
  const mip = rec.mips.get(level)!
  const f = 1 << level
  const grid = rec.grid
  const cx = index % grid.cols
  const cy = (index / grid.cols) | 0
  const sg = scratchCtx(st)
  if (!sg) return null
  sg.imageSmoothingEnabled = true
  sg.clearRect(0, 0, TILE_SIZE, TILE_SIZE)
  sg.drawImage(mip.canvas, cx * TILE_SIZE / f, cy * TILE_SIZE / f, TILE_SIZE / f, TILE_SIZE / f, 0, 0, TILE_SIZE, TILE_SIZE)
  return new Uint8Array(sg.getImageData(0, 0, TILE_SIZE, TILE_SIZE).data.buffer)
}

export function alphaAt(st: StoreState, id: string, x: number, y: number): number | null {
  const rec = st.records.get(id)
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

export function thumbnailCanvas(st: StoreState, id: string, maxDim: number): HTMLCanvasElement | null {
  const rec = st.records.get(id)
  if (!rec) return null
  if (rec.kind === 'plain') return rec.entry.canvas
  if (rec.thumb && Math.max(rec.thumb.width, rec.thumb.height) >= Math.min(maxDim, 256)) return rec.thumb
  const grid = rec.grid
  const complete = ensureResident(st, grid)
  const scale = Math.min(1, maxDim / Math.max(grid.width, grid.height))
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(grid.width * scale))
  out.height = Math.max(1, Math.round(grid.height * scale))
  if (!drawGridScaled(st, grid, out, scale)) return null
  rec.thumb = out
  rec.thumbComplete = complete
  return out
}
