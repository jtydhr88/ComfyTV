import { Dirty } from '../history'
import type { Vec2 } from '../node'
import type { BrushParams, CoordSample, PaintCore } from '../paint'
import { defaultControl, type Overlay, type Tool, type ToolContext, type ToolControl, type ToolDef } from '../tool'
import { resolvePaintTarget } from './paintTarget'

export const DEFAULT_BRUSH: BrushParams = {
  size: 24,
  hardness: 0.6,
  spacing: 0.1,
  opacity: 1,
  flow: 1,
  color: '#ffffff',
}

function sample(e: PointerEvent | null, pt: Vec2): CoordSample {
  const pressure = e && e.pressure > 0 ? e.pressure : 1
  return { x: pt.x, y: pt.y, pressure, time: 0 }
}

class PaintTool implements Tool {
  readonly control: ToolControl
  private core: PaintCore | null = null
  private lastPt: Vec2 | null = null
  private previewKey: string | null = null

  constructor(
    readonly id: string,
    private readonly ctx: ToolContext,
    private readonly coreId: string,
    private readonly channel: 'content' | 'mask'
  ) {
    this.control = { ...defaultControl(), cursor: 'crosshair', motionMode: 'exact', abortMask: Dirty.STRUCTURE }
  }

  private params(): BrushParams {
    return { ...DEFAULT_BRUSH, ...(this.ctx.options<Partial<BrushParams>>() ?? {}) }
  }

  private pushPreview(): void {
    if (!this.core || !this.previewKey) return
    const canvas = this.core.preview()
    if (canvas) this.ctx.setPaintPreview(this.previewKey, canvas)
  }

  onButtonPress(e: PointerEvent, pt: Vec2): void {
    const target = resolvePaintTarget(this.ctx.document(), this.ctx.content, this.ctx.activeNodeId(), this.channel)
    if (!target) return
    this.core = this.ctx.createPaintCore(this.coreId)
    this.control.active = true
    this.lastPt = pt
    this.previewKey = `${this.channel}:${target.drawable.id}`
    this.core.start(target, this.params(), sample(e, pt))
    this.pushPreview()
    this.ctx.requestRender()
  }

  onMotion(e: PointerEvent, pt: Vec2): void {
    this.lastPt = pt
    if (!this.core) return
    this.core.motion(sample(e, pt))
    this.pushPreview()
    this.ctx.requestRender()
  }

  onButtonRelease(): void {
    if (!this.core) return
    if (this.previewKey) {
      this.ctx.setPaintPreview(this.previewKey, null)
      this.previewKey = null
    }
    const cmd = this.core.finish()
    if (cmd) this.ctx.history.push(cmd)
    this.core = null
    this.control.active = false
    this.ctx.requestRender()
  }

  onHover(_e: PointerEvent, pt: Vec2): void {
    this.lastPt = pt
  }

  cursorFor(): string {
    return 'crosshair'
  }

  drawOverlay(overlay: Overlay): void {
    if (this.lastPt) overlay.add({ type: 'arc', center: this.lastPt, radius: this.params().size / 2 })
  }
}

export function makePaintToolDef(id: string, coreId: string, channel: 'content' | 'mask' = 'content'): ToolDef {
  return { id, create: (ctx) => new PaintTool(id, ctx, coreId, channel) }
}
