import { SetContentCommand } from '../commands/setContent'
import { Dirty } from '../history'
import type { Vec2 } from '../node'
import type { PaintTarget } from '../paint'
import { defaultControl, type Overlay, type Tool, type ToolContext, type ToolControl, type ToolDef } from '../tool'
import { resolvePaintTarget } from './paintTarget'

export interface GradientToolOptions {
  shape: 'linear' | 'radial'
  color: string
  endColor: string | null
  reverse: boolean
}

export const DEFAULT_GRADIENT_OPTIONS: GradientToolOptions = {
  shape: 'linear',
  color: '#000000',
  endColor: null,
  reverse: false,
}

function hexRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const v = m ? parseInt(m[1], 16) : 0
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

export function renderGradientPixels(
  base: Uint8ClampedArray,
  width: number,
  height: number,
  a: Vec2,
  b: Vec2,
  opts: GradientToolOptions,
  selection?: Float32Array | null,
  lockAlpha = false
): Uint8ClampedArray {
  const out = base.slice()
  const [r1, g1, b1] = hexRgb(opts.color)
  const [r2, g2, b2] = opts.endColor ? hexRgb(opts.endColor) : [r1, g1, b1]
  const a1 = 1
  const a2 = opts.endColor ? 1 : 0
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 <= 1e-9) return out
  const len = Math.sqrt(len2)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      let t =
        opts.shape === 'linear'
          ? ((x + 0.5 - a.x) * dx + (y + 0.5 - a.y) * dy) / len2
          : Math.hypot(x + 0.5 - a.x, y + 0.5 - a.y) / len
      t = Math.max(0, Math.min(1, t))
      if (opts.reverse) t = 1 - t
      const cov = (selection ? selection[p] : 1) * (a1 + (a2 - a1) * t)
      if (cov <= 0) continue
      const cr = r1 + (r2 - r1) * t
      const cg = g1 + (g2 - g1) * t
      const cb = b1 + (b2 - b1) * t
      const i = p * 4
      const ba = out[i + 3] / 255
      if (lockAlpha) {
        out[i] = Math.round(out[i] + (cr - out[i]) * cov)
        out[i + 1] = Math.round(out[i + 1] + (cg - out[i + 1]) * cov)
        out[i + 2] = Math.round(out[i + 2] + (cb - out[i + 2]) * cov)
        continue
      }
      const outA = cov + ba * (1 - cov)
      if (outA <= 0) continue
      out[i] = Math.round((cr * cov + out[i] * ba * (1 - cov)) / outA)
      out[i + 1] = Math.round((cg * cov + out[i + 1] * ba * (1 - cov)) / outA)
      out[i + 2] = Math.round((cb * cov + out[i + 2] * ba * (1 - cov)) / outA)
      out[i + 3] = Math.round(outA * 255)
    }
  }
  return out
}

interface Session {
  target: PaintTarget
  base: Uint8ClampedArray
  startDoc: Vec2
  curDoc: Vec2
  beforeUrl: string | undefined
  canvas: HTMLCanvasElement
}

class GradientTool implements Tool {
  readonly control: ToolControl
  private session: Session | null = null

  constructor(
    readonly id: string,
    private readonly ctx: ToolContext
  ) {
    this.control = { ...defaultControl(), cursor: 'crosshair', abortMask: Dirty.STRUCTURE }
  }

  private options(): GradientToolOptions {
    return { ...DEFAULT_GRADIENT_OPTIONS, ...(this.ctx.options<Partial<GradientToolOptions>>() ?? {}) }
  }

  onButtonPress(_e: PointerEvent, pt: Vec2): void {
    const target = resolvePaintTarget(this.ctx.document(), this.ctx.content, this.ctx.activeNodeId(), 'content')
    if (!target) return
    const g = target.bitmap.getContext('2d')
    const base = g
      ? g.getImageData(0, 0, target.bitmap.width, target.bitmap.height).data.slice()
      : new Uint8ClampedArray(target.bitmap.width * target.bitmap.height * 4)
    const canvas = document.createElement('canvas')
    canvas.width = target.bitmap.width
    canvas.height = target.bitmap.height
    this.session = { target, base, startDoc: pt, curDoc: pt, beforeUrl: target.slot.url, canvas }
    this.control.active = true
  }

  onMotion(_e: PointerEvent, pt: Vec2): void {
    const s = this.session
    if (!s) return
    s.curDoc = pt
    this.renderPreview()
    this.ctx.requestRender()
  }

  private renderPixels(): Uint8ClampedArray {
    const s = this.session!
    const a = s.target.toLocal(s.startDoc)
    const b = s.target.toLocal(s.curDoc)
    return renderGradientPixels(
      s.base,
      s.canvas.width,
      s.canvas.height,
      a,
      b,
      this.options(),
      s.target.selection,
      s.target.lockAlpha === true
    )
  }

  private renderPreview(): void {
    const s = this.session
    if (!s) return
    const g = s.canvas.getContext('2d')
    if (!g) return
    const img = g.createImageData(s.canvas.width, s.canvas.height)
    img.data.set(this.renderPixels())
    g.putImageData(img, 0, 0)
    this.ctx.setPaintPreview(`content:${s.target.drawable.id}`, s.canvas)
  }

  onButtonRelease(): void {
    const s = this.session
    this.session = null
    this.control.active = false
    if (!s) return
    this.ctx.setPaintPreview(`content:${s.target.drawable.id}`, null)
    const moved = Math.hypot(s.curDoc.x - s.startDoc.x, s.curDoc.y - s.startDoc.y) > 1
    if (!moved) {
      this.ctx.requestRender()
      return
    }
    const final = document.createElement('canvas')
    final.width = s.canvas.width
    final.height = s.canvas.height
    const g = final.getContext('2d')
    if (!g) return
    const img = g.createImageData(final.width, final.height)
    img.data.set(this.renderPixels())
    g.putImageData(img, 0, 0)
    const beforeId = s.target.slot.contentId
    const afterId = this.ctx.content.register(final)
    s.target.slot.contentId = afterId
    s.target.slot.url = undefined
    this.ctx.history.push(
      new SetContentCommand('Gradient', s.target.slot, beforeId, afterId, this.ctx.content, s.beforeUrl)
    )
    this.ctx.requestRender()
  }

  onHover(): void {}

  cursorFor(): string {
    const target = resolvePaintTarget(this.ctx.document(), this.ctx.content, this.ctx.activeNodeId(), 'content')
    return target ? 'crosshair' : 'not-allowed'
  }

  drawOverlay(overlay: Overlay): void {
    const s = this.session
    if (!s) return
    overlay.add({ type: 'line', a: s.startDoc, b: s.curDoc })
    overlay.add({ type: 'handle', pos: s.startDoc, shape: 'circle' })
    overlay.add({ type: 'handle', pos: s.curDoc, shape: 'circle' })
  }
}

export function makeGradientToolDef(): ToolDef {
  return { id: 'gradient', create: (ctx) => new GradientTool('gradient', ctx) }
}
