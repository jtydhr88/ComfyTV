import { oneOf, str, type OpHandler } from './opsShared'

export const structureOps: Record<string, OpHandler> = {
  remove({ ctrl, find }, op, res) {
    ctrl.removeLayer(find(op.id).id)
    res.id = String(op.id)
  },
  duplicate({ ctrl, find, allIds, newIdSince }, op, res) {
    const before = allIds()
    ctrl.duplicateLayer(find(op.id).id)
    res.id = newIdSince(before)
  },
  move({ ctrl, find }, op, res) {
    const dir = oneOf(op.dir, ['up', 'down'] as const, 'dir')
    ctrl.moveLayer(find(op.id).id, dir === 'up' ? 1 : -1)
    res.id = String(op.id)
  },
  move_to({ ctrl, find }, op, res) {
    const pos = oneOf(op.pos, ['above', 'below', 'into'] as const, 'pos')
    ctrl.moveLayerRelative(find(op.id).id, op.target == null ? null : find(op.target).id, pos)
    res.id = String(op.id)
  },
  group({ ctrl, find, allIds, newIdSince }, op, res) {
    const before = allIds()
    if (Array.isArray(op.ids) && op.ids.length) {
      const ids = op.ids.map((id) => find(id).id)
      ctrl.setActiveLayer(ids[0])
      ctrl.setSelectedLayers(ids)
    } else if (op.id != null) {
      ctrl.setActiveLayer(find(op.id).id)
    }
    ctrl.groupActiveLayer()
    res.id = newIdSince(before)
  },
  ungroup({ ctrl, find }, op) {
    if (op.id != null) ctrl.setActiveLayer(find(op.id).id)
    ctrl.ungroupActiveLayer()
  },
  rename({ ctrl, find }, op, res) {
    ctrl.renameLayer(find(op.id).id, str(op.name, 'name'))
    res.id = String(op.id)
  },
  set_active({ ctrl, find }, op) {
    ctrl.setActiveLayer(op.id == null ? null : find(op.id).id)
  },
  select({ ctrl, find }, op) {
    if (!Array.isArray(op.ids)) throw new Error('ids must be an array of layer ids')
    const ids = op.ids.map((id) => find(id).id)
    if (ids.length) ctrl.setActiveLayer(ids[0])
    ctrl.setSelectedLayers(ids)
  },
}
