import { SetContentCommand } from '../commands/setContent'
import type { Command } from '../history'
import type { Vec2 } from '../node'
import type { BrushParams, CoordSample, PaintCore, PaintCoreDef, PaintTarget } from '../paint'
import { registerPaintCore } from '../paint'
import { compositeStroke, type StrokeParams } from './blendStroke'
import { CoverageBuffer } from './coverage'
import { stepStroke } from './interpolate'

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [255, 255, 255]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

class BasePaintCore implements PaintCore {
  private target!: PaintTarget
  private params!: BrushParams
  private cov!: CoverageBuffer
  private base = new Uint8ClampedArray(0)
  private previewCanvas: HTMLCanvasElement | null = null
  private w = 0
  private h = 0
  private carry = 0
  private last: Vec2 = { x: 0, y: 0 }
  private beforeId = ''
  private painted = false
  private scale = 1

  constructor(
    private readonly mode: 'brush' | 'eraser',
    private readonly hardEdge: boolean,
    private readonly label: string
  ) {}

  start(target: PaintTarget, params: BrushParams, first: CoordSample): void {
    this.target = target
    this.params = params
    this.w = target.bitmap.width
    this.h = target.bitmap.height
    this.cov = new CoverageBuffer(this.w, this.h)
    this.carry = 0
    this.painted = false
    this.beforeId = target.slot.contentId
    this.scale = target.scale > 0 ? target.scale : 1

    const ctx = target.bitmap.getContext('2d')
    this.base = ctx
      ? ctx.getImageData(0, 0, this.w, this.h).data.slice()
      : new Uint8ClampedArray(this.w * this.h * 4)

    this.previewCanvas = document.createElement('canvas')
    this.previewCanvas.width = this.w
    this.previewCanvas.height = this.h

    this.last = target.toLocal({ x: first.x, y: first.y })
    this.stamp(this.last)
  }

  motion(sample: CoordSample): void {
    const cur = this.target.toLocal({ x: sample.x, y: sample.y })

    const spacingPx = Math.max(1, this.params.spacing * this.params.size * this.scale)
    const { dabs, carry } = stepStroke(this.last, cur, spacingPx, this.carry)
    for (const d of dabs) this.stamp(d)
    this.carry = carry
    this.last = cur
  }

  private stamp(local: Vec2): void {
    const radius = (this.params.size / 2) * this.scale
    this.cov.stampCircle(local.x, local.y, radius, this.params.hardness, this.params.flow, this.hardEdge)
    this.painted = true
  }

  private strokeParams(): StrokeParams {
    return {
      mode: this.mode,
      channel: this.target.channel,
      color: hexToRgb(this.params.color),
      opacity: this.params.opacity,
    }
  }

  private paintInto(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const bytes = compositeStroke(this.base, this.cov.data, this.strokeParams())
    const img = ctx.createImageData(this.w, this.h)
    img.data.set(bytes)
    ctx.putImageData(img, 0, 0)
  }

  preview(): HTMLCanvasElement | null {
    if (!this.previewCanvas) return null
    this.paintInto(this.previewCanvas)
    return this.previewCanvas
  }

  finish(): Command | null {
    if (!this.painted) return null
    const final = document.createElement('canvas')
    final.width = this.w
    final.height = this.h
    this.paintInto(final)
    const afterId = this.target.content.register(final)
    this.target.slot.contentId = afterId
    return new SetContentCommand(this.label, this.target.slot, this.beforeId, afterId, this.target.content)
  }

  cancel(): void {
    this.painted = false
    this.previewCanvas = null
  }
}

export const brushCoreDef: PaintCoreDef = { id: 'brush', create: () => new BasePaintCore('brush', false, 'Brush') }
export const eraserCoreDef: PaintCoreDef = { id: 'eraser', create: () => new BasePaintCore('eraser', false, 'Eraser') }
export const pencilCoreDef: PaintCoreDef = { id: 'pencil', create: () => new BasePaintCore('brush', true, 'Pencil') }

let registered = false

export function registerBuiltinPaintCores(): void {
  if (registered) return
  registered = true
  registerPaintCore(brushCoreDef)
  registerPaintCore(eraserCoreDef)
  registerPaintCore(pencilCoreDef)
}
