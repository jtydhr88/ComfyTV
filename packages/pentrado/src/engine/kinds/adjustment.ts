import { ADJUST_CODE, ADJUST_PARAM_DEFS, defaultParams, type AdjustmentOp } from '../adjust'
import { generateId } from '../id'
import { defaultMode } from '../mode'
import type { NodeKind } from '../nodeKind'
import type { AdjustmentData, Rect } from '../node'

const num = (v: unknown, d: number): number => (typeof v === 'number' && isFinite(v) ? v : d)
const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d)
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d)

function normalizeOp(v: unknown): AdjustmentOp {
  return typeof v === 'string' && v in ADJUST_CODE ? (v as AdjustmentOp) : 'brightness-contrast'
}

function normalizeCurves(raw: unknown): AdjustmentData['curves'] {
  if (!raw || typeof raw !== 'object') return undefined
  const src = raw as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const ch of ['master', 'red', 'green', 'blue']) {
    if (typeof src[ch] === 'string' && src[ch]) out[ch] = src[ch] as string
  }
  return Object.keys(out).length ? out : undefined
}

function normalizeParams(op: AdjustmentOp, raw: unknown): Record<string, number> {
  const src = (raw ?? {}) as Record<string, unknown>
  const out: Record<string, number> = {}
  for (const def of ADJUST_PARAM_DEFS[op]) {
    out[def.key] = Math.max(def.min, Math.min(def.max, num(src[def.key], def.default)))
  }
  return out
}

export const adjustmentKind: NodeKind<AdjustmentData> = {
  kind: 'adjustment',

  create(init: Partial<AdjustmentData> = {}): AdjustmentData {
    const op = normalizeOp(init.op)
    return {
      kind: 'adjustment',
      id: init.id ?? generateId('adjust'),
      name: init.name ?? 'Adjustment',
      visible: init.visible ?? true,
      opacity: init.opacity ?? 1,
      mode: init.mode ?? defaultMode('normal'),
      transform: init.transform ?? { x: 0, y: 0, w: 0, h: 0, rotation: 0 },
      locks: init.locks ?? { content: false, position: false, visibility: false },
      op,
      params: init.params ? normalizeParams(op, init.params) : defaultParams(op),
      curves: normalizeCurves(init.curves),
      mask: init.mask,
      clip: init.clip,
    }
  },

  normalize(raw: unknown): AdjustmentData {
    const r = (raw ?? {}) as Record<string, unknown>
    const locks = (r.locks ?? {}) as Record<string, unknown>
    const op = normalizeOp(r.op)
    return {
      kind: 'adjustment',
      id: str(r.id, generateId('adjust')),
      name: str(r.name, 'Adjustment'),
      visible: bool(r.visible, true),
      opacity: Math.max(0, Math.min(1, num(r.opacity, 1))),
      mode: (r.mode as AdjustmentData['mode']) ?? defaultMode('normal'),
      transform: { x: 0, y: 0, w: 0, h: 0, rotation: 0 },
      locks: {
        content: bool(locks.content, false),
        position: bool(locks.position, false),
        visibility: bool(locks.visibility, false),
      },
      op,
      params: normalizeParams(op, r.params),
      curves: normalizeCurves(r.curves),
      mask: r.mask as AdjustmentData['mask'],
      clip: r.clip === true ? true : undefined,
    }
  },

  serialize(node: AdjustmentData): unknown {
    return {
      kind: 'adjustment',
      id: node.id,
      name: node.name,
      visible: node.visible,
      opacity: node.opacity,
      mode: node.mode,
      transform: node.transform,
      locks: node.locks,
      op: node.op,
      params: node.params,
      curves: node.curves,
      mask: node.mask,
      clip: node.clip,
    }
  },

  contentIds(node: AdjustmentData): string[] {
    return node.mask ? [node.mask.contentId].filter(Boolean) : []
  },

  async hydrate(node: AdjustmentData, deps): Promise<void> {
    if (node.mask && !deps.content.has(node.mask.contentId) && node.mask.url) {
      const canvas = await deps.loadUrl(node.mask.url)
      deps.content.register(canvas, { id: node.mask.contentId, uploadedUrl: node.mask.url })
    }
  },

  renderNode(): null {
    return null
  },

  bbox(): Rect {
    return { x: 0, y: 0, w: 0, h: 0 }
  },

  thumbnail(): HTMLCanvasElement | null {
    return null
  },

  hitTest(): boolean {
    return false
  },
}
