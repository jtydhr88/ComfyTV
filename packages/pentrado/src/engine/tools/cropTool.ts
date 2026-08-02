import { Dirty } from '../history'
import type { Rect, Vec2 } from '../node'
import { defaultControl, type Overlay, type Tool, type ToolContext, type ToolControl, type ToolDef } from '../tool'

function normRect(a: Vec2, b: Vec2): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }
}

/**
 * Crop tool: drag to define the crop rect (clamped to the document), redrag
 * to redefine, drag inside the pending rect to move it. Committing happens
 * host-side (applyCrop) so the artboard-resize machinery stays in one place.
 */
export class CropTool implements Tool {
  readonly id = 'crop'
  readonly control: ToolControl
  private start: Vec2 | null = null
  private cur: Vec2 | null = null
  private moveFrom: Vec2 | null = null
  private moveBase: Rect | null = null
  private pending: Rect | null = null

  constructor(private readonly ctx: ToolContext) {
    this.control = { ...defaultControl(), cursor: 'crosshair', abortMask: Dirty.STRUCTURE }
  }

  private clamp(r: Rect): Rect {
    const doc = this.ctx.document()
    const x = Math.max(0, Math.min(doc.width - 1, Math.round(r.x)))
    const y = Math.max(0, Math.min(doc.height - 1, Math.round(r.y)))
    return {
      x,
      y,
      w: Math.max(1, Math.min(doc.width - x, Math.round(r.w + r.x) - x)),
      h: Math.max(1, Math.min(doc.height - y, Math.round(r.h + r.y) - y)),
    }
  }

  private inside(r: Rect, pt: Vec2): boolean {
    return pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h
  }

  onButtonPress(_e: PointerEvent, pt: Vec2): void {
    if (this.pending && this.inside(this.pending, pt)) {
      this.moveFrom = pt
      this.moveBase = { ...this.pending }
      return
    }
    this.start = pt
    this.cur = pt
    this.pending = null
    this.ctx.requestRender()
  }

  onMotion(_e: PointerEvent, pt: Vec2): void {
    if (this.moveFrom && this.moveBase) {
      const doc = this.ctx.document()
      const dx = pt.x - this.moveFrom.x
      const dy = pt.y - this.moveFrom.y
      this.pending = {
        ...this.moveBase,
        x: Math.max(0, Math.min(doc.width - this.moveBase.w, Math.round(this.moveBase.x + dx))),
        y: Math.max(0, Math.min(doc.height - this.moveBase.h, Math.round(this.moveBase.y + dy))),
      }
      this.ctx.requestRender()
      return
    }
    if (!this.start) return
    this.cur = pt
    this.ctx.requestRender()
  }

  onButtonRelease(_e: PointerEvent, pt: Vec2): void {
    if (this.moveFrom) {
      this.moveFrom = null
      this.moveBase = null
      this.ctx.requestRender()
      return
    }
    if (!this.start) return
    const rect = this.clamp(normRect(this.start, pt))
    this.start = null
    this.cur = null
    this.pending = rect.w >= 2 && rect.h >= 2 ? rect : null
    this.ctx.requestRender()
  }

  onHover(): void {}

  cursorFor(pt: Vec2): string {
    return this.pending && this.inside(this.pending, pt) ? 'move' : 'crosshair'
  }

  cropRect(): Rect | null {
    return this.pending
  }

  clear(): void {
    this.start = null
    this.cur = null
    this.pending = null
    this.moveFrom = null
    this.moveBase = null
    this.ctx.requestRender()
  }

  drawOverlay(overlay: Overlay): void {
    const rect = this.pending ?? (this.start && this.cur ? this.clamp(normRect(this.start, this.cur)) : null)
    if (!rect) return
    overlay.add({ type: 'rect', rect, ants: true })
    // Rule-of-thirds guides inside the pending crop.
    for (const t of [1 / 3, 2 / 3]) {
      overlay.add({
        type: 'line',
        a: { x: rect.x + rect.w * t, y: rect.y },
        b: { x: rect.x + rect.w * t, y: rect.y + rect.h },
      })
      overlay.add({
        type: 'line',
        a: { x: rect.x, y: rect.y + rect.h * t },
        b: { x: rect.x + rect.w, y: rect.y + rect.h * t },
      })
    }
  }
}

export function isCropTool(tool: Tool | null | undefined): tool is CropTool {
  return tool instanceof CropTool
}

export function makeCropToolDef(): ToolDef {
  return { id: 'crop', create: (ctx) => new CropTool(ctx) }
}
