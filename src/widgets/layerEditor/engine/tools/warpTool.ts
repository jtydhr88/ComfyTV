import { BakeRasterCommand, snapshotRaster } from '../commands/bakeContent'
import { findNode } from '../document'
import { Dirty } from '../history'
import type { RasterData, Rect, SceneNode, Transform, Vec2 } from '../node'
import { defaultControl, type Overlay, type Tool, type ToolContext, type ToolControl, type ToolDef } from '../tool'
import { makeToLocal } from './paintTarget'

export interface WarpToolOptions {
  points: number
}

export const DEFAULT_WARP_OPTIONS: WarpToolOptions = { points: 4 }

export const WARP_SUBDIV = 10

export function buildWarpGrid(n: number, w: number, h: number): Vec2[] {
  const pts: Vec2[] = []
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      pts.push({ x: (i / (n - 1)) * w, y: (j / (n - 1)) * h })
    }
  }
  return pts
}

function cr(p0: number, p1: number, p2: number, p3: number, t: number): number {
  return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)))
}

function sampleRow(vals: number[], n: number, s: number): number {
  const i = Math.max(0, Math.min(n - 2, Math.floor(s)))
  const t = s - i
  const p1 = vals[i]
  const p2 = vals[i + 1]
  const p0 = i - 1 >= 0 ? vals[i - 1] : 2 * p1 - p2
  const p3 = i + 2 <= n - 1 ? vals[i + 2] : 2 * p2 - p1
  return cr(p0, p1, p2, p3, t)
}

export function sampleWarpSurface(pts: Vec2[], n: number, u: number, v: number): Vec2 {
  const rowX: number[] = []
  const rowY: number[] = []
  for (let j = 0; j < n; j++) {
    const xs: number[] = []
    const ys: number[] = []
    for (let i = 0; i < n; i++) {
      xs.push(pts[j * n + i].x)
      ys.push(pts[j * n + i].y)
    }
    rowX.push(sampleRow(xs, n, u))
    rowY.push(sampleRow(ys, n, u))
  }
  return { x: sampleRow(rowX, n, v), y: sampleRow(rowY, n, v) }
}

export function sampleWarpMesh(pts: Vec2[], n: number, subdiv: number): { grid: Vec2[]; side: number } {
  const side = (n - 1) * subdiv + 1
  const grid: Vec2[] = []
  for (let b = 0; b < side; b++) {
    for (let a = 0; a < side; a++) {
      grid.push(sampleWarpSurface(pts, n, a / subdiv, b / subdiv))
    }
  }
  return { grid, side }
}

export function warpMeshBounds(grid: Vec2[]): Rect {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of grid) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const x = Math.floor(minX)
  const y = Math.floor(minY)
  return { x, y, w: Math.max(1, Math.ceil(maxX) - x), h: Math.max(1, Math.ceil(maxY) - y) }
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  bitmap: HTMLCanvasElement,
  sx0: number, sy0: number, sx1: number, sy1: number, sx2: number, sy2: number,
  dx0: number, dy0: number, dx1: number, dy1: number, dx2: number, dy2: number
): void {
  const den = (sx1 - sx0) * (sy2 - sy0) - (sx2 - sx0) * (sy1 - sy0)
  if (Math.abs(den) < 1e-9) return
  const a = ((dx1 - dx0) * (sy2 - sy0) - (dx2 - dx0) * (sy1 - sy0)) / den
  const b = ((dy1 - dy0) * (sy2 - sy0) - (dy2 - dy0) * (sy1 - sy0)) / den
  const c = ((dx2 - dx0) * (sx1 - sx0) - (dx1 - dx0) * (sx2 - sx0)) / den
  const d = ((dy2 - dy0) * (sx1 - sx0) - (dy1 - dy0) * (sx2 - sx0)) / den
  const e = dx0 - a * sx0 - c * sy0
  const f = dy0 - b * sx0 - d * sy0

  const cx = (dx0 + dx1 + dx2) / 3
  const cy = (dy0 + dy1 + dy2) / 3
  const pad = (px: number, py: number): [number, number] => {
    const lx = px - cx
    const ly = py - cy
    const len = Math.hypot(lx, ly) || 1
    return [px + (lx / len) * 0.5, py + (ly / len) * 0.5]
  }

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(...pad(dx0, dy0))
  ctx.lineTo(...pad(dx1, dy1))
  ctx.lineTo(...pad(dx2, dy2))
  ctx.closePath()
  ctx.clip()
  ctx.transform(a, b, c, d, e, f)
  ctx.drawImage(bitmap, 0, 0)
  ctx.restore()
}

export function renderWarp(
  bitmap: HTMLCanvasElement,
  srcW: number,
  srcH: number,
  grid: Vec2[],
  side: number,
  bounds: Rect
): HTMLCanvasElement | null {
  const out = document.createElement('canvas')
  out.width = bounds.w
  out.height = bounds.h
  const ctx = out.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'medium'
  const sxOf = (a: number): number => (a / (side - 1)) * srcW * (bitmap.width / srcW)
  const syOf = (b: number): number => (b / (side - 1)) * srcH * (bitmap.height / srcH)
  for (let b = 0; b < side - 1; b++) {
    for (let a = 0; a < side - 1; a++) {
      const p00 = grid[b * side + a]
      const p10 = grid[b * side + a + 1]
      const p01 = grid[(b + 1) * side + a]
      const p11 = grid[(b + 1) * side + a + 1]
      const sx0 = sxOf(a)
      const sx1 = sxOf(a + 1)
      const sy0 = syOf(b)
      const sy1 = syOf(b + 1)
      drawTriangle(ctx, bitmap,
        sx0, sy0, sx1, sy0, sx0, sy1,
        p00.x - bounds.x, p00.y - bounds.y, p10.x - bounds.x, p10.y - bounds.y, p01.x - bounds.x, p01.y - bounds.y)
      drawTriangle(ctx, bitmap,
        sx1, sy0, sx1, sy1, sx0, sy1,
        p10.x - bounds.x, p10.y - bounds.y, p11.x - bounds.x, p11.y - bounds.y, p01.x - bounds.x, p01.y - bounds.y)
    }
  }
  return out
}

interface WarpSession {
  nodeId: string
  n: number
  pts: Vec2[]
  baseTransform: Transform
  naturalW: number
  naturalH: number
  dirty: boolean
}

export interface WarpToolApi {
  apply(): boolean
  cancel(): boolean
  isDirty(): boolean
  optionsChanged(): void
}

class WarpTool implements Tool, WarpToolApi {
  readonly control: ToolControl
  private session: WarpSession | null = null
  private dragIndex = -1

  constructor(
    readonly id: string,
    private readonly ctx: ToolContext
  ) {
    this.control = { ...defaultControl(), cursor: 'default', abortMask: Dirty.STRUCTURE }
  }

  private options(): WarpToolOptions {
    return { ...DEFAULT_WARP_OPTIONS, ...this.ctx.options<Partial<WarpToolOptions>>() }
  }

  private activeRaster(): RasterData | null {
    const id = this.ctx.activeNodeId()
    if (!id) return null
    const node = findNode(this.ctx.document().root, id)?.node
    if (!node || node.kind !== 'raster' || node.locks.content) return null
    return node as RasterData
  }

  private ensureSession(): WarpSession | null {
    const node = this.activeRaster()
    if (!node) {
      if (this.session) this.cancel()
      return null
    }
    if (this.session && (this.session.nodeId !== node.id
      || this.session.naturalW !== node.naturalWidth
      || this.session.naturalH !== node.naturalHeight)) {
      this.clearPreview()
      this.session = null
    }
    if (!this.session) {
      const n = Math.max(3, Math.min(8, Math.round(this.options().points)))
      this.session = {
        nodeId: node.id,
        n,
        pts: buildWarpGrid(n, node.naturalWidth, node.naturalHeight),
        baseTransform: { ...node.transform },
        naturalW: node.naturalWidth,
        naturalH: node.naturalHeight,
        dirty: false,
      }
    }
    return this.session
  }

  private node(): RasterData | null {
    if (!this.session) return null
    const node = findNode(this.ctx.document().root, this.session.nodeId)?.node
    return node && node.kind === 'raster' ? (node as RasterData) : null
  }

  private localToDoc(p: Vec2): Vec2 {
    const s = this.session!
    const t = s.baseTransform
    const sx = t.w / (s.naturalW || 1)
    const sy = t.h / (s.naturalH || 1)
    const lx = (p.x - s.naturalW / 2) * sx
    const ly = (p.y - s.naturalH / 2) * sy
    const cos = Math.cos(t.rotation)
    const sin = Math.sin(t.rotation)
    return {
      x: t.x + t.w / 2 + lx * cos - ly * sin,
      y: t.y + t.h / 2 + lx * sin + ly * cos,
    }
  }

  private docToLocal(): (pt: Vec2) => Vec2 {
    const s = this.session!
    return makeToLocal(s.baseTransform, s.naturalW, s.naturalH)
  }

  private hitPoint(pt: Vec2): number {
    if (!this.session) return -1
    const tol = 8 / Math.max(1e-3, this.ctx.zoom())
    for (let k = 0; k < this.session.pts.length; k++) {
      const d = this.localToDoc(this.session.pts[k])
      if (Math.abs(d.x - pt.x) <= tol && Math.abs(d.y - pt.y) <= tol) return k
    }
    return -1
  }

  private rebuildPreview(): void {
    const s = this.session
    const node = this.node()
    if (!s || !node) return
    const entry = this.ctx.content.get(node.contentId)
    if (!entry) return
    const { grid, side } = sampleWarpMesh(s.pts, s.n, WARP_SUBDIV)
    const bounds = warpMeshBounds(grid)
    const warped = renderWarp(entry.canvas, s.naturalW, s.naturalH, grid, side, bounds)
    if (!warped) return
    this.ctx.setPaintPreview(`content:${node.id}`, warped)
    if (node.mask) {
      const maskEntry = this.ctx.content.get(node.mask.contentId)
      if (maskEntry) {
        const warpedMask = renderWarp(maskEntry.canvas, s.naturalW, s.naturalH, grid, side, bounds)
        if (warpedMask) this.ctx.setPaintPreview(`mask:${node.id}`, warpedMask)
      }
    }
    node.transform = this.placedTransform(bounds)
    this.ctx.requestRender()
  }

  private placedTransform(bounds: Rect): Transform {
    const s = this.session!
    const t = s.baseTransform
    const sx = t.w / (s.naturalW || 1)
    const sy = t.h / (s.naturalH || 1)
    const w = bounds.w * sx
    const h = bounds.h * sy
    const center = this.localToDoc({ x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 })
    return { x: center.x - w / 2, y: center.y - h / 2, w, h, rotation: t.rotation }
  }

  private clearPreview(): void {
    if (!this.session) return
    this.ctx.setPaintPreview(`content:${this.session.nodeId}`, null)
    this.ctx.setPaintPreview(`mask:${this.session.nodeId}`, null)
  }

  apply(): boolean {
    const s = this.session
    const node = this.node()
    if (!s || !node || !s.dirty) return false
    const entry = this.ctx.content.get(node.contentId)
    if (!entry) return false
    const { grid, side } = sampleWarpMesh(s.pts, s.n, WARP_SUBDIV)
    const bounds = warpMeshBounds(grid)
    const warped = renderWarp(entry.canvas, s.naturalW, s.naturalH, grid, side, bounds)
    if (!warped) return false

    node.transform = { ...s.baseTransform }
    const before = snapshotRaster(node)

    node.contentId = this.ctx.content.register(warped)
    node.url = undefined
    node.naturalWidth = bounds.w
    node.naturalHeight = bounds.h
    node.transform = this.placedTransform(bounds)
    if (node.mask) {
      const maskEntry = this.ctx.content.get(node.mask.contentId)
      const warpedMask = maskEntry
        ? renderWarp(maskEntry.canvas, s.naturalW, s.naturalH, grid, side, bounds)
        : null
      if (warpedMask) {
        node.mask = { ...node.mask, contentId: this.ctx.content.register(warpedMask), url: undefined }
      }
    }
    this.ctx.history.push(new BakeRasterCommand('Warp', node, before, snapshotRaster(node), this.ctx.content))
    this.clearPreview()
    this.session = null
    this.ensureSession()
    this.ctx.requestRender()
    return true
  }

  cancel(): boolean {
    const s = this.session
    if (!s) return false
    const node = this.node()
    if (node) node.transform = { ...s.baseTransform }
    this.clearPreview()
    this.session = null
    this.ensureSession()
    this.ctx.requestRender()
    return true
  }

  isDirty(): boolean {
    return this.session?.dirty === true
  }

  optionsChanged(): void {
    if (!this.session) return
    if (this.session.n === Math.max(3, Math.min(8, Math.round(this.options().points)))) return
    if (this.session.dirty) this.apply()
    else this.session = null
    this.ensureSession()
    this.ctx.requestRender()
  }

  onActivate(): void {
    this.ensureSession()
    this.ctx.requestRender()
  }

  onDeactivate(): void {
    if (this.session?.dirty) this.apply()
    else this.cancel()
  }

  onButtonPress(_e: PointerEvent, pt: Vec2): void {
    this.ensureSession()
    this.dragIndex = this.hitPoint(pt)
    if (this.dragIndex >= 0) this.control.active = true
  }

  onMotion(_e: PointerEvent, pt: Vec2): void {
    if (this.dragIndex < 0 || !this.session) return
    this.session.pts[this.dragIndex] = this.docToLocal()(pt)
    this.session.dirty = true
    this.rebuildPreview()
  }

  onButtonRelease(): void {
    this.dragIndex = -1
    this.control.active = false
  }

  onHover(): void {}

  cursorFor(pt: Vec2): string {
    this.ensureSession()
    if (!this.session) return 'not-allowed'
    return this.hitPoint(pt) >= 0 ? 'pointer' : 'default'
  }

  drawOverlay(overlay: Overlay): void {
    const s = this.session
    if (!s) return
    const steps = 8
    for (let j = 0; j < s.n; j++) {
      const line: Vec2[] = []
      for (let a = 0; a <= (s.n - 1) * steps; a++) {
        line.push(this.localToDoc(sampleWarpSurface(s.pts, s.n, a / steps, j)))
      }
      overlay.add({ type: 'polyline', points: line })
    }
    for (let i = 0; i < s.n; i++) {
      const line: Vec2[] = []
      for (let b = 0; b <= (s.n - 1) * steps; b++) {
        line.push(this.localToDoc(sampleWarpSurface(s.pts, s.n, i, b / steps)))
      }
      overlay.add({ type: 'polyline', points: line })
    }
    for (const p of s.pts) {
      overlay.add({ type: 'handle', pos: this.localToDoc(p), shape: 'square' })
    }
  }
}

export function isWarpTool(tool: Tool | null): tool is Tool & WarpToolApi {
  return tool != null && tool.id === 'warp'
}

export function makeWarpToolDef(): ToolDef {
  return { id: 'warp', create: (ctx) => new WarpTool('warp', ctx) }
}
