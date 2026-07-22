import { BakeRasterCommand, snapshotRaster } from '../commands/bakeContent'
import { AddNodeCommand, RemoveNodeCommand, ReorderCommand } from '../commands/structure'
import type { Compositor, CompositeInput } from '../compositor'
import type { ContentStore } from '../content'
import { findNode, type Document } from '../document'
import { CommandGroup, History } from '../history'
import { DefaultContentStore } from '../impl/contentStore'
import { defaultMode, resolveMode } from '../mode'
import type { GroupData, RasterData, SceneNode, Transform, Vec2 } from '../node'
import { getNodeKind } from '../nodeKind'
import type { BrushParams } from '../paint'
import { getPaintCore } from '../paint'
import { bakeMaskInto, bakePlaced, drawPlacedInto, isIdentityPlacement, placedBounds } from '../render/bake'
import { placeBitmap } from '../render/place'
import { renderDocument, type PlacedEntry } from '../render/renderStack'
import { getTool, type Tool, type ToolContext } from '../tool'
import { addTransformBox } from '../tools/overlayBox'
import { angleTo, applyMove, applyResize, applyRotate, hitHandle, insideBox, type HandleId } from '../tools/transformMath'
import { textBitmap } from '../kinds/text'
import { vectorBitmap } from '../kinds/vector'
import { fillBitmap } from '../kinds/fill'
import { groupKind } from '../kinds/group'
import { DEFAULT_SHAPE_OPTIONS, type ShapeToolOptions } from '../tools/shapeTool'
import { SetSelectionCommand, snapshotSelection } from '../commands/selection'
import { generateId } from '../id'
import type { ChannelData, Rect } from '../node'
import { cropToContent as cropToContentOp, layerToCanvasSize as layerToCanvasSizeOp, mergeDown as mergeDownOp } from './layerOps'
import { clampRectToDoc, fullSelectionCanvas, invertSelectionCanvas, lumaBBox, rectSelectionCanvas } from './selectionOps'
import { OverlayList } from './overlayList'

export interface FloatingItem {
  contentId: string
  transform: Transform
  name?: string
}

type FloatSession =
  | { mode: 'idle' }
  | { mode: 'move'; start: Vec2; before: Transform }
  | { mode: 'resize'; handle: HandleId; before: Transform }
  | { mode: 'rotate'; before: Transform; grab: number }

export interface EditorOptions {
  compositor: Compositor
  content?: ContentStore
  onChange?: () => void
}

const DEFAULT_BRUSH: BrushParams = { size: 24, hardness: 0.6, spacing: 0.1, opacity: 1, flow: 1, color: '#ffffff' }

export function emptyDocument(width: number, height: number): Document {
  const root: GroupData = {
    kind: 'group',
    id: 'root',
    name: 'root',
    visible: true,
    opacity: 1,
    mode: defaultMode('normal'),
    transform: { x: 0, y: 0, w: width, h: height, rotation: 0 },
    locks: { content: false, position: false, visibility: false },
    children: [],
    passThrough: false,
  }
  return { version: 2, width, height, root, channels: [] }
}

export interface Editor {
  readonly history: History
  readonly content: ContentStore
  readonly overlay: OverlayList
  document(): Document
  loadDocument(doc: Document): void
  serialize(): unknown
  loadJSON(raw: unknown): void
  hydrate(loadUrl: (url: string) => Promise<HTMLCanvasElement>): Promise<void>
  setTool(id: string): void
  activeToolId(): string
  setBrush(params: Partial<BrushParams>): void
  brushParams(): BrushParams
  setShapeOptions(opts: Partial<ShapeToolOptions>): void
  shapeOptions(): ShapeToolOptions
  activeNodeId(): string | null
  setActiveNode(id: string | null): void
  pointerDown(e: PointerEvent, pt: Vec2): void
  pointerMove(e: PointerEvent, pt: Vec2): void
  pointerUp(e: PointerEvent, pt: Vec2): void
  hover(e: PointerEvent, pt: Vec2): void
  addNode(node: SceneNode, index?: number, parentId?: string): void
  removeActive(): void
  reorder(id: string, toIndex: number): void
  moveNode(id: string, dir: 1 | -1): boolean
  moveNodeTo(id: string, parentId: string | undefined, toIndex: number): boolean
  groupActive(): boolean
  ungroupActive(): boolean
  setZoom(z: number): void
  zoom(): number
  render(): void
  buildOverlay(): void
  invalidate(): void
  undo(): void
  redo(): void
  floating(): FloatingItem | null
  startFloating(contentId: string, width: number, height: number, name?: string): void
  anchorFloating(target?: 'active' | 'new'): void
  cancelFloating(): void
  mergeDown(id: string): boolean
  flattenImage(): boolean
  cropToContent(id: string): boolean
  layerToCanvasSize(id: string): boolean
  selectionBounds(): Rect | null
  setRectSelection(rect: Rect): boolean
  selectAll(): boolean
  selectNone(): boolean
  invertSelection(): boolean
}

export function createEditor(opts: EditorOptions): Editor {
  const compositor = opts.compositor
  const content = opts.content ?? new DefaultContentStore()
  const history = new History()
  const notify = opts.onChange ?? (() => {})
  const overlay = new OverlayList(() => notify())

  let doc = emptyDocument(1024, 1024)
  let toolId = 'select'
  let tool: Tool | null = null
  let activeId: string | null = null
  let zoomLevel = 1
  let brush: BrushParams = { ...DEFAULT_BRUSH }
  let shape: ShapeToolOptions = { ...DEFAULT_SHAPE_OPTIONS }

  const overrides = new Map<string, HTMLCanvasElement>()
  const placedCache = new Map<string, PlacedEntry>()
  let floating: FloatingItem | null = null
  let floatSession: FloatSession = { mode: 'idle' }

  function floatingInputs(): CompositeInput[] {
    if (!floating) return []
    const entry = content.get(floating.contentId)
    if (!entry) return []
    const canvas = placeBitmap(entry.canvas, floating.transform, doc.width, doc.height)
    if (!canvas) return []
    return [
      {
        texture: { source: canvas, rect: { x: 0, y: 0, w: doc.width, h: doc.height }, linear: false },
        opacity: 1,
        mode: resolveMode(defaultMode('normal')),
      },
    ]
  }
  function render(): void {
    renderDocument(doc, { content, compositor, devicePixelRatio: 1, overrides, placedCache }, floatingInputs())
  }
  function selectionChannel(): ChannelData | null {
    if (!doc.selectionId) return null
    return doc.channels.find((ch) => ch.id === doc.selectionId && ch.role === 'selection') ?? null
  }

  function buildOverlay(): void {
    overlay.clear()
    const sel = selectionChannel()
    if (sel?.bounds) overlay.add({ type: 'rect', rect: sel.bounds, ants: true })
    if (floating) {
      addTransformBox(overlay, floating.transform)
      return
    }
    tool?.drawOverlay(overlay)
  }
  function refresh(): void {
    render()
    buildOverlay()
    notify()
  }
  function setActive(id: string | null): void {
    if (activeId === id) return
    activeId = id
    buildOverlay()
    notify()
  }
  function collectGarbage(): void {
    const live = new Set<string>()
    for (const id of getNodeKind(doc.root.kind).contentIds(doc.root)) live.add(id)
    for (const ch of doc.channels) live.add(ch.contentId)
    for (const id of history.contentRefs()) live.add(id)
    if (floating) live.add(floating.contentId)
    content.collectGarbage(live)
  }
  history.onChange(collectGarbage)

  const ctx: ToolContext = {
    document: () => doc,
    history,
    compositor,
    content,
    overlay,
    activeNodeId: () => activeId,
    setActiveNode: setActive,
    createPaintCore: (id) => getPaintCore(id).create(),
    setPaintPreview: (key, canvas) => {
      if (canvas) overrides.set(key, canvas)
      else overrides.delete(key)
    },
    selection: {
      setRect: (rect) => {
        const clamped = clampRectToDoc(rect, doc.width, doc.height)
        if (!clamped) return
        commitSelection('Select Rectangle', rectSelectionCanvas(doc.width, doc.height, clamped), clamped)
      },
      none: () => {
        commitSelection('Select None', null, null)
      },
    },
    zoom: () => zoomLevel,
    requestRender: refresh,
    options: <T,>() => (toolId === 'shape' ? shape : brush) as unknown as T,
  }

  function makeTool(): void {
    tool?.onDeactivate?.()
    tool = getTool(toolId).create(ctx)
    tool.onActivate?.()
  }
  makeTool()

  function activeLocation(): { parent: GroupData; node: SceneNode; index: number } | null {
    if (!activeId) return null
    return findNode(doc.root, activeId)
  }

  function activeRaster(): RasterData | null {
    const loc = activeLocation()
    return loc && loc.node.kind === 'raster' ? (loc.node as RasterData) : null
  }

  function commitSelection(label: string, canvas: HTMLCanvasElement | null, bounds: Rect | null): boolean {
    const before = snapshotSelection(doc)
    doc.channels = doc.channels.filter((ch) => ch.role !== 'selection')
    if (canvas && bounds) {
      const channel: ChannelData = {
        id: generateId('sel'),
        role: 'selection',
        contentId: content.register(canvas),
        enabled: true,
        bounds,
      }
      doc.channels.push(channel)
      doc.selectionId = channel.id
    } else {
      doc.selectionId = undefined
      if (!before.channel) return false
    }
    history.push(new SetSelectionCommand(label, doc, before, snapshotSelection(doc), content))
    refresh()
    return true
  }

  function layerOpDeps() {
    return {
      root: doc.root,
      content,
      push: (cmd: import('../history').Command) => history.push(cmd),
      bitmapOf: (node: SceneNode): HTMLCanvasElement | null => {
        if (node.kind === 'raster') return content.get((node as RasterData).contentId)?.canvas ?? null
        if (node.kind === 'text') return textBitmap(node as import('../node').TextData)
        if (node.kind === 'vector') return vectorBitmap(node as import('../node').VectorData)
        if (node.kind === 'fill') return fillBitmap(node as import('../node').FillData, doc.width, doc.height)
        return null
      },
    }
  }

  function addNodeInternal(node: SceneNode, index?: number, parent?: GroupData): void {
    const into = parent ?? doc.root
    const at = index ?? into.children.length
    into.children.splice(at, 0, node)
    history.push(new AddNodeCommand(`Add ${node.name}`, into, node, at))
    activeId = node.id
    refresh()
  }

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
    if (!floating) return
    const item = floating
    const entry = content.get(item.contentId)
    if (!entry) {
      floating = null
      floatSession = { mode: 'idle' }
      refresh()
      return
    }
    let mode: 'active' | 'new' = target ?? (activeRaster() ? 'active' : 'new')
    if (mode === 'active') {
      const node = activeRaster()
      if (!node || node.locks.content) mode = 'new'
      else if (anchorInto(node, item, entry.canvas)) {
        floating = null
        floatSession = { mode: 'idle' }
        refresh()
        return
      }
    }
    floating = null
    floatSession = { mode: 'idle' }
    anchorAsNewLayer(item, entry)
  }

  function floatingPress(pt: Vec2): void {
    if (!floating) return
    const t = floating.transform
    const tol = 8 / Math.max(1e-3, zoomLevel)
    const h = hitHandle(t, pt, tol)
    if (h === 'rotate') {
      floatSession = { mode: 'rotate', before: { ...t }, grab: angleTo(t, pt) }
      return
    }
    if (h) {
      floatSession = { mode: 'resize', handle: h, before: { ...t } }
      return
    }
    if (insideBox(t, pt)) {
      floatSession = { mode: 'move', start: pt, before: { ...t } }
      return
    }
    anchorFloatingImpl()
  }

  function floatingMotion(e: PointerEvent, pt: Vec2): void {
    if (!floating || floatSession.mode === 'idle') return
    const s = floatSession
    if (s.mode === 'move') {
      floating.transform = applyMove(s.before, pt.x - s.start.x, pt.y - s.start.y)
    } else if (s.mode === 'resize') {
      floating.transform = applyResize(s.before, s.handle, pt)
    } else {
      floating.transform = applyRotate(s.before, s.before.rotation, s.grab, pt, e.shiftKey ? Math.PI / 12 : 0)
    }
    refresh()
  }

  return {
    history,
    content,
    overlay,
    document: () => doc,
    loadDocument(d) {
      doc = d
      activeId = null
      floating = null
      floatSession = { mode: 'idle' }
      history.clear()
      refresh()
    },
    serialize() {
      return {
        version: doc.version,
        width: doc.width,
        height: doc.height,
        root: getNodeKind(doc.root.kind).serialize(doc.root),
        channels: doc.channels,
        selectionId: doc.selectionId,
      }
    },
    loadJSON(raw) {
      let obj: unknown
      try {
        obj = typeof raw === 'string' ? JSON.parse(raw) : raw
      } catch {
        return
      }
      if (!obj || typeof obj !== 'object') return
      const o = obj as Record<string, unknown>
      const rootRaw = (o.root as unknown) ?? obj
      const root = getNodeKind('group').normalize(rootRaw) as GroupData
      doc = {
        version: 2,
        width: Number(o.width) || doc.width,
        height: Number(o.height) || doc.height,
        root,
        channels: Array.isArray(o.channels) ? (o.channels as Document['channels']) : [],
        selectionId: typeof o.selectionId === 'string' ? o.selectionId : undefined,
      }
      activeId = null
      floating = null
      floatSession = { mode: 'idle' }
      history.clear()
      refresh()
    },
    async hydrate(loadUrl) {
      await getNodeKind(doc.root.kind).hydrate(doc.root, { content, loadUrl })
      for (const ch of doc.channels) {
        if (ch.url && !content.has(ch.contentId)) {
          try {
            const canvas = await loadUrl(ch.url)
            content.register(canvas, { id: ch.contentId, uploadedUrl: ch.url })
          } catch {
            void 0
          }
        }
      }
      refresh()
    },
    setTool(id) {
      toolId = id
      makeTool()
      buildOverlay()
      notify()
    },
    activeToolId: () => toolId,
    setBrush(params) {
      brush = { ...brush, ...params }
    },
    brushParams: () => ({ ...brush }),
    setShapeOptions(opts) {
      shape = { ...shape, ...opts }
    },
    shapeOptions: () => ({ ...shape }),
    activeNodeId: () => activeId,
    setActiveNode: setActive,
    pointerDown(e, pt) {
      if (floating) {
        floatingPress(pt)
        return
      }
      tool?.onButtonPress(e, pt)
    },
    pointerMove(e, pt) {
      if (floating) {
        floatingMotion(e, pt)
        return
      }
      tool?.onMotion(e, pt)
    },
    pointerUp(e, pt) {
      if (floating) {
        floatSession = { mode: 'idle' }
        return
      }
      tool?.onButtonRelease(e, pt)
    },
    hover(e, pt) {
      if (floating) return
      tool?.onHover(e, pt)
    },
    addNode(node, index, parentId) {
      const parent =
        parentId && parentId !== doc.root.id
          ? (findNode(doc.root, parentId)?.node as GroupData | undefined)
          : undefined
      addNodeInternal(node, index, parent && parent.kind === 'group' ? parent : undefined)
    },
    removeActive() {
      const loc = activeLocation()
      if (!loc) return
      loc.parent.children.splice(loc.index, 1)
      history.push(new RemoveNodeCommand(`Delete ${loc.node.name}`, loc.parent, loc.node, loc.index))
      activeId = null
      refresh()
    },
    reorder(id, toIndex) {
      const loc = findNode(doc.root, id)
      if (!loc) return
      loc.parent.children.splice(loc.index, 1)
      const to = Math.max(0, Math.min(toIndex, loc.parent.children.length))
      loc.parent.children.splice(to, 0, loc.node)
      history.push(new ReorderCommand('Reorder', loc.node, loc.parent, loc.index, loc.parent, to))
      refresh()
    },
    moveNode(id, dir) {
      const loc = findNode(doc.root, id)
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
      } else if (parent !== doc.root) {
        const ploc = findNode(doc.root, parent.id)
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
      const loc = findNode(doc.root, id)
      if (!loc) return false
      const target =
        parentId && parentId !== doc.root.id ? findNode(doc.root, parentId)?.node : doc.root
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
      const loc = activeLocation()
      if (!loc || loc.node.id === doc.root.id) return false
      const group = groupKind.create({ children: [loc.node] })
      loc.parent.children.splice(loc.index, 1, group)
      const cmds = new CommandGroup('Group')
      cmds.children.push(new RemoveNodeCommand(`Group ${loc.node.name}`, loc.parent, loc.node, loc.index))
      cmds.children.push(new AddNodeCommand(`Add ${group.name}`, loc.parent, group, loc.index))
      history.push(cmds)
      activeId = group.id
      refresh()
      return true
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
      activeId = kids.length ? kids[kids.length - 1].id : null
      refresh()
      return true
    },
    setZoom(z) {
      zoomLevel = z
    },
    zoom: () => zoomLevel,
    render,
    buildOverlay,
    invalidate: refresh,
    undo() {
      history.undo()
      refresh()
    },
    redo() {
      history.redo()
      refresh()
    },
    mergeDown(id) {
      const ok = mergeDownOp(layerOpDeps(), id)
      if (ok) refresh()
      return ok
    },
    flattenImage() {
      if (!compositor.getCanvas()) return false
      if (floating) anchorFloatingImpl()
      if (doc.root.children.length === 0) return false
      render()
      const img = compositor.readback()
      if (img.width !== doc.width || img.height !== doc.height) return false
      const canvas = document.createElement('canvas')
      canvas.width = doc.width
      canvas.height = doc.height
      const g = canvas.getContext('2d')
      if (!g) return false
      g.fillStyle = '#ffffff'
      g.fillRect(0, 0, doc.width, doc.height)
      const tmp = document.createElement('canvas')
      tmp.width = doc.width
      tmp.height = doc.height
      const tg = tmp.getContext('2d')
      if (!tg) return false
      tg.putImageData(img, 0, 0)
      g.drawImage(tmp, 0, 0)

      const group = new CommandGroup('Flatten Image')
      const children = doc.root.children
      for (let i = children.length - 1; i >= 0; i--) {
        const node = children[i]
        children.splice(i, 1)
        group.children.push(new RemoveNodeCommand(`Flatten ${node.name}`, doc.root, node, i))
      }
      const flat = getNodeKind('raster').create({
        name: 'Background',
        contentId: content.register(canvas),
        naturalWidth: doc.width,
        naturalHeight: doc.height,
        transform: { x: 0, y: 0, w: doc.width, h: doc.height, rotation: 0 },
      } as Partial<RasterData>) as SceneNode
      children.push(flat)
      group.children.push(new AddNodeCommand('Flatten Result', doc.root, flat, 0))
      activeId = flat.id
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
      const ok = layerToCanvasSizeOp(layerOpDeps(), id, doc.width, doc.height)
      if (ok) refresh()
      return ok
    },
    selectionBounds() {
      return selectionChannel()?.bounds ?? null
    },
    setRectSelection(rect) {
      const clamped = clampRectToDoc(rect, doc.width, doc.height)
      if (!clamped) return false
      return commitSelection('Select Rectangle', rectSelectionCanvas(doc.width, doc.height, clamped), clamped)
    },
    selectAll() {
      const rect: Rect = { x: 0, y: 0, w: doc.width, h: doc.height }
      return commitSelection('Select All', fullSelectionCanvas(doc.width, doc.height), rect)
    },
    selectNone() {
      return commitSelection('Select None', null, null)
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
    floating: () => floating,
    startFloating(contentId, width, height, name) {
      if (floating) anchorFloatingImpl()
      const sel = selectionChannel()
      const target = sel?.bounds ?? { x: 0, y: 0, w: doc.width, h: doc.height }
      if (sel) commitSelection('Select None', null, null)
      const x = Math.round(target.x + (target.w - width) / 2)
      const y = Math.round(target.y + (target.h - height) / 2)
      floating = {
        contentId,
        name,
        transform: {
          x: width <= doc.width ? Math.max(0, Math.min(x, doc.width - width)) : x,
          y: height <= doc.height ? Math.max(0, Math.min(y, doc.height - height)) : y,
          w: width,
          h: height,
          rotation: 0,
        },
      }
      floatSession = { mode: 'idle' }
      refresh()
    },
    anchorFloating(target) {
      anchorFloatingImpl(target)
    },
    cancelFloating() {
      if (!floating) return
      floating = null
      floatSession = { mode: 'idle' }
      collectGarbage()
      refresh()
    },
  }
}
