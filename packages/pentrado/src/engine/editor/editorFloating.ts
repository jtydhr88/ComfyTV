import { BakeRasterCommand, snapshotRaster } from '../commands/bakeContent'
import type { RasterData, SceneNode, Vec2 } from '../node'
import { getNodeKind } from '../nodeKind'
import { bakeMaskInto, bakePlaced, drawPlacedInto, isIdentityPlacement, placedBounds } from '../render/bake'
import { angleTo, applyMove, applyResize, applyRotate, hitHandle, insideBox } from '../tools/transformMath'
import type { EditorCore } from './editorCore'
import type { Editor, EditorEnv, FloatingItem } from './editorTypes'

export function createEditorFloating(env: EditorEnv, core: EditorCore) {
  const { st, content, history } = env
  const { refresh, activeRaster, addNodeInternal, selectionChannel, commitSelection, collectGarbage } = core
  function anchorInto(node: RasterData, item: FloatingItem, floatCanvas: HTMLCanvasElement): boolean {
    const targetEntry = content.get(node.contentId)
    if (!targetEntry) return false
    const fb = placedBounds(item.transform)
    const tb = placedBounds(node.transform)
    const ux = Math.min(tb.x, fb.x)
    const uy = Math.min(tb.y, fb.y)
    const uw = Math.max(tb.x + tb.w, fb.x + fb.w) - ux
    const uh = Math.max(tb.y + tb.h, fb.y + fb.h) - uy
    if (uw > 16384 || uh > 16384) return false
    const oldTransform = { ...node.transform }
    const canvas = document.createElement('canvas')
    canvas.width = uw
    canvas.height = uh
    const ctx = canvas.getContext('2d')
    if (!ctx) return false
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    drawPlacedInto(ctx, targetEntry.canvas, node.transform, ux, uy)
    drawPlacedInto(ctx, floatCanvas, item.transform, ux, uy)
    const before = snapshotRaster(node)
    node.contentId = content.register(canvas)
    node.url = undefined
    node.naturalWidth = uw
    node.naturalHeight = uh
    node.transform = { x: ux, y: uy, w: uw, h: uh, rotation: 0 }
    if (node.mask) {
      const maskEntry = content.get(node.mask.contentId)
      const bakedMask = maskEntry
        ? bakeMaskInto(maskEntry.canvas, oldTransform, { x: ux, y: uy, w: uw, h: uh }, 'white')
        : null
      if (bakedMask) {
        node.mask = { ...node.mask, contentId: content.register(bakedMask), url: undefined }
      }
    }
    history.push(new BakeRasterCommand('Anchor', node, before, snapshotRaster(node), content))
    return true
  }

  function anchorAsNewLayer(item: FloatingItem, entry: { canvas: HTMLCanvasElement; width: number; height: number; uploadedUrl: string | null }): void {
    const kind = getNodeKind('raster')
    if (isIdentityPlacement(item.transform, entry.width, entry.height)) {
      addNodeInternal(
        kind.create({
          name: item.name ?? 'Layer',
          contentId: item.contentId,
          url: entry.uploadedUrl ?? undefined,
          naturalWidth: entry.width,
          naturalHeight: entry.height,
          transform: { ...item.transform },
        } as Partial<RasterData>) as SceneNode
      )
      return
    }
    const baked = bakePlaced(entry.canvas, item.transform)
    if (!baked) {
      addNodeInternal(
        kind.create({
          name: item.name ?? 'Layer',
          contentId: item.contentId,
          url: entry.uploadedUrl ?? undefined,
          naturalWidth: entry.width,
          naturalHeight: entry.height,
          transform: { ...item.transform },
        } as Partial<RasterData>) as SceneNode
      )
      return
    }
    const cid = content.register(baked.canvas)
    addNodeInternal(
      kind.create({
        name: item.name ?? 'Layer',
        contentId: cid,
        naturalWidth: baked.bounds.w,
        naturalHeight: baked.bounds.h,
        transform: { x: baked.bounds.x, y: baked.bounds.y, w: baked.bounds.w, h: baked.bounds.h, rotation: 0 },
      } as Partial<RasterData>) as SceneNode
    )
  }

  function anchorFloatingImpl(target?: 'active' | 'new'): void {
    if (!st.floating) return
    const item = st.floating
    const entry = content.get(item.contentId)
    if (!entry) {
      st.floating = null
      st.floatSession = { mode: 'idle' }
      refresh()
      return
    }
    let mode: 'active' | 'new' = target ?? (activeRaster() ? 'active' : 'new')
    if (mode === 'active') {
      const node = activeRaster()
      if (!node || node.locks.content) mode = 'new'
      else if (anchorInto(node, item, entry.canvas)) {
        st.floating = null
        st.floatSession = { mode: 'idle' }
        refresh()
        return
      }
    }
    st.floating = null
    st.floatSession = { mode: 'idle' }
    anchorAsNewLayer(item, entry)
  }

  function floatingPress(pt: Vec2): void {
    if (!st.floating) return
    const t = st.floating.transform
    const tol = 8 / Math.max(1e-3, st.zoomLevel)
    const h = hitHandle(t, pt, tol)
    if (h === 'rotate') {
      st.floatSession = { mode: 'rotate', before: { ...t }, grab: angleTo(t, pt) }
      return
    }
    if (h) {
      st.floatSession = { mode: 'resize', handle: h, before: { ...t } }
      return
    }
    if (insideBox(t, pt)) {
      st.floatSession = { mode: 'move', start: pt, before: { ...t } }
      return
    }
    anchorFloatingImpl()
  }

  function floatingMotion(e: PointerEvent, pt: Vec2): void {
    if (!st.floating || st.floatSession.mode === 'idle') return
    const s = st.floatSession
    if (s.mode === 'move') {
      st.floating.transform = applyMove(s.before, pt.x - s.start.x, pt.y - s.start.y)
    } else if (s.mode === 'resize') {
      st.floating.transform = applyResize(s.before, s.handle, pt, 1, e.shiftKey)
    } else {
      st.floating.transform = applyRotate(s.before, s.before.rotation, s.grab, pt, e.shiftKey ? Math.PI / 12 : 0)
    }
    refresh()
  }
  const api: Pick<Editor, 'floating' | 'startFloating' | 'anchorFloating' | 'cancelFloating'> = {
    floating: () => st.floating,
    startFloating(contentId, width, height, name) {
      if (st.floating) anchorFloatingImpl()
      const sel = selectionChannel()
      const target = sel?.bounds ?? { x: 0, y: 0, w: st.doc.width, h: st.doc.height }
      if (sel) commitSelection('Select None', null, null)
      const x = Math.round(target.x + (target.w - width) / 2)
      const y = Math.round(target.y + (target.h - height) / 2)
      st.floating = {
        contentId,
        name,
        transform: {
          x: width <= st.doc.width ? Math.max(0, Math.min(x, st.doc.width - width)) : x,
          y: height <= st.doc.height ? Math.max(0, Math.min(y, st.doc.height - height)) : y,
          w: width,
          h: height,
          rotation: 0,
        },
      }
      st.floatSession = { mode: 'idle' }
      refresh()
    },
    anchorFloating(target) {
      anchorFloatingImpl(target)
    },
    cancelFloating() {
      if (!st.floating) return
      st.floating = null
      st.floatSession = { mode: 'idle' }
      collectGarbage()
      refresh()
    },
  }
  return { anchorFloatingImpl, floatingPress, floatingMotion, api }
}
