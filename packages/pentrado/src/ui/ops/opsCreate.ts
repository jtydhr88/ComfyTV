import { ADJUST_PARAM_DEFS } from '../../engine/adjust'
import type { FillSpec } from '../../engine/fill'
import { ADJUSTMENT_OPS, num, oneOf, params, str, textPatch, type OpHandler } from './opsShared'

export const createOps: Record<string, OpHandler> = {
  async add_image({ ctrl, allIds, newIdSince, settleFloating }, op, res) {
    const before = allIds()
    await ctrl.addImageFromUrl(str(op.url, 'url'), typeof op.name === 'string' ? op.name : 'Image')
    settleFloating()
    const id = newIdSince(before)
    if (!id) throw new Error('image could not be loaded')
    if (typeof op.name === 'string' && op.name) ctrl.renameLayer(id, op.name)
    res.id = id
  },
  async add_asset({ ctrl, allIds, settleFloating }, op, res) {
    if (!ctrl.host?.resolveAsset) throw new Error('this host has no asset library')
    const key = op.asset_id
    if (typeof key !== 'number' && typeof key !== 'string') throw new Error('asset_id must be a number or string')
    const media = await ctrl.host.resolveAsset(key)
    if (!media) throw new Error(`asset '${key}' not found in the library`)
    const before = allIds()
    await ctrl.addMedia({ ...media, name: typeof op.name === 'string' && op.name ? op.name : media.name })
    settleFloating()
    const added = [...allIds()].filter((id) => !before.has(id))
    if (!added.length) throw new Error('asset could not be loaded')
    if (typeof op.name === 'string' && op.name && added.length === 1) ctrl.renameLayer(added[0], op.name)
    res.id = added[0]
    if (added.length > 1) res.added = added
    res.asset = { id: key, url: media.url }
  },
  add_layer({ ctrl, allIds, newIdSince }, op, res) {
    const before = allIds()
    ctrl.addEmptyLayer()
    const id = newIdSince(before)
    if (id && typeof op.name === 'string' && op.name) ctrl.renameLayer(id, op.name)
    res.id = id
  },
  add_text({ ctrl }, op, res) {
    const id = ctrl.addTextLayerAt({ x: num(op.x, 'x', 0), y: num(op.y, 'y', 0) })
    ctrl.updateTextLayer(id, textPatch(op))
    res.id = id
  },
  add_adjustment({ ctrl }, op, res) {
    const kind = oneOf(op.kind, ADJUSTMENT_OPS, 'kind')
    const id = ctrl.addAdjustmentLayer(kind)
    if (op.params != null) ctrl.updateAdjustment(id, { params: params(op.params, 'params', ADJUST_PARAM_DEFS[kind]) })
    res.id = id
  },
  add_fill({ ctrl, allIds, newIdSince }, op, res) {
    const before = allIds()
    ctrl.addFillLayer(op.fill as FillSpec | undefined)
    res.id = newIdSince(before)
  },
  async import_psd({ ctrl, allIds }, op, res) {
    const before = allIds()
    await ctrl.importPsdFromUrl(str(op.url, 'url'), typeof op.name === 'string' ? op.name : 'PSD')
    res.added = [...allIds()].filter((id) => !before.has(id))
  },
}
