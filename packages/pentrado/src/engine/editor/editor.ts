import { HybridContentStore } from '../impl/hybridContentStore'
import { History } from '../history'
import { getPaintCore } from '../paint'
import { createMergeCache, invalidateMergeCache, type PreviewOverride } from '../render/renderStack'
import { getTool, type ToolContext } from '../tool'
import { isCropTool } from '../tools/cropTool'
import { DEFAULT_GRADIENT_OPTIONS } from '../tools/gradientTool'
import { isPenTool } from '../tools/penTool'
import { DEFAULT_SHAPE_OPTIONS } from '../tools/shapeTool'
import { isTransformTool } from '../tools/transformTool'
import { DEFAULT_WAND_OPTIONS } from '../tools/wandTool'
import { DEFAULT_WARP_OPTIONS, isWarpTool } from '../tools/warpTool'
import { createEditorCore } from './editorCore'
import { createEditorDocument } from './editorDocument'
import { createEditorFloating } from './editorFloating'
import { createEditorSelectionOps } from './editorSelectionOps'
import { createEditorStructure } from './editorStructure'
import { DEFAULT_BRUSH, emptyDocument, type Editor, type EditorEnv, type EditorOptions, type EditorState } from './editorTypes'
import { guideAddLive, guideEndDrag, guideMoveLive } from './guideOps'
import { OverlayList } from './overlayList'
import { clearSelectedPixels, extractSelectedPixels } from './selectionEdit'

export type { Editor, EditorOptions, FloatingItem, FloatSession, EditorState, EditorEnv } from './editorTypes'
export { emptyDocument } from './editorTypes'

export function createEditor(opts: EditorOptions): Editor {
  const compositor = opts.compositor
  const content = opts.content ?? new HybridContentStore()
  const history = new History()
  const notify = opts.onChange ?? (() => {})
  const overlay = new OverlayList(() => notify())
  const st: EditorState = {
    doc: emptyDocument(1024, 1024),
    toolId: 'select',
    tool: null,
    selectedIds: [],
    zoomLevel: 1,
    snapGridSize: 0,
    brush: { ...DEFAULT_BRUSH },
    shape: { ...DEFAULT_SHAPE_OPTIONS },
    warp: { ...DEFAULT_WARP_OPTIONS },
    wand: { ...DEFAULT_WAND_OPTIONS },
    gradient: { ...DEFAULT_GRADIENT_OPTIONS },
    viewport: null,
    previewVersion: 0,
    pendingDamage: null,
    presentFull: true,
    presentRect: null,
    floating: null,
    floatSession: { mode: 'idle' },
    clipboard: null,
    selOutlineCache: null,
  }
  const overrides = new Map<string, PreviewOverride>()
  const mergeCache = createMergeCache()
  const env: EditorEnv = { st, compositor, content, history, notify, overlay, overrides, mergeCache }
  const core = createEditorCore(env)
  const {
    setPreviewOverride, render, selectionChannel, buildOverlay, refresh, liveSelectedIds, activeNodeIdOf,
    setSelected, setActive, activeRaster, currentSelectionMask, combineSelectionMask, commitSelection,
  } = core
  const fl = createEditorFloating(env, core)
  const { floatingPress, floatingMotion } = fl

  const ctx: ToolContext = {
    document: () => st.doc,
    history,
    compositor,
    content,
    overlay,
    activeNodeId: activeNodeIdOf,
    setActiveNode: setActive,
    selectedNodeIds: liveSelectedIds,
    setSelectedNodes: setSelected,
    createPaintCore: (id) => getPaintCore(id).create(),
    setPaintPreview: (key, canvas, rect) => {
      setPreviewOverride(key, canvas, rect)
    },
    selection: {
      combineShape: (label, mask, op) => {
        combineSelectionMask(label, mask, op)
      },
      currentMask: currentSelectionMask,
      none: () => {
        commitSelection('Select None', null, null)
      },
    },
    floatSelection: () => {
      const sel = selectionChannel()
      const node = activeRaster()
      const selCanvas = sel ? content.get(sel.contentId)?.canvas : null
      if (!sel?.bounds || !node || node.locks.content || !selCanvas) return false
      const clip = extractSelectedPixels(node, content, selCanvas, sel.bounds)
      if (!clip) return false
      history.beginGroup('Float Selection')
      clearSelectedPixels({ content, push: (c) => history.push(c) }, node, selCanvas)
      commitSelection('Select None', null, null)
      history.endGroup()
      st.floating = {
        contentId: content.register(clip.canvas),
        name: 'Floating Selection',
        transform: { x: clip.bounds.x, y: clip.bounds.y, w: clip.bounds.w, h: clip.bounds.h, rotation: 0 },
      }
      st.floatSession = { mode: 'idle' }
      refresh()
      return true
    },
    compositePixels: () => {
      render()
      const img = compositor.readback()
      if (img.width !== st.doc.width || img.height !== st.doc.height) return null
      return img
    },
    zoom: () => st.zoomLevel,
    snapGrid: () => st.snapGridSize,
    requestRender: refresh,
    options: <T,>() =>
      (st.toolId === 'shape' || st.toolId === 'pen'
        ? st.shape
        : st.toolId === 'warp'
          ? st.warp
          : st.toolId === 'wand' || st.toolId === 'bucket'
            ? { ...st.wand, color: st.brush.color }
            : st.toolId === 'gradient'
              ? { ...st.gradient, color: st.gradient.color || st.brush.color }
              : st.brush) as unknown as T,
  }

  function makeTool(): void {
    st.tool?.onDeactivate?.()
    st.tool = getTool(st.toolId).create(ctx)
    st.tool.onActivate?.()
  }
  makeTool()

  return {
    history,
    content,
    overlay,
    document: () => st.doc,
    ...createEditorDocument(env, core),
    setTool(id) {
      st.toolId = id
      makeTool()
      buildOverlay()
      notify()
    },
    activeToolId: () => st.toolId,
    setBrush(params) {
      st.brush = { ...st.brush, ...params }
    },
    brushParams: () => ({ ...st.brush }),
    setShapeOptions(opts) {
      st.shape = { ...st.shape, ...opts }
    },
    shapeOptions: () => ({ ...st.shape }),
    setWarpOptions(opts) {
      st.warp = { ...st.warp, ...opts }
      if (isWarpTool(st.tool)) st.tool.optionsChanged()
    },
    setGradientOptions(opts) {
      st.gradient = { ...st.gradient, ...opts }
    },
    gradientOptions: () => ({ ...st.gradient }),
    setWandOptions(opts) {
      st.wand = { ...st.wand, ...opts }
    },
    wandOptions: () => ({ ...st.wand }),
    warpApply: () => (isWarpTool(st.tool) ? st.tool.apply() : false),
    warpCancel: () => (isWarpTool(st.tool) ? st.tool.cancel() : false),
    warpDirty: () => (isWarpTool(st.tool) ? st.tool.isDirty() : false),
    penCommit: () => (isPenTool(st.tool) ? st.tool.commit() : false),
    penCancel: () => (isPenTool(st.tool) ? st.tool.cancel() : false),
    penDrafting: () => (isPenTool(st.tool) ? st.tool.isDrafting() : false),
    cropRect: () => (isCropTool(st.tool) ? st.tool.cropRect() : null),
    cropClear: () => {
      if (!isCropTool(st.tool)) return false
      st.tool.clear()
      return true
    },
    transformApply: () => (isTransformTool(st.tool) ? st.tool.apply() : false),
    transformCancel: () => (isTransformTool(st.tool) ? st.tool.cancel() : false),
    transformDirty: () => (isTransformTool(st.tool) ? st.tool.isDirty() : false),
    activeNodeId: activeNodeIdOf,
    setActiveNode: setActive,
    selectedNodeIds: liveSelectedIds,
    setSelectedNodes: setSelected,
    pointerDown(e, pt) {
      if (st.floating) {
        floatingPress(pt)
        return
      }
      st.tool?.onButtonPress(e, pt)
    },
    pointerMove(e, pt) {
      if (st.floating) {
        floatingMotion(e, pt)
        return
      }
      st.tool?.onMotion(e, pt)
    },
    pointerUp(e, pt) {
      if (st.floating) {
        st.floatSession = { mode: 'idle' }
        return
      }
      st.tool?.onButtonRelease(e, pt)
    },
    hover(e, pt) {
      if (st.floating) return
      st.tool?.onHover(e, pt)
    },
    cursorAt(pt) {
      if (st.floating) return 'default'
      return st.tool?.cursorFor(pt) ?? 'default'
    },
    setViewport(rect) {
      st.viewport = rect ? { ...rect } : null
    },
    redraw() {
      refresh()
    },
    setZoom(z) {
      st.zoomLevel = z
    },
    zoom: () => st.zoomLevel,
    setSnapGrid(size: number) {
      st.snapGridSize = Math.max(0, size || 0)
      refresh()
    },
    snapGrid: () => st.snapGridSize,
    guides: () => (st.doc.guides ?? []).map((g) => ({ ...g })),
    guideAddLive(axis, pos) {
      const idx = guideAddLive(st.doc, axis, pos)
      buildOverlay()
      notify()
      return idx
    },
    guideMoveLive(index, pos) {
      guideMoveLive(st.doc, index, pos)
      buildOverlay()
      notify()
    },
    guideEndDrag(index, end) {
      guideEndDrag(st.doc, history, index, end)
      refresh()
    },
    render,
    takePresentDamage() {
      const dmg = { full: st.presentFull, rect: st.presentRect }
      st.presentFull = false
      st.presentRect = null
      return dmg
    },
    buildOverlay,
    invalidate() {
      invalidateMergeCache(mergeCache, compositor)
      refresh()
    },
    undo() {
      history.undo()
      refresh()
    },
    redo() {
      history.redo()
      refresh()
    },
    paintPreview(key) {
      return overrides.get(key)?.canvas ?? null
    },
    setPaintPreview(key, canvas) {
      setPreviewOverride(key, canvas)
    },
    ...createEditorSelectionOps(env, core, fl.anchorFloatingImpl),
    ...createEditorStructure(env, core, fl.anchorFloatingImpl),
    ...fl.api,
  }
}
