import type { Compositor } from '../compositor'
import type { ContentStore } from '../content'
import type { DocGuide, Document } from '../document'
import type { History } from '../history'
import { defaultMode } from '../mode'
import type { GroupData, Rect, SceneNode, Transform, Vec2 } from '../node'
import type { BrushParams } from '../paint'
import type { PreviewOverride, createMergeCache } from '../render/renderStack'
import type { Tool } from '../tool'
import type { GradientToolOptions } from '../tools/gradientTool'
import type { ShapeToolOptions } from '../tools/shapeTool'
import type { HandleId } from '../tools/transformMath'
import type { WandToolOptions } from '../tools/wandTool'
import type { WarpToolOptions } from '../tools/warpTool'
import type { ArrangeOp } from './arrangeOps'
import type { GuideDragEnd } from './guideOps'
import type { OverlayList } from './overlayList'
import type { SelectionClipboard } from './selectionEdit'
import type { SelectionOp } from './selectionMath'

export interface FloatingItem {
  contentId: string
  transform: Transform
  name?: string
  url?: string
}

export type FloatSession =
  | { mode: 'idle' }
  | { mode: 'move'; start: Vec2; before: Transform }
  | { mode: 'resize'; handle: HandleId; before: Transform }
  | { mode: 'rotate'; before: Transform; grab: number }

export interface EditorOptions {
  compositor: Compositor
  content?: ContentStore
  onChange?: () => void
}

export const DEFAULT_BRUSH: BrushParams = { size: 24, hardness: 0.6, spacing: 0.1, opacity: 1, flow: 1, color: '#ffffff' }

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
  setWarpOptions(opts: Partial<WarpToolOptions>): void
  setWandOptions(opts: Partial<WandToolOptions>): void
  wandOptions(): WandToolOptions
  modifySelection(kind: 'feather' | 'grow' | 'shrink' | 'border', radius: number): boolean
  clearSelectionPixels(): boolean
  fillSelectionPixels(colorHex: string): boolean
  strokeSelectionPixels(colorHex: string, width: number): boolean
  copySelection(): boolean
  cutSelection(): boolean
  pasteClipboard(): boolean
  hasClipboard(): boolean
  copyVisible(): boolean
  newFromVisible(): boolean
  mergeVisible(): boolean
  setGradientOptions(opts: Partial<GradientToolOptions>): void
  gradientOptions(): GradientToolOptions
  warpApply(): boolean
  warpCancel(): boolean
  warpDirty(): boolean
  penCommit(): boolean
  penCancel(): boolean
  penDrafting(): boolean
  cropRect(): Rect | null
  cropClear(): boolean
  pathToSelection(id: string, op: SelectionOp): boolean
  strokePathWithBrush(id: string): boolean
  transformApply(): boolean
  transformCancel(): boolean
  transformDirty(): boolean
  arrangeSelected(op: ArrangeOp): boolean
  setSnapGrid(size: number): void
  snapGrid(): number
  guides(): DocGuide[]
  guideAddLive(axis: 'x' | 'y', pos: number): number
  guideMoveLive(index: number, pos: number): void
  guideEndDrag(index: number, end: GuideDragEnd): void
  activeNodeId(): string | null
  setActiveNode(id: string | null): void
  selectedNodeIds(): string[]
  setSelectedNodes(ids: string[]): void
  removeNodes(ids: string[]): boolean
  pointerDown(e: PointerEvent, pt: Vec2): void
  pointerMove(e: PointerEvent, pt: Vec2): void
  pointerUp(e: PointerEvent, pt: Vec2): void
  hover(e: PointerEvent, pt: Vec2): void
  cursorAt(pt: Vec2): string
  addNode(node: SceneNode, index?: number, parentId?: string): void
  removeActive(): void
  reorder(id: string, toIndex: number): void
  moveNode(id: string, dir: 1 | -1): boolean
  moveNodeTo(id: string, parentId: string | undefined, toIndex: number): boolean
  groupActive(): boolean
  ungroupActive(): boolean
  setZoom(z: number): void
  setViewport(rect: Rect | null): void
  redraw(): void
  zoom(): number
  render(region?: Rect | null): void
  takePresentDamage(): { full: boolean; rect: Rect | null }
  buildOverlay(): void
  invalidate(): void
  undo(): void
  redo(): void
  floating(): FloatingItem | null
  startFloating(contentId: string, width: number, height: number, name?: string): void
  anchorFloating(target?: 'active' | 'new'): void
  cancelFloating(): void
  mergeDown(id: string): boolean
  rasterizeLayer(id: string): boolean
  canRasterize(id: string): boolean
  flattenImage(bgColor?: string): boolean
  flipImage(axis: 'h' | 'v'): boolean
  cropToContent(id: string): boolean
  layerToCanvasSize(id: string): boolean
  selectionBounds(): Rect | null
  setRectSelection(rect: Rect): boolean
  selectAll(): boolean
  selectNone(): boolean
  invertSelection(): boolean
  maskToSelection(id: string): boolean
  paintPreview(key: string): HTMLCanvasElement | null
  setPaintPreview(key: string, canvas: HTMLCanvasElement | null): void
}

export interface EditorState {
  doc: Document
  toolId: string
  tool: Tool | null
  selectedIds: string[]
  zoomLevel: number
  snapGridSize: number
  brush: BrushParams
  shape: ShapeToolOptions
  warp: WarpToolOptions
  wand: WandToolOptions
  gradient: GradientToolOptions
  viewport: Rect | null
  previewVersion: number
  pendingDamage: Rect | null
  presentFull: boolean
  presentRect: Rect | null
  floating: FloatingItem | null
  floatSession: FloatSession
  clipboard: SelectionClipboard | null
  selOutlineCache: { key: string; outlines: Vec2[][] } | null
}

export interface EditorEnv {
  st: EditorState
  compositor: Compositor
  content: ContentStore
  history: History
  notify: () => void
  overlay: OverlayList
  overrides: Map<string, PreviewOverride>
  mergeCache: ReturnType<typeof createMergeCache>
}
