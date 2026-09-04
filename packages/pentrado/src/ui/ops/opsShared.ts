import { ADJUST_PARAM_DEFS, type AdjustmentOp } from '../../engine/adjust'
import type { ArrangeOp } from '../../engine/arrange'
import type { BlendFn } from '../../engine/mode'
import type {
  AdjustmentData, FillData, GroupData, RasterData, SceneNode, TextData, VectorData,
} from '../../engine/node'
import { LAYER_FX_DEFS, type LayerFxOp } from '../../engine/render/layerFx'
import { FILTER_PARAM_DEFS, type FilterOp } from '../../filters'
import type { LayerEditorController, MaskInit } from '../useLayerEditorStage'
import type { LayerOp, LayerOpResult } from '../layerEditorOps'

export interface OpCtx {
  ctrl: LayerEditorController
  allIds: () => Set<string>
  find: (id: unknown) => SceneNode
  newIdSince: (before: Set<string>) => string | undefined
  settleFloating: () => void
}

export type OpHandler = (ctx: OpCtx, op: LayerOp, res: LayerOpResult) => Promise<void> | void

export const BLEND_MODES: readonly BlendFn[] = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference',
]
export const MASK_INITS: readonly MaskInit[] = ['white', 'black', 'selection', 'alpha', 'gray']
export const ARRANGE_OPS: readonly ArrangeOp[] = [
  'left', 'hcenter', 'right', 'top', 'vcenter', 'bottom', 'hspread', 'vspread', 'hgap', 'vgap',
]
export const FIT_MODES = ['contain', 'cover', 'stretch'] as const
export const ADJUSTMENT_OPS = Object.keys(ADJUST_PARAM_DEFS) as AdjustmentOp[]
export const FX_OPS = Object.keys(LAYER_FX_DEFS) as LayerFxOp[]
export const FILTER_OPS = Object.keys(FILTER_PARAM_DEFS) as FilterOp[]

export function str(v: unknown, what: string): string {
  if (typeof v !== 'string' || !v) throw new Error(`${what} must be a non-empty string`)
  return v
}
export function num(v: unknown, what: string, fallback?: number): number {
  if (v == null && fallback != null) return fallback
  const n = Number(v)
  if (!Number.isFinite(n)) throw new Error(`${what} must be a number`)
  return n
}
export function bool(v: unknown, what: string): boolean {
  if (typeof v !== 'boolean') throw new Error(`${what} must be true or false`)
  return v
}
export function oneOf<T extends string>(v: unknown, list: readonly T[], what: string): T {
  if (!list.includes(v as T)) throw new Error(`${what} must be one of ${list.join(', ')}`)
  return v as T
}
export function params(v: unknown, what: string, defs?: ReadonlyArray<{ key: string; min?: number; max?: number }>): Record<string, number> {
  if (v == null) return {}
  if (typeof v !== 'object' || Array.isArray(v)) throw new Error(`${what} must be an object of numbers`)
  const out: Record<string, number> = {}
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    const def = defs?.find((d) => d.key === k)
    if (defs && !def) {
      throw new Error(`${what}.${k} is not a parameter here; valid keys: ${defs.map((d) => d.key).join(', ')}`)
    }
    const n = num(raw, `${what}.${k}`)
    if (def && def.min != null && def.max != null && (n < def.min || n > def.max)) {
      throw new Error(`${what}.${k}=${n} is outside its range ${def.min}..${def.max}`)
    }
    out[k] = n
  }
  return out
}

export function walkIds(node: SceneNode, out: Set<string>): void {
  out.add(node.id)
  if (node.kind === 'group') for (const ch of (node as GroupData).children) walkIds(ch, out)
}

export function serializeLayer(node: SceneNode): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: node.id,
    kind: node.kind,
    name: node.name,
    visible: node.visible,
    opacity: node.opacity,
    blend: node.mode.blend,
    transform: { ...node.transform },
    locks: { ...node.locks },
  }
  if (node.clip) base.clip = true
  if (node.mask) base.mask = { enabled: node.mask.enabled !== false, url: node.mask.url ?? null }
  if (node.fx?.length) {
    base.fx = node.fx.map((f) => ({ id: f.id, op: f.op, enabled: f.enabled, opacity: f.opacity, params: { ...f.params } }))
  }
  switch (node.kind) {
    case 'raster': {
      const r = node as RasterData
      base.url = r.url ?? null
      base.natural = { width: r.naturalWidth, height: r.naturalHeight }
      base.lock_alpha = r.lockAlpha
      break
    }
    case 'text': {
      const t = node as TextData
      Object.assign(base, {
        text: t.text, font_ref: t.fontRef, font_size: t.fontSize, color: t.color,
        letter_spacing: t.letterSpacing, line_height: t.lineHeight, align: t.align,
      })
      break
    }
    case 'adjustment': {
      const a = node as AdjustmentData
      base.adjustment = { op: a.op, params: { ...a.params }, curves: a.curves ? { ...a.curves } : undefined }
      break
    }
    case 'fill':
      base.fill = JSON.parse(JSON.stringify((node as FillData).fill))
      break
    case 'vector':
      base.strokes = (node as VectorData).path.strokes.length
      break
    case 'group': {
      const g = node as GroupData
      base.pass_through = g.passThrough
      base.children = g.children.map(serializeLayer)
      break
    }
  }
  return base
}

export function naturalSize(n: SceneNode): { w: number; h: number } {
  if (n.kind === 'raster') {
    const r = n as RasterData
    if (r.naturalWidth > 0 && r.naturalHeight > 0) return { w: r.naturalWidth, h: r.naturalHeight }
  }
  return { w: Math.max(1, n.transform.w), h: Math.max(1, n.transform.h) }
}

export function textPatch(op: LayerOp): Partial<TextData> {
  const patch: Partial<TextData> = {}
  if (op.text != null) patch.text = String(op.text)
  if (op.font_size != null) patch.fontSize = num(op.font_size, 'font_size')
  if (op.color != null) patch.color = str(op.color, 'color')
  if (op.letter_spacing != null) patch.letterSpacing = num(op.letter_spacing, 'letter_spacing')
  if (op.line_height != null) patch.lineHeight = num(op.line_height, 'line_height')
  if (op.align != null) patch.align = oneOf(op.align, ['left', 'center', 'right'] as const, 'align')
  return patch
}
