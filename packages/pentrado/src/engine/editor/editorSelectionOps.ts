import { AddNodeCommand, RemoveNodeCommand } from '../commands/structure'
import { findNode } from '../document'
import { CommandGroup } from '../history'
import type { RasterData, Rect, SceneNode, VectorData } from '../node'
import { getNodeKind } from '../nodeKind'
import { getPaintCore } from '../paint'
import { flattenStrokeAdaptive, resamplePolyline } from '../pathEdit'
import { drawPlacedInto } from '../render/bake'
import { resolvePaintTarget } from '../tools/paintTarget'
import type { EditorCore } from './editorCore'
import type { Editor, EditorEnv } from './editorTypes'
import { clearSelectedPixels, extractSelectedPixels, fillSelectedPixels, strokeSelectedPixels } from './selectionEdit'
import {
  borderMask, emptyMask, featherMask, growMask, maskBounds, maskToCanvas, polygonMask, shrinkMask,
} from './selectionMath'
import { clampRectToDoc, fullSelectionCanvas, invertSelectionCanvas, lumaBBox, rectSelectionCanvas } from './selectionOps'

type SelectionOpsApi = Pick<Editor,
  | 'clearSelectionPixels' | 'fillSelectionPixels' | 'strokeSelectionPixels' | 'copySelection' | 'cutSelection'
  | 'pasteClipboard' | 'hasClipboard' | 'copyVisible' | 'newFromVisible' | 'mergeVisible' | 'modifySelection'
  | 'pathToSelection' | 'strokePathWithBrush' | 'selectionBounds' | 'setRectSelection' | 'selectAll' | 'selectNone'
  | 'maskToSelection' | 'invertSelection'>

export function createEditorSelectionOps(env: EditorEnv, core: EditorCore, anchorFloatingImpl: () => void): SelectionOpsApi {
  const { st, content, history } = env
  const {
    refresh, selectionChannel, activeRaster, selectionOutlines, visibleComposite, currentSelectionMask,
    commitSelection, combineSelectionMask, activeNodeIdOf, hexRgb,
  } = core
  return {
    clearSelectionPixels() {
      const sel = selectionChannel()
      const node = activeRaster()
      const selCanvas = sel ? content.get(sel.contentId)?.canvas : null
      if (!sel || !node || !selCanvas) return false
      const ok = clearSelectedPixels({ content, push: (c) => history.push(c) }, node, selCanvas)
      if (ok) refresh()
      return ok
    },
    fillSelectionPixels(colorHex) {
      const sel = selectionChannel()
      const node = activeRaster()
      const selCanvas = sel ? content.get(sel.contentId)?.canvas : null
      if (!sel || !node || !selCanvas) return false
      const ok = fillSelectedPixels({ content, push: (c) => history.push(c) }, node, selCanvas, hexRgb(colorHex))
      if (ok) refresh()
      return ok
    },
    strokeSelectionPixels(colorHex, width) {
      const sel = selectionChannel()
      const node = activeRaster()
      if (!sel || !node) return false
      const outlines = selectionOutlines(sel)
      const ok = strokeSelectedPixels(
        { content, push: (c) => history.push(c) }, node, content.get(sel.contentId)?.canvas ?? document.createElement('canvas'),
        hexRgb(colorHex), Math.max(1, width), outlines
      )
      if (ok) refresh()
      return ok
    },
    copySelection() {
      const sel = selectionChannel()
      const node = activeRaster()
      const selCanvas = sel ? content.get(sel.contentId)?.canvas : null
      if (!sel?.bounds || !node || !selCanvas) return false
      const clip = extractSelectedPixels(node, content, selCanvas, sel.bounds)
      if (!clip) return false
      st.clipboard = clip
      return true
    },
    cutSelection() {
      const sel = selectionChannel()
      const node = activeRaster()
      const selCanvas = sel ? content.get(sel.contentId)?.canvas : null
      if (!sel?.bounds || !node || !selCanvas) return false
      const clip = extractSelectedPixels(node, content, selCanvas, sel.bounds)
      if (!clip) return false
      st.clipboard = clip
      history.beginGroup('Cut Selection')
      const ok = clearSelectedPixels({ content, push: (c) => history.push(c) }, node, selCanvas)
      history.endGroup()
      if (ok) refresh()
      return ok
    },
    pasteClipboard() {
      if (!st.clipboard) return false
      if (st.floating) anchorFloatingImpl()
      const cid = content.register(st.clipboard.canvas)
      st.floating = {
        contentId: cid,
        name: 'Pasted',
        transform: { x: st.clipboard.bounds.x, y: st.clipboard.bounds.y, w: st.clipboard.bounds.w, h: st.clipboard.bounds.h, rotation: 0 },
      }
      st.floatSession = { mode: 'idle' }
      refresh()
      return true
    },
    hasClipboard: () => st.clipboard !== null,
    copyVisible() {
      const canvas = visibleComposite()
      if (!canvas) return false
      const sel = selectionChannel()
      const selCanvas = sel?.bounds ? content.get(sel.contentId)?.canvas : null
      if (!sel?.bounds || !selCanvas) {
        st.clipboard = { canvas, bounds: { x: 0, y: 0, w: st.doc.width, h: st.doc.height } }
        return true
      }
      const b = sel.bounds
      const clip = document.createElement('canvas')
      clip.width = Math.max(1, Math.round(b.w))
      clip.height = Math.max(1, Math.round(b.h))
      const g = clip.getContext('2d')
      const sg = selCanvas.getContext('2d')
      if (!g || !sg) return false
      g.drawImage(canvas, -Math.round(b.x), -Math.round(b.y))
      const img = g.getImageData(0, 0, clip.width, clip.height)
      const selImg = sg.getImageData(Math.round(b.x), Math.round(b.y), clip.width, clip.height)
      for (let p = 0; p < img.data.length / 4; p++) {
        img.data[p * 4 + 3] = Math.round((img.data[p * 4 + 3] * selImg.data[p * 4]) / 255)
      }
      g.putImageData(img, 0, 0)
      st.clipboard = { canvas: clip, bounds: { x: Math.round(b.x), y: Math.round(b.y), w: clip.width, h: clip.height } }
      return true
    },
    newFromVisible() {
      const canvas = visibleComposite()
      if (!canvas) return false
      const node = getNodeKind('raster').create({
        name: 'Visible',
        contentId: content.register(canvas),
        naturalWidth: st.doc.width,
        naturalHeight: st.doc.height,
        transform: { x: 0, y: 0, w: st.doc.width, h: st.doc.height, rotation: 0 },
      } as Partial<RasterData>) as SceneNode
      st.doc.root.children.push(node)
      history.push(new AddNodeCommand('New From Visible', st.doc.root, node, st.doc.root.children.length - 1))
      st.selectedIds = [node.id]
      refresh()
      return true
    },
    mergeVisible() {
      const children = st.doc.root.children
      const visible = children.filter((n) => n.visible)
      if (visible.length < 2) return false
      const canvas = visibleComposite()
      if (!canvas) return false
      const group = new CommandGroup('Merge Visible')
      const bottomIndex = children.indexOf(visible[0])
      for (let i = children.length - 1; i >= 0; i--) {
        const node = children[i]
        if (!node.visible) continue
        children.splice(i, 1)
        group.children.push(new RemoveNodeCommand(`Merge ${node.name}`, st.doc.root, node, i))
      }
      const merged = getNodeKind('raster').create({
        name: visible[0].name,
        contentId: content.register(canvas),
        naturalWidth: st.doc.width,
        naturalHeight: st.doc.height,
        transform: { x: 0, y: 0, w: st.doc.width, h: st.doc.height, rotation: 0 },
      } as Partial<RasterData>) as SceneNode
      const at = Math.min(bottomIndex, children.length)
      children.splice(at, 0, merged)
      group.children.push(new AddNodeCommand('Merged Result', st.doc.root, merged, at))
      st.selectedIds = [merged.id]
      history.push(group)
      refresh()
      return true
    },
    modifySelection(kind, radius) {
      const mask = currentSelectionMask()
      if (!mask) return false
      const r = Math.max(1, Math.round(radius))
      const selBounds = selectionChannel()?.bounds ?? null
      const next =
        kind === 'feather' ? featherMask(mask, r, selBounds)
        : kind === 'grow' ? growMask(mask, r, selBounds)
        : kind === 'shrink' ? shrinkMask(mask, r, selBounds)
        : borderMask(mask, r, selBounds)
      const bounds = maskBounds(next)
      if (!bounds) return commitSelection('Select None', null, null)
      const canvas = maskToCanvas(next)
      if (!canvas) return false
      const labels = { feather: 'Feather Selection', grow: 'Grow Selection', shrink: 'Shrink Selection', border: 'Border Selection' }
      return commitSelection(labels[kind], canvas, bounds)
    },
    pathToSelection(id, op) {
      const node = findNode(st.doc.root, id)?.node
      if (!node || node.kind !== 'vector') return false
      const v = node as VectorData
      const mask = emptyMask(st.doc.width, st.doc.height)
      let any = false
      for (const stroke of v.path.strokes) {
        if (!stroke.closed) continue
        const pts = flattenStrokeAdaptive(stroke, 0.25)
        if (pts.length < 3) continue
        const m = polygonMask(st.doc.width, st.doc.height, pts)
        for (let p = 0; p < mask.data.length; p++) mask.data[p] = Math.max(mask.data[p], m.data[p])
        any = true
      }
      if (!any) return false
      return combineSelectionMask('Path to Selection', mask, op)
    },
    strokePathWithBrush(id) {
      const node = findNode(st.doc.root, id)?.node
      if (!node || node.kind !== 'vector') return false
      const v = node as VectorData
      const strokes = v.path.strokes.filter((s) => s.anchors.length >= 3)
      if (!strokes.length) return false
      const probe = resolvePaintTarget(st.doc, content, activeNodeIdOf(), 'content')
      if (!probe) return false
      history.beginGroup('Stroke Path')
      let painted = false
      for (const stroke of strokes) {
        const flat = flattenStrokeAdaptive(stroke, 0.4)
        if (stroke.closed && flat.length) flat.push({ ...flat[0] })
        const pts = resamplePolyline(flat, 3)
        if (pts.length < 2) continue
        const target = resolvePaintTarget(st.doc, content, activeNodeIdOf(), 'content')
        if (!target) break
        const core = getPaintCore('brush').create()
        core.start(target, { ...st.brush }, { x: pts[0].x, y: pts[0].y, pressure: 1, time: 0 })
        for (let i = 1; i < pts.length; i++) {
          core.motion({ x: pts[i].x, y: pts[i].y, pressure: 1, time: 0 })
        }
        const cmd = core.finish()
        if (cmd) {
          history.push(cmd)
          painted = true
        }
      }
      history.endGroup()
      if (painted) refresh()
      return painted
    },
    selectionBounds() {
      return selectionChannel()?.bounds ?? null
    },
    setRectSelection(rect) {
      const clamped = clampRectToDoc(rect, st.doc.width, st.doc.height)
      if (!clamped) return false
      return commitSelection('Select Rectangle', rectSelectionCanvas(st.doc.width, st.doc.height, clamped), clamped)
    },
    selectAll() {
      const rect: Rect = { x: 0, y: 0, w: st.doc.width, h: st.doc.height }
      return commitSelection('Select All', fullSelectionCanvas(st.doc.width, st.doc.height), rect)
    },
    selectNone() {
      return commitSelection('Select None', null, null)
    },
    maskToSelection(id) {
      const node = findNode(st.doc.root, id)?.node
      const m = node?.mask
      if (!node || !m) return false
      const entry = content.get(m.contentId)
      if (!entry) return false
      const canvas = document.createElement('canvas')
      canvas.width = st.doc.width
      canvas.height = st.doc.height
      const g = canvas.getContext('2d')
      if (!g) return false
      g.fillStyle = '#000000'
      g.fillRect(0, 0, st.doc.width, st.doc.height)
      const tf =
        node.transform.w > 0 && node.transform.h > 0
          ? node.transform
          : { x: 0, y: 0, w: entry.width, h: entry.height, rotation: 0 }
      drawPlacedInto(g, entry.canvas, tf, 0, 0)
      const bounds = lumaBBox(canvas)
      if (!bounds) return commitSelection('Select None', null, null)
      return commitSelection('Mask to Selection', canvas, bounds)
    },
    invertSelection() {
      const sel = selectionChannel()
      if (!sel) return false
      const entry = content.get(sel.contentId)
      if (!entry) return false
      const inverted = invertSelectionCanvas(entry.canvas)
      if (!inverted) return false
      const bounds = lumaBBox(inverted)
      if (!bounds) return commitSelection('Select None', null, null)
      return commitSelection('Invert Selection', inverted, bounds)
    },
  }
}
