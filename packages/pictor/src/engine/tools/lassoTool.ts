import { Dirty } from '../history'
import type { Vec2 } from '../node'
import { defaultControl, type Overlay, type Tool, type ToolContext, type ToolControl, type ToolDef } from '../tool'
import { polygonMask, type SelectionOp } from '../editor/selectionMath'
import { selectionOpFromEvent } from './marqueeTool'

class LassoTool implements Tool {
  readonly control: ToolControl
  private points: Vec2[] = []
  private active = false
  private op: SelectionOp = 'replace'

  constructor(
    readonly id: string,
    private readonly ctx: ToolContext
  ) {
    this.control = { ...defaultControl(), cursor: 'crosshair', abortMask: Dirty.STRUCTURE }
  }

  onButtonPress(e: PointerEvent, pt: Vec2): void {
    this.points = [pt]
    this.active = true
    this.op = selectionOpFromEvent(e)
    this.ctx.requestRender()
  }

  onMotion(_e: PointerEvent, pt: Vec2): void {
    if (!this.active) return
    const last = this.points[this.points.length - 1]
    if (Math.hypot(pt.x - last.x, pt.y - last.y) < 1.5) return
    this.points.push(pt)
    this.ctx.requestRender()
  }

  onButtonRelease(): void {
    if (!this.active) return
    this.active = false
    const pts = this.points
    this.points = []
    if (pts.length < 3) {
      if (this.op === 'replace') this.ctx.selection.none()
      return
    }
    const doc = this.ctx.document()
    this.ctx.selection.combineShape('Free Select', polygonMask(doc.width, doc.height, pts), this.op)
  }

  onHover(): void {}

  cursorFor(): string {
    return 'crosshair'
  }

  drawOverlay(overlay: Overlay): void {
    if (this.points.length > 1) {
      overlay.add({ type: 'polyline', points: this.points, closed: false })
    }
  }
}

export function makeLassoToolDef(): ToolDef {
  return { id: 'lasso', create: (ctx) => new LassoTool('lasso', ctx) }
}
