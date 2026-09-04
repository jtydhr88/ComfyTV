import {
  clonePath,
  deriveVectorTransform,
  Dirty,
  filterTopmost,
  findNode,
  generateId,
  getNodeKind,
  PropCommand,
  SetTransformCommand,
  transformPath,
  type GroupData,
  type PathData,
  type SceneNode,
  type Transform,
  type VectorData,
} from '../../engine'
import type { StageCtx } from './stageContext'

export function createStageLayerStructure(ctx: StageCtx) {
  const { editor, engineNode, activeId, backgroundColor } = ctx

  function undo(): void { editor.undo() }
  function redo(): void { editor.redo() }
  function moveLayer(id: string, dir: 1 | -1): void {
    editor.moveNode(id, dir)
  }
  function removeLayer(id: string): void {
    const targets = ctx.selectionTargets(id).filter((tid) => {
      const n = engineNode(tid)
      return n && !(n.locks.content && n.locks.position)
    })
    if (targets.length) editor.removeNodes(targets)
  }
  function regenIds(n: SceneNode): void {
    n.id = generateId(n.kind)
    if (n.kind === 'group') for (const c of (n as GroupData).children) regenIds(c)
  }
  function duplicateOne(id: string): string | null {
    const loc = findNode(editor.document().root, id)
    if (!loc) return null
    const kind = getNodeKind(loc.node.kind)
    const copy = kind.normalize(kind.serialize(loc.node)) as SceneNode
    regenIds(copy)
    copy.name = `${loc.node.name} copy`
    editor.addNode(copy, loc.index + 1, loc.parent.id)
    return copy.id
  }
  function duplicateLayer(id: string): void {
    const targets = filterTopmost(editor.document().root, ctx.selectionTargets(id))
    const copies: string[] = []
    ctx.batch('Duplicate Layers', targets, (tid) => {
      const cid = duplicateOne(tid)
      if (cid) copies.push(cid)
    })
    if (copies.length > 1) editor.setSelectedNodes(copies)
  }
  function groupActiveLayer(): void {
    editor.groupActive()
  }
  function ungroupActiveLayer(): void {
    editor.ungroupActive()
  }
  function moveLayerRelative(id: string, targetId: string | null, pos: 'above' | 'below' | 'into'): void {
    if (id === targetId) return
    if (targetId === null) {
      editor.moveNodeTo(id, undefined, 0)
      return
    }
    const tloc = findNode(editor.document().root, targetId)
    if (!tloc) return
    if (pos === 'into' && tloc.node.kind === 'group') {
      editor.moveNodeTo(id, targetId, (tloc.node as GroupData).children.length)
      return
    }
    const parentId = tloc.parent.id === 'root' ? undefined : tloc.parent.id
    editor.moveNodeTo(id, parentId, pos === 'above' ? tloc.index + 1 : tloc.index)
  }
  function anchorFloating(target?: 'active' | 'new'): void {
    editor.anchorFloating(target)
  }
  function cancelFloating(): void {
    editor.cancelFloating()
  }
  function mergeDown(id: string): void {
    editor.mergeDown(id)
  }
  function flattenImage(): void {
    editor.flattenImage(backgroundColor.value)
  }
  function flipImage(axis: 'h' | 'v'): void {
    editor.flipImage(axis)
  }
  function cropToContent(id: string): void {
    editor.cropToContent(id)
  }
  function rasterizeLayer(id: string): void {
    editor.rasterizeLayer(id)
  }
  function layerToCanvasSize(id: string): void {
    editor.layerToCanvasSize(id)
  }
  function selectAll(): void {
    editor.selectAll()
  }
  function selectNone(): void {
    editor.selectNone()
  }
  function invertSelection(): void {
    editor.invertSelection()
  }
  function nudgeActive(dx: number, dy: number): void {
    const id = activeId.value; if (!id) return
    const targets = filterTopmost(editor.document().root, ctx.selectionTargets(id)).filter((tid) => {
      const n = engineNode(tid)
      return n && !n.locks.position
    })
    ctx.batch('Move', targets, (tid) => nudgeOne(tid, dx, dy))
  }
  function nudgeOne(id: string, dx: number, dy: number): void {
    const n = engineNode(id); if (!n || n.locks.position) return
    if (n.kind === 'vector') {
      const v = n as VectorData
      const snapshot = () => ({ path: clonePath(v.path), transform: { ...v.transform } })
      const restore = (s: { path: PathData; transform: Transform }) => {
        v.path = clonePath(s.path)
        v.transform = { ...s.transform }
      }
      const before = snapshot()
      v.path = transformPath(v.path, (p) => ({ x: p.x + dx, y: p.y + dy }))
      v.transform = deriveVectorTransform(v.path, v.stroke?.width ?? 0)
      editor.history.push(new PropCommand('Move', Dirty.DRAWABLE, snapshot, restore, before, snapshot(), `nudge:${id}`))
      editor.invalidate()
      return
    }
    ctx.editProp('Move', Dirty.META, () => ({ ...n.transform }), (tf) => (n.transform = tf), { ...n.transform, x: n.transform.x + dx, y: n.transform.y + dy }, `nudge:${id}`)
  }
  function setLayerTransform(id: string, patch: Partial<Transform>): boolean {
    const n = engineNode(id)
    if (!n || n.locks.position || n.kind === 'vector') return false
    const before = { ...n.transform }
    const after = { ...before, ...patch }
    n.transform = after
    editor.history.push(new SetTransformCommand('Transform', n, before, after))
    editor.invalidate()
    return true
  }
  function selectRect(rect: { x: number; y: number; w: number; h: number }): boolean {
    return editor.setRectSelection(rect)
  }
  function withHistoryGroup<T>(label: string, fn: () => T): T {
    editor.history.beginGroup(label)
    try {
      return fn()
    } finally {
      editor.history.endGroup()
    }
  }
  return {
    undo, redo, moveLayer, removeLayer, duplicateLayer, groupActiveLayer, ungroupActiveLayer, moveLayerRelative,
    anchorFloating, cancelFloating, mergeDown, flattenImage, flipImage, cropToContent, rasterizeLayer, layerToCanvasSize,
    selectAll, selectNone, invertSelection, nudgeActive, setLayerTransform, selectRect, withHistoryGroup,
  }
}
