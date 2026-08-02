import { SetContentRegionCommand, extractPatch } from '../commands/setContent'
import type { Command } from '../history'
import type { Rect, Vec2 } from '../node'
import type { BrushParams, CoordSample, PaintCore, PaintCoreDef, PaintTarget } from '../paint'
import { registerPaintCore } from '../paint'
import type { DirtyRect } from './coverage'
import { flattenCatmullRom, stepDabs, type StrokePoint } from './interpolate'
import { getStamp, quantizeSubpixel } from './stampCache'

export type PixelOp = 'smudge' | 'clone' | 'dodge' | 'burn'

let cloneSource: Vec2 | null = null

export function setCloneSource(pt: Vec2 | null): void {
  cloneSource = pt ? { ...pt } : null
}

export function getCloneSource(): Vec2 | null {
  return cloneSource
}

export function dodgeBurnValue(v: number, exposure: number, burn: boolean): number {
  const e = Math.max(0, Math.min(1, exposure))
  const g = burn ? 1 + e : 1 / (1 + e)
  return Math.pow(Math.max(0, Math.min(1, v)), g)
}

class PixelPaintCore implements PaintCore {
  private target!: PaintTarget
  private params!: BrushParams
  private base = new Uint8ClampedArray(0)
  private work = new Uint8ClampedArray(0)
  private previewCanvas: HTMLCanvasElement | null = null
  private w = 0
  private h = 0
  private queue: StrokePoint[] = []
  private drawnTo = 0
  private carry = 0
  private dirty: DirtyRect | null = null
  private recent: DirtyRect | null = null
  private lastDelta: DirtyRect[] = []
  private beforeUrl: string | undefined
  private painted = false
  private scale = 1
  private cloneOffset: Vec2 | null = null
  private accum: Float32Array | null = null
  private accumSize = 0

  constructor(
    private readonly op: PixelOp,
    private readonly label: string
  ) {}

  start(target: PaintTarget, params: BrushParams, first: CoordSample): void {
    this.target = target
    this.params = params
    this.w = target.bitmap.width
    this.h = target.bitmap.height
    this.painted = false
    this.dirty = null
    this.recent = null
    this.beforeUrl = target.slot.url
    this.scale = target.scale > 0 ? target.scale : 1
    this.accum = null

    const ctx = target.bitmap.getContext('2d')
    this.base = ctx
      ? ctx.getImageData(0, 0, this.w, this.h).data.slice()
      : new Uint8ClampedArray(this.w * this.h * 4)
    this.work = this.base.slice()

    this.previewCanvas = document.createElement('canvas')
    this.previewCanvas.width = this.w
    this.previewCanvas.height = this.h
    this.previewData = null

    const p = this.toStrokePoint(first)
    if (this.op === 'clone') {
      const src = cloneSource ? this.target.toLocal(cloneSource) : null
      this.cloneOffset = src ? { x: src.x - p.x, y: src.y - p.y } : null
    }
    this.queue = [p]
    this.drawnTo = 0
    this.carry = 0
    this.stamp(p)
  }

  modifierPress(pt: Vec2): boolean {
    if (this.op !== 'clone') return false
    setCloneSource(pt)
    return true
  }

  motion(sample: CoordSample): void {
    this.queue.push(this.toStrokePoint(sample))
    while (this.queue.length - 2 > this.drawnTo) {
      const i = this.drawnTo
      const q = this.queue
      this.drawSegment(q[Math.max(0, i - 1)], q[i], q[i + 1], q[Math.min(q.length - 1, i + 2)])
      this.drawnTo = i + 1
    }
  }

  private toStrokePoint(sample: CoordSample | Vec2): StrokePoint {
    const local = this.target.toLocal({ x: sample.x, y: sample.y })
    const pressure = 'pressure' in sample && sample.pressure > 0 ? sample.pressure : 1
    return { x: local.x, y: local.y, pressure }
  }

  private drawSegment(p0: StrokePoint, p1: StrokePoint, p2: StrokePoint, p3: StrokePoint): void {
    const spacingPx = Math.max(1, this.params.spacing * this.params.size * this.scale)
    const pts = flattenCatmullRom(p0, p1, p2, p3)
    let prev = p1
    for (const pt of pts) {
      const { dabs, carry } = stepDabs(prev, pt, spacingPx, this.carry)
      for (const d of dabs) this.stamp(d)
      this.carry = carry
      prev = pt
    }
  }

  private stamp(p: StrokePoint): void {
    const radius = (this.params.size / 2) * this.scale
    if (radius <= 0) return
    const strength = Math.max(0, Math.min(1, this.params.opacity))
    const ix = Math.floor(p.x)
    const iy = Math.floor(p.y)
    const stamp = getStamp(radius, this.params.hardness, false, quantizeSubpixel(p.x - ix), quantizeSubpixel(p.y - iy))
    const ox = ix - stamp.center
    const oy = iy - stamp.center
    const x0 = Math.max(0, ox)
    const y0 = Math.max(0, oy)
    const x1 = Math.min(this.w - 1, ox + stamp.size - 1)
    const y1 = Math.min(this.h - 1, oy + stamp.size - 1)
    if (x1 < x0 || y1 < y0) return

    if (this.op === 'smudge') this.ensureAccum(stamp.size, stamp.center, ix, iy)

    const sel = this.target.selection
    for (let y = y0; y <= y1; y++) {
      const srow = (y - oy) * stamp.size
      for (let x = x0; x <= x1; x++) {
        const m = stamp.data[srow + (x - ox)]
        if (m <= 0) continue
        const pIdx = y * this.w + x
        const cov = m * strength * (sel ? sel[pIdx] : 1)
        if (cov <= 0) continue
        this.applyPixel(x, y, pIdx * 4, cov, srow + (x - ox), stamp.size)
      }
    }
    this.expandRects(x0, y0, x1, y1)
    this.painted = true
  }

  private ensureAccum(size: number, center: number, ix: number, iy: number): void {
    if (this.accum && this.accumSize === size) return
    this.accum = new Float32Array(size * size * 4)
    this.accumSize = size
    for (let sy = 0; sy < size; sy++) {
      const y = iy - center + sy
      for (let sx = 0; sx < size; sx++) {
        const x = ix - center + sx
        const a = (sy * size + sx) * 4
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue
        const i = (y * this.w + x) * 4
        this.accum[a] = this.work[i]
        this.accum[a + 1] = this.work[i + 1]
        this.accum[a + 2] = this.work[i + 2]
        this.accum[a + 3] = this.work[i + 3]
      }
    }
  }

  private applyPixel(x: number, y: number, i: number, cov: number, stampIdx: number, stampSize: number): void {
    const w = this.work
    const lockAlpha = this.target.lockAlpha === true
    if (this.op === 'dodge' || this.op === 'burn') {
      const burn = this.op === 'burn'
      for (let c = 0; c < 3; c++) {
        const v = w[i + c] / 255
        const t = dodgeBurnValue(v, this.params.opacity, burn)
        w[i + c] = Math.round((v + (t - v) * cov) * 255)
      }
      return
    }
    if (this.op === 'clone') {
      const off = this.cloneOffset
      if (!off) return
      const sx = Math.round(x + off.x)
      const sy = Math.round(y + off.y)
      if (sx < 0 || sy < 0 || sx >= this.w || sy >= this.h) return
      const s = (sy * this.w + sx) * 4
      for (let c = 0; c < 3; c++) w[i + c] = Math.round(w[i + c] + (this.base[s + c] - w[i + c]) * cov)
      if (!lockAlpha) w[i + 3] = Math.round(w[i + 3] + (this.base[s + 3] - w[i + 3]) * cov)
      return
    }
    const a = (Math.floor(stampIdx / stampSize) * this.accumSize + (stampIdx % stampSize)) * 4
    const accum = this.accum!
    const rate = 0.8 * this.params.opacity
    for (let c = 0; c < 4; c++) {
      if (c === 3 && lockAlpha) {
        accum[a + 3] = accum[a + 3] * rate + w[i + 3] * (1 - rate)
        continue
      }
      accum[a + c] = accum[a + c] * rate + w[i + c] * (1 - rate)
      w[i + c] = Math.round(w[i + c] + (accum[a + c] - w[i + c]) * cov)
    }
  }

  private expandRects(x0: number, y0: number, x1: number, y1: number): void {
    for (const key of ['dirty', 'recent'] as const) {
      const r = this[key]
      if (!r) this[key] = { x0, y0, x1, y1 }
      else {
        r.x0 = Math.min(r.x0, x0)
        r.y0 = Math.min(r.y0, y0)
        r.x1 = Math.max(r.x1, x1)
        r.y1 = Math.max(r.y1, y1)
      }
    }
  }

  preview(): HTMLCanvasElement | null {
    if (!this.previewCanvas) return null
    const ctx = this.previewCanvas.getContext('2d')
    if (!ctx) return this.previewCanvas
    const rect = this.recent
    this.recent = null
    this.lastDelta = rect ? [rect] : []
    if (!this.previewData) {
      const img = ctx.createImageData(this.w, this.h)
      img.data.set(this.work)
      this.previewData = img
      ctx.putImageData(img, 0, 0)
    } else if (rect) {
      const rowStart = rect.x0 * 4
      const rowLen = (rect.x1 - rect.x0 + 1) * 4
      for (let y = rect.y0; y <= rect.y1; y++) {
        const off = y * this.w * 4 + rowStart
        this.previewData.data.set(this.work.subarray(off, off + rowLen), off)
      }
      ctx.putImageData(this.previewData, 0, 0, rect.x0, rect.y0, rect.x1 - rect.x0 + 1, rect.y1 - rect.y0 + 1)
    }
    return this.previewCanvas
  }
  private previewData: ImageData | null = null

  previewDocRects(): Rect[] | null {
    if (!this.lastDelta.length || !this.target.toDocRect) return null
    if (this.target.channel === 'content') {
      const fx = (this.target.drawable as { fx?: Array<{ enabled: boolean }> }).fx
      if (fx?.some((f) => f.enabled)) return null
    }
    const toDoc = this.target.toDocRect
    return this.lastDelta.map((r) => toDoc(r))
  }

  private flushTail(): void {
    const q = this.queue
    for (let i = this.drawnTo; i < q.length - 1; i++) {
      this.drawSegment(q[Math.max(0, i - 1)], q[i], q[i + 1], q[Math.min(q.length - 1, i + 2)])
    }
    this.drawnTo = Math.max(0, q.length - 1)
  }

  finish(): Command | null {
    this.flushTail()
    const dirty = this.dirty
    if (!this.painted || !dirty) return null
    const rect = { x: dirty.x0, y: dirty.y0, w: dirty.x1 - dirty.x0 + 1, h: dirty.y1 - dirty.y0 + 1 }
    const final = document.createElement('canvas')
    final.width = this.w
    final.height = this.h
    const ctx = final.getContext('2d')
    if (!ctx) return null
    const img = ctx.createImageData(this.w, this.h)
    img.data.set(this.work)
    ctx.putImageData(img, 0, 0)
    const afterId = this.target.content.register(final)
    this.target.slot.contentId = afterId
    this.target.slot.url = undefined
    return new SetContentRegionCommand(
      this.label,
      this.target.slot,
      [{ rect, before: extractPatch(this.base, this.w, rect), after: extractPatch(this.work, this.w, rect) }],
      this.target.content,
      this.beforeUrl
    )
  }

  cancel(): void {
    this.painted = false
    this.previewCanvas = null
    this.previewData = null
    this.queue = []
    this.drawnTo = 0
  }
}

export const smudgeCoreDef: PaintCoreDef = { id: 'smudge', create: () => new PixelPaintCore('smudge', 'Smudge') }
export const cloneCoreDef: PaintCoreDef = { id: 'clone', create: () => new PixelPaintCore('clone', 'Clone') }
export const dodgeCoreDef: PaintCoreDef = { id: 'dodge', create: () => new PixelPaintCore('dodge', 'Dodge') }
export const burnCoreDef: PaintCoreDef = { id: 'burn', create: () => new PixelPaintCore('burn', 'Burn') }

let registered = false

export function registerPixelPaintCores(): void {
  if (registered) return
  registered = true
  registerPaintCore(smudgeCoreDef)
  registerPaintCore(cloneCoreDef)
  registerPaintCore(dodgeCoreDef)
  registerPaintCore(burnCoreDef)
}
