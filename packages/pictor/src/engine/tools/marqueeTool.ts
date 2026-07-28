import { Dirty } from '../history'
import type { Rect, Vec2 } from '../node'
import { defaultControl, type Overlay, type Tool, type ToolContext, type ToolControl, type ToolDef } from '../tool'
import { ellipseMask, rectMask, type SelectionOp } from '../editor/selectionMath'

function normRect(a: Vec2, b: Vec2): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }
}

export function selectionOpFromEvent(e: PointerEvent): SelectionOp {
  if (e.shiftKey && (e.ctrlKey || e.metaKey)) return 'intersect'
  if (e.shiftKey) return 'add'
  if (e.ctrlKey || e.metaKey) return 'subtract'
  return 'replace'
}

class MarqueeTool implements Tool {
  readonly control: ToolControl
  private start: Vec2 | null = null
  private cur: Vec2 | null = null
  private op: SelectionOp = 'replace'

  constructor(
    readonly id: string,
    private readonly shape: 'rect' | 'ellipse',
    private readonly ctx: ToolContext
  ) {
    this.control = { ...defaultControl(), cursor: 'crosshair', abortMask: Dirty.STRUCTURE }
  }

  onButtonPress(e: PointerEvent, pt: Vec2): void {
    this.start = pt
    this.cur = pt
    this.op = selectionOpFromEvent(e)
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
      if (this.op === 'replace') this.ctx.selection.none()
      return
    }
    const doc = this.ctx.document()
    const mask = this.shape === 'ellipse'
      ? ellipseMask(doc.width, doc.height, rect)
      : rectMask(doc.width, doc.height, rect)
    this.ctx.selection.combineShape(this.shape === 'ellipse' ? 'Select Ellipse' : 'Select Rectangle', mask, this.op)
  }

  onHover(): void {}

  cursorFor(): string {
    return 'crosshair'
  }

  drawOverlay(overlay: Overlay): void {
    if (!this.start || !this.cur) return
    const rect = normRect(this.start, this.cur)
    if (this.shape === 'rect') {
      overlay.add({ type: 'rect', rect, ants: true })
      return
    }
    const points: Vec2[] = []
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2
      points.push({ x: cx + (Math.cos(a) * rect.w) / 2, y: cy + (Math.sin(a) * rect.h) / 2 })
    }
    overlay.add({ type: 'polyline', points, closed: true })
  }
}

export function makeMarqueeToolDef(): ToolDef {
  return { id: 'marquee', create: (ctx) => new MarqueeTool('marquee', 'rect', ctx) }
}

export function makeEllipseMarqueeToolDef(): ToolDef {
  return { id: 'marquee-ellipse', create: (ctx) => new MarqueeTool('marquee-ellipse', 'ellipse', ctx) }
}
