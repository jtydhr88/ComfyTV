import { generateId } from '../id'

export type LayerFxOp =
  | 'drop-shadow' | 'gaussian-blur' | 'unsharp-mask' | 'median-blur'
  | 'vignette' | 'emboss' | 'pixelate' | 'noise' | 'desaturate'
  | 'stroke' | 'outer-glow' | 'inner-glow' | 'inner-shadow' | 'color-overlay' | 'bevel'

export interface LayerFxData {
  id: string
  op: LayerFxOp
  params: Record<string, number>
  enabled: boolean
  opacity: number
}

export interface LayerFxParamDef {
  key: string
  min: number
  max: number
  default: number
  step?: number
  color?: boolean
}

export const LAYER_FX_DEFS: Record<LayerFxOp, LayerFxParamDef[]> = {
  'drop-shadow': [
    { key: 'x', min: -100, max: 100, default: 8, step: 1 },
    { key: 'y', min: -100, max: 100, default: 8, step: 1 },
    { key: 'stdDev', min: 0, max: 60, default: 6, step: 1 },
    { key: 'shadowOpacity', min: 0, max: 1, default: 0.6, step: 0.01 },
    { key: 'color', min: 0, max: 0xffffff, default: 0, color: true },
  ],
  'gaussian-blur': [{ key: 'stdDev', min: 0.5, max: 60, default: 4, step: 0.5 }],
  'unsharp-mask': [
    { key: 'stdDev', min: 0.5, max: 40, default: 3, step: 0.5 },
    { key: 'scale', min: 0, max: 5, default: 0.5, step: 0.05 },
  ],
  'median-blur': [{ key: 'radius', min: 1, max: 20, default: 3, step: 1 }],
  vignette: [
    { key: 'radius', min: 0, max: 3, default: 1.2, step: 0.05 },
    { key: 'softness', min: 0.05, max: 3, default: 0.8, step: 0.05 },
    { key: 'gamma', min: 0.1, max: 4, default: 1, step: 0.05 },
  ],
  emboss: [
    { key: 'azimuth', min: 0, max: 360, default: 30, step: 1 },
    { key: 'elevation', min: 0, max: 90, default: 45, step: 1 },
    { key: 'depth', min: 1, max: 60, default: 20, step: 1 },
  ],
  pixelate: [{ key: 'size', min: 2, max: 64, default: 8, step: 1 }],
  noise: [{ key: 'amount', min: 0, max: 1, default: 0.2, step: 0.01 }],
  desaturate: [{ key: 'amount', min: 0, max: 1, default: 1, step: 0.01 }],
  stroke: [
    { key: 'size', min: 1, max: 60, default: 4, step: 1 },
    { key: 'position', min: 0, max: 2, default: 0, step: 1 },
    { key: 'strokeOpacity', min: 0, max: 1, default: 1, step: 0.01 },
    { key: 'color', min: 0, max: 0xffffff, default: 0xdd3322, color: true },
  ],
  'outer-glow': [
    { key: 'size', min: 1, max: 120, default: 12, step: 1 },
    { key: 'glowOpacity', min: 0, max: 1, default: 0.75, step: 0.01 },
    { key: 'color', min: 0, max: 0xffffff, default: 0xffe680, color: true },
  ],
  'inner-glow': [
    { key: 'size', min: 1, max: 120, default: 12, step: 1 },
    { key: 'glowOpacity', min: 0, max: 1, default: 0.75, step: 0.01 },
    { key: 'color', min: 0, max: 0xffffff, default: 0xffe680, color: true },
  ],
  'inner-shadow': [
    { key: 'x', min: -100, max: 100, default: 4, step: 1 },
    { key: 'y', min: -100, max: 100, default: 4, step: 1 },
    { key: 'size', min: 1, max: 100, default: 8, step: 1 },
    { key: 'shadowOpacity', min: 0, max: 1, default: 0.6, step: 0.01 },
    { key: 'color', min: 0, max: 0xffffff, default: 0, color: true },
  ],
  'color-overlay': [
    { key: 'overlayOpacity', min: 0, max: 1, default: 1, step: 0.01 },
    { key: 'color', min: 0, max: 0xffffff, default: 0xdd3322, color: true },
  ],
  bevel: [
    { key: 'size', min: 1, max: 60, default: 6, step: 1 },
    { key: 'depth', min: 0, max: 1, default: 0.5, step: 0.01 },
    { key: 'angle', min: 0, max: 360, default: 120, step: 1 },
  ],
}

export const LAYER_FX_OPS = Object.keys(LAYER_FX_DEFS) as LayerFxOp[]

export function defaultFxParams(op: LayerFxOp): Record<string, number> {
  const out: Record<string, number> = {}
  for (const def of LAYER_FX_DEFS[op]) out[def.key] = def.default
  return out
}

export function createLayerFx(op: LayerFxOp): LayerFxData {
  return { id: generateId('fx'), op, params: defaultFxParams(op), enabled: true, opacity: 1 }
}

export function normalizeLayerFx(raw: unknown): LayerFxData[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: LayerFxData[] = []
  for (const item of raw) {
    const r = (item ?? {}) as Record<string, unknown>
    const op = r.op as LayerFxOp
    if (typeof op !== 'string' || !(op in LAYER_FX_DEFS)) continue
    const params = defaultFxParams(op)
    const rp = (r.params ?? {}) as Record<string, unknown>
    for (const key of Object.keys(params)) {
      if (typeof rp[key] === 'number' && isFinite(rp[key] as number)) params[key] = rp[key] as number
    }
    out.push({
      id: typeof r.id === 'string' ? r.id : generateId('fx'),
      op,
      params,
      enabled: r.enabled !== false,
      opacity: typeof r.opacity === 'number' ? Math.max(0, Math.min(1, r.opacity)) : 1,
    })
  }
  return out.length ? out : undefined
}

export function fxStamp(fx: LayerFxData[]): string {
  return fx
    .map((f) => `${f.op}:${f.enabled ? 1 : 0}:${f.opacity}:${Object.keys(f.params).sort().map((k) => `${k}=${f.params[k]}`).join(',')}`)
    .join(';')
}

export function fxPad(f: LayerFxData): number {
  if (!f.enabled) return 0
  if (f.op === 'drop-shadow') {
    return Math.ceil(3 * (f.params.stdDev ?? 0) + Math.max(Math.abs(f.params.x ?? 0), Math.abs(f.params.y ?? 0)))
  }
  if (f.op === 'gaussian-blur') return Math.ceil(3 * (f.params.stdDev ?? 0))
  if (f.op === 'stroke') {
    const size = f.params.size ?? 4
    const position = Math.round(f.params.position ?? 0)
    return Math.ceil(position === 1 ? 0 : position === 2 ? size / 2 : size) + 1
  }
  if (f.op === 'outer-glow') return Math.ceil(f.params.size ?? 12) + 1
  return 0
}
