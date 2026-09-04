import { FILTER_PARAM_DEFS } from '../../filters'
import { ARTBOARD_MAX, ARTBOARD_MIN } from '../useLayerListPanel'
import { FILTER_OPS, num, oneOf, params, str, type OpHandler } from './opsShared'

export const canvasOps: Record<string, OpHandler> = {
  set_canvas_size({ ctrl }, op) {
    const w = num(op.width, 'width'), h = num(op.height, 'height')
    if (w < ARTBOARD_MIN || h < ARTBOARD_MIN || w > ARTBOARD_MAX || h > ARTBOARD_MAX) {
      throw new Error(`canvas size must be within ${ARTBOARD_MIN}..${ARTBOARD_MAX}`)
    }
    ctrl.setArtboardSize(Math.round(w), Math.round(h))
  },
  async flip({ ctrl }, op) {
    await ctrl.flipImage(oneOf(op.axis, ['h', 'v'] as const, 'axis'))
  },
  async crop_to_content({ ctrl, find }, op) {
    await ctrl.cropToContent(find(op.id).id)
  },
  async merge_down({ ctrl, find }, op) {
    await ctrl.mergeDown(find(op.id).id)
  },
  async flatten({ ctrl }) {
    await ctrl.flattenImage()
  },
  async layer_to_canvas({ ctrl, find }, op) {
    await ctrl.layerToCanvasSize(find(op.id).id)
  },
  async rasterize({ ctrl, find }, op, res) {
    const n = find(op.id)
    if (!ctrl.canRasterize(n.id)) throw new Error(`layer '${n.id}' cannot be rasterized`)
    await ctrl.rasterizeLayer(n.id)
    res.id = n.id
  },
  filter({ ctrl, find }, op, res) {
    const fop = oneOf(op.filter, FILTER_OPS, 'filter')
    if (op.id != null) ctrl.setActiveLayer(find(op.id).id)
    const target = ctrl.activeId.value
    if (!target) throw new Error('filter needs an active raster layer (pass id)')
    ctrl.startFilter(fop)
    if (!ctrl.filterSession.value) throw new Error(`layer '${target}' is not an unlocked raster layer`)
    for (const [k, v] of Object.entries(params(op.params, 'params', FILTER_PARAM_DEFS[fop]))) ctrl.updateFilterParam(k, v)
    ctrl.applyFilter()
    res.id = target
  },
  select_all({ ctrl }) {
    ctrl.selectAll()
  },
  select_none({ ctrl }) {
    ctrl.selectNone()
  },
  invert_selection({ ctrl }) {
    ctrl.invertSelection()
  },
  fill_selection({ ctrl }, op) {
    if (op.color != null) ctrl.brushColor.value = str(op.color, 'color')
    ctrl.fillSelection()
  },
  clear_selection({ ctrl }) {
    ctrl.clearSelectionPixels()
  },
  undo({ ctrl }) {
    ctrl.undo()
  },
  redo({ ctrl }) {
    ctrl.redo()
  },
}
