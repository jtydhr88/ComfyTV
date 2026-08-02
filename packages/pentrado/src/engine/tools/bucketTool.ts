import { SetContentCommand } from '../commands/setContent'
import { findNode } from '../document'
import { Dirty } from '../history'
import type { RasterData, Vec2 } from '../node'
import { defaultControl, type Overlay, type Tool, type ToolContext, type ToolControl, type ToolDef } from '../tool'
import { combineMasks, floodSelectMask, maskToCanvas } from '../editor/selectionMath'
import { rasterizeSelectionToLocal } from './paintTarget'
import { DEFAULT_WAND_OPTIONS, type WandToolOptions } from './wandTool'

export interface BucketToolOptions extends WandToolOptions {
  color: string
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  const v = m ? parseInt(m[1], 16) : 0
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

class BucketTool implements Tool {
  readonly control: ToolControl

  constructor(
    readonly id: string,
    private readonly ctx: ToolContext
  ) {
    this.control = { ...defaultControl(), cursor: 'crosshair', abortMask: Dirty.STRUCTURE }
  }

  private activeRaster(): RasterData | null {
    const id = this.ctx.activeNodeId()
    const node = id ? findNode(this.ctx.document().root, id)?.node : null
    if (!node || node.kind !== 'raster' || node.locks.content) return null
    return node as RasterData
  }

  onButtonPress(_e: PointerEvent, pt: Vec2): void {
    const node = this.activeRaster()
    if (!node) return
    const opts = { ...DEFAULT_WAND_OPTIONS, color: '#000000', ...this.ctx.options<Partial<BucketToolOptions>>() }
    const px = this.ctx.compositePixels()
    if (!px) return
    let mask = floodSelectMask(px, pt, opts.threshold, opts.antialias, opts.contiguous)
    if (!mask) return
    const sel = this.ctx.selection.currentMask()
    if (sel) mask = combineMasks(mask, sel, 'intersect')
    const maskCanvas = maskToCanvas(mask)
    if (!maskCanvas) return
    const entry = this.ctx.content.get(node.contentId)
    if (!entry) return
    const nw = node.naturalWidth
    const nh = node.naturalHeight
    const tf = node.transform.w > 0 && node.transform.h > 0
      ? node.transform
      : { x: 0, y: 0, w: nw, h: nh, rotation: 0 }
    const cov = rasterizeSelectionToLocal(maskCanvas, tf, nw, nh)
    if (!cov) return

    const out = document.createElement('canvas')
    out.width = nw
    out.height = nh
    const g = out.getContext('2d')
    if (!g) return
    g.drawImage(entry.canvas, 0, 0, nw, nh)
    const img = g.getImageData(0, 0, nw, nh)
    const d = img.data
    const [fr, fg, fb] = hexToRgb(opts.color)
    const lockAlpha = node.lockAlpha === true
    let touched = false
    for (let p = 0; p < cov.length; p++) {
      let c = cov[p]
      if (c <= 0) continue
      const i = p * 4
      const sa = d[i + 3] / 255
      if (lockAlpha) {
        c *= sa
        if (c <= 0) continue
        touched = true
        d[i] = Math.round(fr * c + d[i] * (1 - c))
        d[i + 1] = Math.round(fg * c + d[i + 1] * (1 - c))
        d[i + 2] = Math.round(fb * c + d[i + 2] * (1 - c))
        continue
      }
      touched = true
      const outA = c + sa * (1 - c)
      if (outA <= 0) continue
      d[i] = Math.round((fr * c + d[i] * sa * (1 - c)) / outA)
      d[i + 1] = Math.round((fg * c + d[i + 1] * sa * (1 - c)) / outA)
      d[i + 2] = Math.round((fb * c + d[i + 2] * sa * (1 - c)) / outA)
      d[i + 3] = Math.round(outA * 255)
    }
    if (!touched) return
    g.putImageData(img, 0, 0)
    const beforeId = node.contentId
    const beforeUrl = node.url
    const afterId = this.ctx.content.register(out)
    node.contentId = afterId
    node.url = undefined
    if (node.naturalWidth !== nw) node.naturalWidth = nw
    if (node.naturalHeight !== nh) node.naturalHeight = nh
    this.ctx.history.push(new SetContentCommand('Bucket Fill', node, beforeId, afterId, this.ctx.content, beforeUrl))
    this.ctx.requestRender()
  }

  onMotion(): void {}
  onButtonRelease(): void {}
  onHover(): void {}

  cursorFor(): string {
    return this.activeRaster() ? 'crosshair' : 'not-allowed'
  }

  drawOverlay(_overlay: Overlay): void {}
}

export function makeBucketToolDef(): ToolDef {
  return { id: 'bucket', create: (ctx) => new BucketTool('bucket', ctx) }
}
