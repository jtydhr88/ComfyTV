import { Dirty } from '../history'
import type { Vec2 } from '../node'
import { defaultControl, type Overlay, type Tool, type ToolContext, type ToolControl, type ToolDef } from '../tool'
import { floodSelectMask, type SelectionOp } from '../editor/selectionMath'
import { selectionOpFromEvent } from './marqueeTool'

export interface WandToolOptions {
  threshold: number
  antialias: boolean
  contiguous: boolean
}

export const DEFAULT_WAND_OPTIONS: WandToolOptions = { threshold: 0.15, antialias: true, contiguous: true }

class WandTool implements Tool {
  readonly control: ToolControl

  constructor(
    readonly id: string,
    private readonly ctx: ToolContext
  ) {
    this.control = { ...defaultControl(), cursor: 'crosshair', abortMask: Dirty.STRUCTURE }
  }

  onButtonPress(e: PointerEvent, pt: Vec2): void {
    const op: SelectionOp = selectionOpFromEvent(e)
    const opts = { ...DEFAULT_WAND_OPTIONS, ...this.ctx.options<Partial<WandToolOptions>>() }
    const px = this.ctx.compositePixels()
    if (!px) return
    const mask = floodSelectMask(px, pt, opts.threshold, opts.antialias, opts.contiguous)
    if (!mask) return
    this.ctx.selection.combineShape(opts.contiguous ? 'Fuzzy Select' : 'Select by Color', mask, op)
  }

  onMotion(): void {}
  onButtonRelease(): void {}
  onHover(): void {}

  cursorFor(): string {
    return 'crosshair'
  }

  drawOverlay(_overlay: Overlay): void {}
}

export function makeWandToolDef(): ToolDef {
  return { id: 'wand', create: (ctx) => new WandTool('wand', ctx) }
}
