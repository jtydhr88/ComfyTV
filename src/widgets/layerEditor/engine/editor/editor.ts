import { AddNodeCommand, RemoveNodeCommand, ReorderCommand } from '../commands/structure'
import type { Compositor } from '../compositor'
import type { ContentStore } from '../content'
import { findNode, type Document } from '../document'
import { History } from '../history'
import { DefaultContentStore } from '../impl/contentStore'
import { defaultMode } from '../mode'
import type { GroupData, SceneNode, Vec2 } from '../node'
import { getNodeKind } from '../nodeKind'
import type { BrushParams } from '../paint'
import { getPaintCore } from '../paint'
import { renderDocument } from '../render/renderStack'
import { getTool, type Tool, type ToolContext } from '../tool'
import { OverlayList } from './overlayList'

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
  activeNodeId(): string | null
  setActiveNode(id: string | null): void
  pointerDown(e: PointerEvent, pt: Vec2): void
  pointerMove(e: PointerEvent, pt: Vec2): void
  pointerUp(e: PointerEvent, pt: Vec2): void
  hover(e: PointerEvent, pt: Vec2): void
  addNode(node: SceneNode, index?: number): void
  removeActive(): void
  reorder(id: string, toIndex: number): void
  setZoom(z: number): void
  zoom(): number
  render(): void
  buildOverlay(): void
  invalidate(): void
  undo(): void
  redo(): void
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

  const overrides = new Map<string, HTMLCanvasElement>()

  function render(): void {
    renderDocument(doc, { content, compositor, devicePixelRatio: 1, overrides })
  }
  function buildOverlay(): void {
    overlay.clear()
    tool?.drawOverlay(overlay)
  }
  function refresh(): void {
    render()
    buildOverlay()
    notify()
  }

  const ctx: ToolContext = {
    document: () => doc,
    history,
    compositor,
    content,
    overlay,
    activeNodeId: () => activeId,
    setActiveNode: (id) => {
      activeId = id
    },
    createPaintCore: (id) => getPaintCore(id).create(),
    setPaintPreview: (key, canvas) => {
      if (canvas) overrides.set(key, canvas)
      else overrides.delete(key)
    },
    zoom: () => zoomLevel,
    requestRender: refresh,
    options: <T,>() => brush as unknown as T,
  }

  function makeTool(): void {
    tool = getTool(toolId).create(ctx)
  }
  makeTool()

  function activeLocation(): { parent: GroupData; node: SceneNode; index: number } | null {
    if (!activeId) return null
    return findNode(doc.root, activeId)
  }

  return {
    history,
    content,
    overlay,
    document: () => doc,
    loadDocument(d) {
      doc = d
      activeId = null
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
      }
      activeId = null
      history.clear()
      refresh()
    },
    async hydrate(loadUrl) {
      await getNodeKind(doc.root.kind).hydrate(doc.root, { content, loadUrl })
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
    activeNodeId: () => activeId,
    setActiveNode(id) {
      activeId = id
      buildOverlay()
      notify()
    },
    pointerDown(e, pt) {
      tool?.onButtonPress(e, pt)
    },
    pointerMove(e, pt) {
      tool?.onMotion(e, pt)
    },
    pointerUp(e, pt) {
      tool?.onButtonRelease(e, pt)
    },
    hover(e, pt) {
      tool?.onHover(e, pt)
    },
    addNode(node, index) {
      const at = index ?? doc.root.children.length
      doc.root.children.splice(at, 0, node)
      history.push(new AddNodeCommand(`Add ${node.name}`, doc.root, node, at))
      activeId = node.id
      refresh()
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
  }
}
