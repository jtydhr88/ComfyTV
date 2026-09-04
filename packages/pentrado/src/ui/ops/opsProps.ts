import type { RasterData, Transform } from '../../engine/node'
import { ARRANGE_OPS, BLEND_MODES, bool, FIT_MODES, naturalSize, num, oneOf, type OpHandler } from './opsShared'

export const propOps: Record<string, OpHandler> = {
  set_visible({ ctrl, find }, op, res) {
    const n = find(op.id)
    if (n.visible !== bool(op.visible, 'visible')) ctrl.toggleVisible(n.id)
    res.id = n.id
  },
  set_opacity({ ctrl, find }, op, res) {
    const n = find(op.id)
    ctrl.setOpacity(n.id, Math.max(0, Math.min(1, num(op.opacity, 'opacity'))))
    res.id = n.id
  },
  set_blend({ ctrl, find }, op, res) {
    const n = find(op.id)
    ctrl.setBlendMode(n.id, oneOf(op.blend, BLEND_MODES, 'blend'))
    res.id = n.id
  },
  set_lock({ ctrl, find }, op, res) {
    const n = find(op.id)
    if (op.content != null && n.locks.content !== bool(op.content, 'content')) ctrl.toggleLock(n.id)
    if (op.position != null && n.locks.position !== bool(op.position, 'position')) ctrl.toggleLockPosition(n.id)
    if (op.alpha != null && n.kind === 'raster' && (n as RasterData).lockAlpha !== bool(op.alpha, 'alpha')) ctrl.toggleLockAlpha(n.id)
    res.id = n.id
  },
  set_clip({ ctrl, find }, op, res) {
    const n = find(op.id)
    if (!!n.clip !== bool(op.clip, 'clip')) {
      if (!ctrl.canClipMask(n.id)) throw new Error(`layer '${n.id}' has nothing below it to clip to`)
      ctrl.toggleClipMask(n.id)
    }
    res.id = n.id
  },
  set_transform({ ctrl, find }, op, res) {
    const n = find(op.id)
    const patch: Partial<Transform> = {}
    for (const k of ['x', 'y', 'w', 'h', 'rotation'] as const) if (op[k] != null) patch[k] = num(op[k], k)
    if (!ctrl.setLayerTransform(n.id, patch)) throw new Error(`layer '${n.id}' is position-locked or a vector layer`)
    res.id = n.id
    res.transform = { ...find(n.id).transform }
  },
  place({ ctrl, find }, op, res) {
    const n = find(op.id)
    const box = { x: num(op.x, 'x'), y: num(op.y, 'y'), w: num(op.w, 'w'), h: num(op.h, 'h') }
    if (box.w <= 0 || box.h <= 0) throw new Error('w and h must be positive')
    const fit = op.fit == null ? 'contain' : oneOf(op.fit, FIT_MODES, 'fit')
    const ax = Math.max(0, Math.min(1, num(op.align_x, 'align_x', 0.5)))
    const ay = Math.max(0, Math.min(1, num(op.align_y, 'align_y', 0.5)))
    const natural = naturalSize(n)
    let tw = box.w
    let th = box.h
    if (fit !== 'stretch') {
      const s = fit === 'cover' ? Math.max(box.w / natural.w, box.h / natural.h) : Math.min(box.w / natural.w, box.h / natural.h)
      tw = Math.round(natural.w * s)
      th = Math.round(natural.h * s)
    }
    const tx = Math.round(box.x + (box.w - tw) * ax)
    const ty = Math.round(box.y + (box.h - th) * ay)
    if (!ctrl.setLayerTransform(n.id, { x: tx, y: ty, w: tw, h: th, rotation: 0 })) {
      throw new Error(`layer '${n.id}' is position-locked or a vector layer`)
    }
    const crop = op.crop == null ? fit === 'cover' : bool(op.crop, 'crop')
    if (crop && (tw > box.w || th > box.h)) {
      if (!ctrl.selectRect(box)) throw new Error('crop box is outside the canvas')
      ctrl.addMask(n.id, 'selection')
      ctrl.selectNone()
      res.cropped = true
    }
    res.id = n.id
    res.transform = { ...find(n.id).transform }
  },
  nudge({ ctrl, find }, op) {
    if (op.id != null) ctrl.setActiveLayer(find(op.id).id)
    ctrl.nudgeActive(num(op.dx, 'dx', 0), num(op.dy, 'dy', 0))
  },
  arrange({ ctrl, find }, op) {
    if (Array.isArray(op.ids) && op.ids.length) {
      const ids = op.ids.map((id) => find(id).id)
      ctrl.setActiveLayer(ids[0])
      ctrl.setSelectedLayers(ids)
    }
    ctrl.arrangeSelected(oneOf(op.arrange, ARRANGE_OPS, 'arrange'))
  },
}
