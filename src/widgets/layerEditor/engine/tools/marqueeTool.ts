import { Dirty } from '../history'
import type { Rect, Vec2 } from '../node'
import { defaultControl, type Overlay, type Tool, type ToolContext, type ToolControl, type ToolDef } from '../tool'

function normRect(a: Vec2, b: Vec2): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }
}

class MarqueeTool implements Tool {
  readonly control: ToolControl
  private start: Vec2 | null = null
  private cur: Vec2 | null = null

  constructor(
    readonly id: string,
    private readonly ctx: ToolContext
  ) {
    this.control = { ...defaultControl(), cursor: 'crosshair', abortMask: Dirty.STRUCTURE }
  }

  onButtonPress(_e: PointerEvent, pt: Vec2): void {
    this.start = pt
    this.cur = pt
    this.ctx.requestRender()
  }

  onMotion(_e: PointerEvent, pt: Vec2): void {
    if (!this.start) return
    this.cur = pt
    this.ctx.requestRender()
  }

  onButtonRelease(_e: PointerEvent, pt: Vec2): void {
    if (!this.start) return
    const rect = normRect(this.start, pt)
    this.start = null
    this.cur = null
    if (rect.w < 2 || rect.h < 2) {
      this.ctx.selection.none()
      return
    }
    this.ctx.selection.setRect(rect)
  }

  onHover(): void {}

  cursorFor(): string {
    return 'crosshair'
  }

  drawOverlay(overlay: Overlay): void {
    if (this.start && this.cur) {
      overlay.add({ type: 'rect', rect: normRect(this.start, this.cur), ants: true })
    }
  }
}

export function makeMarqueeToolDef(): ToolDef {
  return { id: 'marquee', create: (ctx) => new MarqueeTool('marquee', ctx) }
}
