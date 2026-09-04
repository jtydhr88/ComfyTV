import { PropCommand } from '../commands/prop'
import { SetContentCommand } from '../commands/setContent'
import { AddNodeCommand, RemoveNodeCommand, ReorderCommand } from '../commands/structure'
import { filterTopmost, findNode, type NodeLocation } from '../document'
import { CommandGroup, Dirty } from '../history'
import { groupKind } from '../kinds/group'
import { deriveVectorTransform } from '../kinds/vector'
import type { GroupData, RasterData, SceneNode, Transform, VectorData } from '../node'
import { getNodeKind } from '../nodeKind'
import { isTransformTool } from '../tools/transformTool'
import { clonePath, transformPath, type PathData } from '../vector'
import { arrangeNodes, type ArrangeOp } from './arrangeOps'
import type { EditorCore } from './editorCore'
import type { Editor, EditorEnv } from './editorTypes'
import {
  canRasterizeLayer, cropToContent as cropToContentOp, layerToCanvasSize as layerToCanvasSizeOp,
  mergeDown as mergeDownOp, rasterizeLayer as rasterizeLayerOp,
} from './layerOps'

type StructureApi = Pick<Editor,
  | 'arrangeSelected' | 'removeNodes' | 'addNode' | 'removeActive' | 'reorder' | 'moveNode' | 'moveNodeTo'
  | 'groupActive' | 'ungroupActive' | 'mergeDown' | 'rasterizeLayer' | 'canRasterize' | 'flattenImage'
  | 'flipImage' | 'cropToContent' | 'layerToCanvasSize'>

export function createEditorStructure(env: EditorEnv, core: EditorCore, anchorFloatingImpl: () => void): StructureApi {
  const { st, compositor, content, history } = env
  const { refresh, liveSelectedIds, activeNodeIdOf, activeLocation, addNodeInternal, render, layerOpDeps } = core
  function arrangeSelectedImpl(op: ArrangeOp): boolean {
    if (isTransformTool(st.tool)) st.tool.apply()
    const ok = arrangeNodes(st.doc.root, liveSelectedIds(), op, history)
    if (ok) refresh()
    return ok
  }

  function removeNodesImpl(ids: string[]): boolean {
    const locs = filterTopmost(st.doc.root, ids)
      .map((id) => findNode(st.doc.root, id))
      .filter((l): l is NodeLocation => l !== null)
    if (!locs.length) return false
    const cmds = new CommandGroup(`Delete ${locs.length} Layers`)
    for (const loc of locs) {
      const at = loc.parent.children.indexOf(loc.node)
      if (at < 0) continue
      loc.parent.children.splice(at, 1)
      cmds.children.push(new RemoveNodeCommand(`Delete ${loc.node.name}`, loc.parent, loc.node, at))
    }
    if (cmds.empty) return false
    history.push(cmds.children.length === 1 ? cmds.children[0] : cmds)
    st.selectedIds = []
    refresh()
    return true
  }

  function groupNodesImpl(ids: string[]): boolean {
    const locs = filterTopmost(st.doc.root, ids)
      .filter((id) => id !== st.doc.root.id)
      .map((id) => findNode(st.doc.root, id))
      .filter((l): l is NodeLocation => l !== null)
    if (!locs.length) return false
    const sameParent = locs.every((l) => l.parent === locs[0].parent)
    const insertParent = sameParent ? locs[0].parent : st.doc.root
    const insertAt = sameParent
      ? Math.min(...locs.map((l) => l.parent.children.indexOf(l.node)))
      : st.doc.root.children.length
    const cmds = new CommandGroup('Group')
    for (const loc of locs) {
      const at = loc.parent.children.indexOf(loc.node)
      loc.parent.children.splice(at, 1)
      cmds.children.push(new RemoveNodeCommand(`Group ${loc.node.name}`, loc.parent, loc.node, at))
    }
    const group = groupKind.create({ children: locs.map((l) => l.node) })
    const at = Math.max(0, Math.min(insertAt, insertParent.children.length))
    insertParent.children.splice(at, 0, group)
    cmds.children.push(new AddNodeCommand(`Add ${group.name}`, insertParent, group, at))
    history.push(cmds)
    st.selectedIds = [group.id]
    refresh()
    return true
  }
  return {
    arrangeSelected: arrangeSelectedImpl,
    removeNodes: removeNodesImpl,
    addNode(node, index, parentId) {
      const parent =
        parentId && parentId !== st.doc.root.id
          ? (findNode(st.doc.root, parentId)?.node as GroupData | undefined)
          : undefined
      addNodeInternal(node, index, parent && parent.kind === 'group' ? parent : undefined)
    },
    removeActive() {
      const id = activeNodeIdOf()
      if (id) removeNodesImpl([id])
    },
    reorder(id, toIndex) {
      const loc = findNode(st.doc.root, id)
      if (!loc) return
      loc.parent.children.splice(loc.index, 1)
      const to = Math.max(0, Math.min(toIndex, loc.parent.children.length))
      loc.parent.children.splice(to, 0, loc.node)
      history.push(new ReorderCommand('Reorder', loc.node, loc.parent, loc.index, loc.parent, to))
      refresh()
    },
    moveNode(id, dir) {
      const loc = findNode(st.doc.root, id)
      if (!loc) return false
      const { parent, node, index } = loc
      const sib = parent.children[index + dir]
      let toParent: GroupData
      let toIndex: number
      if (sib && sib.kind === 'group') {
        toParent = sib as GroupData
        toIndex = dir === 1 ? 0 : toParent.children.length
      } else if (sib) {
        toParent = parent
        toIndex = index + dir
      } else if (parent !== st.doc.root) {
        const ploc = findNode(st.doc.root, parent.id)
        if (!ploc) return false
        toParent = ploc.parent
        toIndex = dir === 1 ? ploc.index + 1 : ploc.index
      } else {
        return false
      }
      parent.children.splice(index, 1)
      const to = Math.max(0, Math.min(toIndex, toParent.children.length))
      toParent.children.splice(to, 0, node)
      history.push(new ReorderCommand('Reorder', node, parent, index, toParent, to))
      refresh()
      return true
    },
    moveNodeTo(id, parentId, toIndex) {
      const loc = findNode(st.doc.root, id)
      if (!loc) return false
      const target =
        parentId && parentId !== st.doc.root.id ? findNode(st.doc.root, parentId)?.node : st.doc.root
      if (!target || target.kind !== 'group') return false
      const toParent = target as GroupData
      if (loc.node.kind === 'group') {
        if (toParent.id === loc.node.id) return false
        if (findNode(loc.node as GroupData, toParent.id)) return false
      }
      let to = Math.max(0, Math.min(toIndex, toParent.children.length))
      loc.parent.children.splice(loc.index, 1)
      if (toParent === loc.parent && loc.index < to) to -= 1
      to = Math.max(0, Math.min(to, toParent.children.length))
      if (toParent === loc.parent && to === loc.index) {
        loc.parent.children.splice(loc.index, 0, loc.node)
        return false
      }
      toParent.children.splice(to, 0, loc.node)
      history.push(new ReorderCommand('Reorder', loc.node, loc.parent, loc.index, toParent, to))
      refresh()
      return true
    },
    groupActive() {
      return groupNodesImpl(st.selectedIds)
    },
    ungroupActive() {
      const loc = activeLocation()
      if (!loc || loc.node.kind !== 'group') return false
      const group = loc.node as GroupData
      const kids = [...group.children]
      loc.parent.children.splice(loc.index, 1, ...kids)
      const cmds = new CommandGroup('Ungroup')
      cmds.children.push(new RemoveNodeCommand(`Ungroup ${group.name}`, loc.parent, group, loc.index))
      kids.forEach((k, i) => cmds.children.push(new AddNodeCommand(`Add ${k.name}`, loc.parent, k, loc.index + i)))
      history.push(cmds)
      st.selectedIds = kids.map((k) => k.id)
      refresh()
      return true
    },
    mergeDown(id) {
      const ok = mergeDownOp(layerOpDeps(), id)
      if (ok) refresh()
      return ok
    },
    rasterizeLayer(id) {
      const ok = rasterizeLayerOp(layerOpDeps(), id)
      if (ok) refresh()
      return ok
    },
    canRasterize(id) {
      return canRasterizeLayer(st.doc.root, id)
    },
    flattenImage(bgColor?: string) {
      if (!compositor.getCanvas()) return false
      if (st.floating) anchorFloatingImpl()
      if (st.doc.root.children.length === 0) return false
      render()
      const img = compositor.readback()
      if (img.width !== st.doc.width || img.height !== st.doc.height) return false
      const canvas = document.createElement('canvas')
      canvas.width = st.doc.width
      canvas.height = st.doc.height
      const g = canvas.getContext('2d')
      if (!g) return false
      g.fillStyle = bgColor && /^#[0-9a-f]{6}$/i.test(bgColor) ? bgColor : '#ffffff'
      g.fillRect(0, 0, st.doc.width, st.doc.height)
      const tmp = document.createElement('canvas')
      tmp.width = st.doc.width
      tmp.height = st.doc.height
      const tg = tmp.getContext('2d')
      if (!tg) return false
      tg.putImageData(img, 0, 0)
      g.drawImage(tmp, 0, 0)

      const group = new CommandGroup('Flatten Image')
      const children = st.doc.root.children
      for (let i = children.length - 1; i >= 0; i--) {
        const node = children[i]
        children.splice(i, 1)
        group.children.push(new RemoveNodeCommand(`Flatten ${node.name}`, st.doc.root, node, i))
      }
      const flat = getNodeKind('raster').create({
        name: 'Background',
        contentId: content.register(canvas),
        naturalWidth: st.doc.width,
        naturalHeight: st.doc.height,
        transform: { x: 0, y: 0, w: st.doc.width, h: st.doc.height, rotation: 0 },
      } as Partial<RasterData>) as SceneNode
      children.push(flat)
      group.children.push(new AddNodeCommand('Flatten Result', st.doc.root, flat, 0))
      st.selectedIds = [flat.id]
      history.push(group)
      refresh()
      return true
    },
    flipImage(axis) {
      if (st.floating) anchorFloatingImpl()
      const W = st.doc.width
      const H = st.doc.height
      const group = new CommandGroup(axis === 'h' ? 'Flip Horizontal' : 'Flip Vertical')

      const flipCanvas = (src: HTMLCanvasElement): HTMLCanvasElement | null => {
        const c = document.createElement('canvas')
        c.width = src.width
        c.height = src.height
        const g = c.getContext('2d')
        if (!g) return null
        if (axis === 'h') {
          g.translate(src.width, 0)
          g.scale(-1, 1)
        } else {
          g.translate(0, src.height)
          g.scale(1, -1)
        }
        g.drawImage(src, 0, 0)
        return c
      }
      const flipSlot = (slot: { contentId: string; url?: string }, label: string): void => {
        const entry = content.get(slot.contentId)
        if (!entry) return
        const flipped = flipCanvas(entry.canvas)
        if (!flipped) return
        const cmd = new SetContentCommand(label, slot, slot.contentId, content.register(flipped), content, slot.url)
        cmd.apply('redo')
        group.children.push(cmd)
      }
      const pushTransform = (n: SceneNode): void => {
        const before = { ...n.transform }
        const after: Transform = axis === 'h'
          ? { ...n.transform, x: W - n.transform.x - n.transform.w, rotation: -n.transform.rotation }
          : { ...n.transform, y: H - n.transform.y - n.transform.h, rotation: -n.transform.rotation }
        n.transform = after
        group.children.push(new PropCommand('Flip', Dirty.DRAWABLE,
          () => n.transform, (v) => (n.transform = v), before, after))
      }
      const walk = (nodes: SceneNode[]): void => {
        for (const n of nodes) {
          if (n.mask?.contentId) flipSlot(n.mask, 'Flip Mask')
          switch (n.kind) {
            case 'group':
              walk((n as GroupData).children)
              break
            case 'raster':
              flipSlot(n as RasterData, 'Flip Layer')
              pushTransform(n)
              break
            case 'vector': {
              const v = n as VectorData
              const snapshot = () => ({ path: clonePath(v.path), transform: { ...v.transform } })
              const restore = (s: { path: PathData; transform: Transform }) => {
                v.path = clonePath(s.path)
                v.transform = { ...s.transform }
              }
              const before = snapshot()
              v.path = transformPath(v.path, (p) =>
                axis === 'h' ? { x: W - p.x, y: p.y } : { x: p.x, y: H - p.y })
              v.transform = deriveVectorTransform(v.path, v.stroke?.width ?? 0)
              group.children.push(new PropCommand('Flip', Dirty.DRAWABLE, snapshot, restore, before, snapshot()))
              break
            }
            case 'fill':
            case 'adjustment':
              break
            default:
              pushTransform(n)
          }
        }
      }
      walk(st.doc.root.children)
      if (group.empty) return false
      history.push(group)
      refresh()
      return true
    },
    cropToContent(id) {
      const ok = cropToContentOp(layerOpDeps(), id)
      if (ok) refresh()
      return ok
    },
    layerToCanvasSize(id) {
      const ok = layerToCanvasSizeOp(layerOpDeps(), id, st.doc.width, st.doc.height)
      if (ok) refresh()
      return ok
    },
  }
}
