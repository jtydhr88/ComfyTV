import { AddNodeCommand } from '../commands/structure'
import { SetSelectionCommand, snapshotSelection } from '../commands/selection'
import type { CompositeInput } from '../compositor'
import { findNode } from '../document'
import { generateId } from '../id'
import { fillBitmap } from '../kinds/fill'
import { textBitmap } from '../kinds/text'
import { vectorBitmap } from '../kinds/vector'
import { defaultMode, resolveMode } from '../mode'
import type { ChannelData, GroupData, RasterData, Rect, SceneNode, Vec2 } from '../node'
import { getNodeKind } from '../nodeKind'
import { renderDocumentCached } from '../render/renderStack'
import { addTransformBox } from '../tools/overlayBox'
import type { EditorEnv } from './editorTypes'
import {
  combineMasks, emptyMask, maskBoundary, maskBounds, maskFromCanvas, maskToCanvas, type GrayMask, type SelectionOp,
} from './selectionMath'

export function createEditorCore(env: EditorEnv) {
  const { st, compositor, content, history, notify, overlay, overrides, mergeCache } = env
  function setPreviewOverride(key: string, canvas: HTMLCanvasElement | null, rects?: Rect[] | Rect | null): void {
    if (!canvas) {
      overrides.delete(key)
      st.pendingDamage = null
      return
    }
    const list = !rects ? null : Array.isArray(rects) ? (rects.length ? rects : null) : [rects]
    overrides.set(key, { canvas, version: ++st.previewVersion, rects: list })
    if (list) {
      let u = st.pendingDamage
      for (const r of list) u = u ? unionRects(u, r) : r
      st.pendingDamage = u
    } else {
      st.pendingDamage = null
    }
  }

  function unionRects(a: Rect, b: Rect): Rect {
    const x = Math.min(a.x, b.x)
    const y = Math.min(a.y, b.y)
    return {
      x,
      y,
      w: Math.max(a.x + a.w, b.x + b.w) - x,
      h: Math.max(a.y + a.h, b.y + b.h) - y,
    }
  }
  function hexRgb(hex: string): [number, number, number] {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex)
    const v = m ? parseInt(m[1], 16) : 0
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
  }

  function floatingInputs(): CompositeInput[] {
    if (!st.floating) return []
    const entry = content.get(st.floating.contentId)
    if (!entry) return []
    return [
      {
        texture: {
          source: entry.canvas,
          rect: { x: 0, y: 0, w: st.doc.width, h: st.doc.height },
          linear: false,
          quad: { ...st.floating.transform },
          key: `tex:${st.floating.contentId}|${entry.canvas.width}x${entry.canvas.height}`,
          stamp: `tex:${st.floating.contentId}|${entry.canvas.width}x${entry.canvas.height}`,
        },
        opacity: 1,
        mode: resolveMode(defaultMode('normal')),
      },
    ]
  }
  function render(region?: Rect | null): void {
    renderDocumentCached(
      st.doc,
      { content, compositor, devicePixelRatio: 1, overrides, viewport: st.viewport },
      activeNodeIdOf(),
      mergeCache,
      floatingInputs(),
      region
    )
  }
  function visibleComposite(): HTMLCanvasElement | null {
    if (!compositor.getCanvas()) return null
    if (st.doc.root.children.length === 0) return null
    render()
    const img = compositor.readback()
    if (img.width !== st.doc.width || img.height !== st.doc.height) return null
    const canvas = document.createElement('canvas')
    canvas.width = st.doc.width
    canvas.height = st.doc.height
    const g = canvas.getContext('2d')
    if (!g) return null
    g.putImageData(img, 0, 0)
    return canvas
  }
  function selectionChannel(): ChannelData | null {
    if (!st.doc.selectionId) return null
    return st.doc.channels.find((ch) => ch.id === st.doc.selectionId && ch.role === 'selection') ?? null
  }

  let selOutlineCache: { key: string; outlines: Vec2[][] } | null = null
  function selectionOutlines(sel: ChannelData): Vec2[][] {
    if (st.selOutlineCache?.key === sel.contentId) return st.selOutlineCache.outlines
    const entry = content.get(sel.contentId)
    const mask = entry ? maskFromCanvas(entry.canvas) : null
    const outlines = mask ? maskBoundary(mask) : []
    st.selOutlineCache = { key: sel.contentId, outlines }
    return outlines
  }

  function buildOverlay(): void {
    overlay.clear()
    for (const g of st.doc.guides ?? []) {
      if (g.axis === 'x') {
        overlay.add({ type: 'line', a: { x: g.pos, y: 0 }, b: { x: g.pos, y: st.doc.height } })
      } else {
        overlay.add({ type: 'line', a: { x: 0, y: g.pos }, b: { x: st.doc.width, y: g.pos } })
      }
    }
    const sel = selectionChannel()
    if (sel?.bounds) {
      const outlines = selectionOutlines(sel)
      if (outlines.length) {
        for (const points of outlines) overlay.add({ type: 'polyline', points, closed: true, ants: true })
      } else {
        overlay.add({ type: 'rect', rect: sel.bounds, ants: true })
      }
    }
    if (st.floating) {
      addTransformBox(overlay, st.floating.transform)
      return
    }
    st.tool?.drawOverlay(overlay)
  }
  function refresh(): void {
    const region = st.pendingDamage
    st.pendingDamage = null
    if (region) {
      if (!st.presentFull) st.presentRect = st.presentRect ? unionRects(st.presentRect, region) : region
    } else {
      st.presentFull = true
      st.presentRect = null
    }
    render(region)
    buildOverlay()
    notify()
  }
  function liveSelectedIds(): string[] {
    return st.selectedIds.filter((id) => findNode(st.doc.root, id))
  }
  function activeNodeIdOf(): string | null {
    for (let i = st.selectedIds.length - 1; i >= 0; i--) {
      if (findNode(st.doc.root, st.selectedIds[i])) return st.selectedIds[i]
    }
    return null
  }
  function setSelected(ids: string[]): void {
    const seen = new Set<string>()
    const next: string[] = []
    for (const id of ids) {
      if (seen.has(id) || !findNode(st.doc.root, id)) continue
      seen.add(id)
      next.push(id)
    }
    if (next.length === st.selectedIds.length && next.every((id, i) => id === st.selectedIds[i])) return
    st.selectedIds = next
    const restoreIds: string[] = []
    for (const id of next.slice(0, 1)) {
      const found = findNode(st.doc.root, id)?.node
      if (found) for (const cid of getNodeKind(found.kind).contentIds(found)) restoreIds.push(cid)
    }
    if (restoreIds.length) void content.restoreAll?.(restoreIds)
    buildOverlay()
    notify()
  }
  function setActive(id: string | null): void {
    setSelected(id ? [id] : [])
  }
  function collectGarbage(): void {
    const pinned = new Set<string>()
    const activeForPin = activeNodeIdOf() ? findNode(st.doc.root, activeNodeIdOf()!)?.node : null
    if (activeForPin) for (const cid of getNodeKind(activeForPin.kind).contentIds(activeForPin)) pinned.add(cid)
    for (const ch of st.doc.channels) pinned.add(ch.contentId)
    if (st.floating) pinned.add(st.floating.contentId)
    const live = new Set<string>(pinned)
    for (const id of getNodeKind(st.doc.root.kind).contentIds(st.doc.root)) live.add(id)
    for (const id of history.contentRefs()) live.add(id)
    content.collectGarbage(live)
    const keepMaterial = new Set<string>()
    const activeNode = activeNodeIdOf() ? findNode(st.doc.root, activeNodeIdOf()!)?.node : null
    if (activeNode) {
      if ('contentId' in activeNode) keepMaterial.add((activeNode as RasterData).contentId)
      if (activeNode.mask) keepMaterial.add(activeNode.mask.contentId)
    }
    content.trim?.(pinned, keepMaterial)
  }
  history.onChange(collectGarbage)
  function activeLocation(): { parent: GroupData; node: SceneNode; index: number } | null {
    const id = activeNodeIdOf()
    if (!id) return null
    return findNode(st.doc.root, id)
  }
  function activeRaster(): RasterData | null {
    const loc = activeLocation()
    return loc && loc.node.kind === 'raster' ? (loc.node as RasterData) : null
  }

  function currentSelectionMask(): GrayMask | null {
    const sel = selectionChannel()
    if (!sel) return null
    const entry = content.get(sel.contentId)
    if (!entry) return null
    return maskFromCanvas(entry.canvas)
  }

  function combineSelectionMask(label: string, shapeMask: GrayMask, op: SelectionOp): boolean {
    let result = shapeMask
    if (op !== 'replace') {
      const base = currentSelectionMask() ?? emptyMask(st.doc.width, st.doc.height)
      result = combineMasks(base, shapeMask, op)
    }
    const bounds = maskBounds(result)
    if (!bounds) return commitSelection(label, null, null)
    const canvas = maskToCanvas(result)
    if (!canvas) return false
    return commitSelection(label, canvas, bounds)
  }

  function commitSelection(label: string, canvas: HTMLCanvasElement | null, bounds: Rect | null): boolean {
    const before = snapshotSelection(st.doc)
    st.doc.channels = st.doc.channels.filter((ch) => ch.role !== 'selection')
    if (canvas && bounds) {
      const channel: ChannelData = {
        id: generateId('sel'),
        role: 'selection',
        contentId: content.register(canvas, { transient: true }),
        enabled: true,
        bounds,
      }
      st.doc.channels.push(channel)
      st.doc.selectionId = channel.id
    } else {
      st.doc.selectionId = undefined
      if (!before.channel) return false
    }
    history.push(new SetSelectionCommand(label, st.doc, before, snapshotSelection(st.doc), content))
    refresh()
    return true
  }

  function layerOpDeps() {
    return {
      root: st.doc.root,
      content,
      push: (cmd: import('../history').Command) => history.push(cmd),
      bitmapOf: (node: SceneNode): HTMLCanvasElement | null => {
        if (node.kind === 'raster') return content.get((node as RasterData).contentId)?.canvas ?? null
        if (node.kind === 'text') return textBitmap(node as import('../node').TextData)
        if (node.kind === 'vector') return vectorBitmap(node as import('../node').VectorData)
        if (node.kind === 'fill') return fillBitmap(node as import('../node').FillData, st.doc.width, st.doc.height)
        return null
      },
    }
  }

  function addNodeInternal(node: SceneNode, index?: number, parent?: GroupData): void {
    const into = parent ?? st.doc.root
    const at = index ?? into.children.length
    into.children.splice(at, 0, node)
    history.push(new AddNodeCommand(`Add ${node.name}`, into, node, at))
    st.selectedIds = [node.id]
    refresh()
  }
  return {
    setPreviewOverride, unionRects, hexRgb, floatingInputs, render, visibleComposite, selectionChannel,
    selectionOutlines, buildOverlay, refresh, liveSelectedIds, activeNodeIdOf, setSelected, setActive,
    collectGarbage, activeLocation, activeRaster, currentSelectionMask, combineSelectionMask, commitSelection,
    layerOpDeps, addNodeInternal,
  }
}

export type EditorCore = ReturnType<typeof createEditorCore>
