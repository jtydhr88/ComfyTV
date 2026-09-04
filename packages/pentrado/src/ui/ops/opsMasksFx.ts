import { ADJUST_PARAM_DEFS, type AdjustmentOp } from '../../engine/adjust'
import type { FillSpec } from '../../engine/fill'
import { generateId } from '../../engine/id'
import type { AdjustmentData } from '../../engine/node'
import { LAYER_FX_DEFS, type LayerFxData } from '../../engine/render/layerFx'
import { ADJUSTMENT_OPS, bool, FX_OPS, MASK_INITS, num, oneOf, params, textPatch, type OpHandler } from './opsShared'

export const maskFxOps: Record<string, OpHandler> = {
  add_mask({ ctrl, find }, op, res) {
    const n = find(op.id)
    ctrl.addMask(n.id, op.init == null ? 'white' : oneOf(op.init, MASK_INITS, 'init'))
    res.id = n.id
  },
  remove_mask({ ctrl, find }, op) {
    ctrl.removeMask(find(op.id).id)
  },
  set_mask_enabled({ ctrl, find }, op) {
    const n = find(op.id)
    if (!n.mask) throw new Error(`layer '${n.id}' has no mask`)
    if ((n.mask.enabled !== false) !== bool(op.enabled, 'enabled')) ctrl.toggleMaskEnabled(n.id)
  },
  invert_mask({ ctrl, find }, op) {
    ctrl.invertMask(find(op.id).id)
  },
  async apply_mask({ ctrl, find }, op) {
    await ctrl.applyMask(find(op.id).id)
  },
  set_fx({ ctrl, find }, op, res) {
    const n = find(op.id)
    if (!Array.isArray(op.fx)) throw new Error('fx must be an array of {op, params?, enabled?, opacity?}')
    const fx: LayerFxData[] = op.fx.map((raw, i) => {
      const f = (raw ?? {}) as Record<string, unknown>
      const fop = oneOf(f.op, FX_OPS, `fx[${i}].op`)
      const defaults = Object.fromEntries(LAYER_FX_DEFS[fop].map((p) => [p.key, p.default]))
      return {
        id: typeof f.id === 'string' && f.id ? f.id : generateId('fx'),
        op: fop,
        params: { ...defaults, ...params(f.params, `fx[${i}].params`, LAYER_FX_DEFS[fop]) },
        enabled: f.enabled == null ? true : bool(f.enabled, `fx[${i}].enabled`),
        opacity: f.opacity == null ? 1 : num(f.opacity, `fx[${i}].opacity`),
      }
    })
    ctrl.setLayerFx(n.id, fx)
    res.id = n.id
  },
  set_adjustment({ ctrl, find }, op, res) {
    const n = find(op.id)
    if (n.kind !== 'adjustment') throw new Error(`layer '${n.id}' is not an adjustment layer`)
    const patch: { op?: string; params?: Record<string, number> } = {}
    if (op.kind != null) patch.op = oneOf(op.kind, ADJUSTMENT_OPS, 'kind')
    const kind = patch.op ?? (n as AdjustmentData).op
    if (op.params != null) patch.params = { ...(n as AdjustmentData).params, ...params(op.params, 'params', ADJUST_PARAM_DEFS[kind as AdjustmentOp]) }
    ctrl.updateAdjustment(n.id, patch)
    res.id = n.id
  },
  update_text({ ctrl, find }, op, res) {
    const n = find(op.id)
    if (n.kind !== 'text') throw new Error(`layer '${n.id}' is not a text layer`)
    ctrl.updateTextLayer(n.id, textPatch(op))
    res.id = n.id
  },
  set_fill({ ctrl, find }, op, res) {
    const n = find(op.id)
    if (n.kind !== 'fill') throw new Error(`layer '${n.id}' is not a fill layer`)
    if (!op.fill || typeof op.fill !== 'object') throw new Error('fill must be a fill spec object')
    ctrl.updateFillLayer(n.id, op.fill as FillSpec)
    res.id = n.id
  },
}
