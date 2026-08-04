import { SetContentRegionCommand, extractPatch } from '../commands/setContent'
import type { Command } from '../history'
import type { Rect } from '../node'
import type { BrushParams, CoordSample, PaintCore, PaintCoreDef, PaintTarget } from '../paint'
import { registerPaintCore } from '../paint'
import { compositeStrokeRect, type StrokeParams } from './blendStroke'
import { CoverageBuffer, unionOfRects, type DirtyRect } from './coverage'
import { flattenCatmullRom, stepDabs, type StrokePoint } from './interpolate'
import { symmetryTransforms, type SymmetryTransform } from './symmetry'

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [255, 255, 255]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

interface SubStroke {
  transform: SymmetryTransform
  queue: StrokePoint[]
  drawnTo: number
  carry: number
}

class BasePaintCore implements PaintCore {
  private target!: PaintTarget
  private params!: BrushParams
  private cov!: CoverageBuffer
  private base = new Uint8ClampedArray(0)
  private previewCanvas: HTMLCanvasElement | null = null
  private previewData: ImageData | null = null
  private w = 0
  private h = 0
  private subs: SubStroke[] = []
  private lastDelta: DirtyRect[] = []
  private beforeUrl: string | undefined
  private painted = false
  private scale = 1

  constructor(
    private readonly mode: 'brush' | 'eraser',
    private readonly hardEdge: boolean,
    private readonly label: string,
    private readonly additive = false
  ) {}

  start(target: PaintTarget, params: BrushParams, first: CoordSample): void {
    this.target = target
    this.params = params
    this.w = target.bitmap.width
    this.h = target.bitmap.height
    this.cov = new CoverageBuffer(this.w, this.h)
    this.painted = false
    this.beforeUrl = target.slot.url
    this.scale = target.scale > 0 ? target.scale : 1

    const ctx = target.bitmap.getContext('2d')
    this.base = ctx
      ? ctx.getImageData(0, 0, this.w, this.h).data.slice()
      : new Uint8ClampedArray(this.w * this.h * 4)

    this.previewCanvas = document.createElement('canvas')
    this.previewCanvas.width = this.w
    this.previewCanvas.height = this.h
    this.previewData = null

    this.subs = symmetryTransforms(params.symmetry).map((transform) => {
      const p = this.toStrokePoint(transform({ x: first.x, y: first.y }), first.pressure)
      this.stamp(p)
      return { transform, queue: [p], drawnTo: 0, carry: 0 }
    })
  }

  motion(sample: CoordSample): void {
    for (const sub of this.subs) {
      sub.queue.push(this.toStrokePoint(sub.transform({ x: sample.x, y: sample.y }), sample.pressure))
      while (sub.queue.length - 2 > sub.drawnTo) {
        const i = sub.drawnTo
        const q = sub.queue
        this.drawSegment(sub, q[Math.max(0, i - 1)], q[i], q[i + 1], q[Math.min(q.length - 1, i + 2)])
        sub.drawnTo = i + 1
      }
    }
  }

  tick(): void {
    if (!this.additive) return
    for (const sub of this.subs) {
      const last = sub.queue[sub.queue.length - 1]
      if (last) this.stamp(last)
    }
  }

  private toStrokePoint(docPt: { x: number; y: number }, pressure: number): StrokePoint {
    const local = this.target.toLocal(docPt)
    return { x: local.x, y: local.y, pressure: pressure > 0 ? pressure : 1 }
  }

  private drawSegment(sub: SubStroke, p0: StrokePoint, p1: StrokePoint, p2: StrokePoint, p3: StrokePoint): void {
    const spacingPx = Math.max(1, this.params.spacing * this.params.size * this.scale)
    const pts = flattenCatmullRom(p0, p1, p2, p3)
    let prev = p1
    for (const pt of pts) {
      const { dabs, carry } = stepDabs(prev, pt, spacingPx, sub.carry)
      for (const d of dabs) this.stamp(d)
      sub.carry = carry
      prev = pt
    }
  }

  private stamp(p: StrokePoint): void {
    const dyn = this.params.dynamics
    let radius = (this.params.size / 2) * this.scale
    let flow = this.params.flow
    let hardness = this.params.hardness
    if (dyn?.size) radius *= p.pressure
    if (dyn?.opacity) flow *= p.pressure
    if (dyn?.hardness) hardness *= p.pressure
    if (this.additive) flow *= 0.12
    this.cov.stampCircle(p.x, p.y, radius, hardness, flow, this.hardEdge, this.additive)
    this.painted = true
  }

  private strokeParams(): StrokeParams {
    return {
      mode: this.mode,
      channel: this.target.channel,
      color: hexToRgb(this.params.color),
      opacity: this.params.opacity,
      lockAlpha: this.target.lockAlpha === true,
      bgColor: this.params.bgColor ? hexToRgb(this.params.bgColor) : undefined,
    }
  }

  preview(): HTMLCanvasElement | null {
    if (!this.previewCanvas) return null
    const ctx = this.previewCanvas.getContext('2d')
    if (!ctx) return this.previewCanvas
    const rects = this.cov.takeRecentRects()
    this.lastDelta = rects
    if (!this.previewData) {
      const img = ctx.createImageData(this.w, this.h)
      img.data.set(this.base)
      this.previewData = img
      ctx.putImageData(img, 0, 0)
    }
    for (const rect of rects) {
      compositeStrokeRect(
        this.previewData.data,
        this.base,
        (x, y) => this.cov.valueAt(x, y),
        this.strokeParams(),
        this.w,
        rect,
        this.target.selection
      )
      ctx.putImageData(
        this.previewData,
        0,
        0,
        rect.x0,
        rect.y0,
        rect.x1 - rect.x0 + 1,
        rect.y1 - rect.y0 + 1
      )
    }
    return this.previewCanvas
  }

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
    for (const sub of this.subs) {
      const q = sub.queue
      for (let i = sub.drawnTo; i < q.length - 1; i++) {
        this.drawSegment(sub, q[Math.max(0, i - 1)], q[i], q[i + 1], q[Math.min(q.length - 1, i + 2)])
      }
      sub.drawnTo = Math.max(0, q.length - 1)
    }
  }

  finish(): Command | null {
    this.flushTail()
    const dirtyRects = this.cov.dirtyRects()
    if (!this.painted || !unionOfRects(dirtyRects)) return null
    const bytes = this.base.slice()
    for (const r of dirtyRects) {
      compositeStrokeRect(
        bytes,
        this.base,
        (x, y) => this.cov.valueAt(x, y),
        this.strokeParams(),
        this.w,
        r,
        this.target.selection
      )
    }
    const final = document.createElement('canvas')
    final.width = this.w
    final.height = this.h
    const ctx = final.getContext('2d')
    if (!ctx) return null
    const img = ctx.createImageData(this.w, this.h)
    img.data.set(bytes)
    ctx.putImageData(img, 0, 0)
    const afterId = this.target.content.register(final)
    this.target.slot.contentId = afterId
    this.target.slot.url = undefined
    const patches = dirtyRects.map((d) => {
      const rect = { x: d.x0, y: d.y0, w: d.x1 - d.x0 + 1, h: d.y1 - d.y0 + 1 }
      return { rect, before: extractPatch(this.base, this.w, rect), after: extractPatch(bytes, this.w, rect) }
    })
    return new SetContentRegionCommand(this.label, this.target.slot, patches, this.target.content, this.beforeUrl)
  }

  cancel(): void {
    this.painted = false
    this.previewCanvas = null
    this.previewData = null
    this.subs = []
  }
}

export const brushCoreDef: PaintCoreDef = { id: 'brush', create: () => new BasePaintCore('brush', false, 'Brush') }
export const eraserCoreDef: PaintCoreDef = { id: 'eraser', create: () => new BasePaintCore('eraser', false, 'Eraser') }
export const pencilCoreDef: PaintCoreDef = { id: 'pencil', create: () => new BasePaintCore('brush', true, 'Pencil') }
export const airbrushCoreDef: PaintCoreDef = { id: 'airbrush', create: () => new BasePaintCore('brush', false, 'Airbrush', true) }

let registered = false

export function registerBuiltinPaintCores(): void {
  if (registered) return
  registered = true
  registerPaintCore(brushCoreDef)
  registerPaintCore(eraserCoreDef)
  registerPaintCore(pencilCoreDef)
  registerPaintCore(airbrushCoreDef)
}
