import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'

import { startPressureSampler } from '../engine/impl/memoryPressure'
import type { ArrangeOp } from '../engine'
import { resolvePentradoHost, type PentradoHost } from '../host'
import { getFontStore } from '../fontStore'
import { createPanZoom } from '../panZoom'
import type { LayerRow, ToolId } from '../types'
import {
  canTransformNode,
  createEditor,
  createSwapClient,
  createWebGLCompositor,
  defaultMode,
  findNode,
  generateId,
  HybridContentStore,
  LAYER_MODES,
  registerBuiltinKinds,
  registerBuiltinTools,
  type BlendFn,
  type GroupData,
  type SceneNode,
  type ShapeKind,
} from '../engine'
import { createStageArtboard } from './stage/stageArtboard'
import { createStageCapture } from './stage/stageCapture'
import type { StageCtx } from './stage/stageContext'
import { createStageFilters } from './stage/stageFilters'
import { createStageImport } from './stage/stageImport'
import { createStageLayerProps } from './stage/stageLayerProps'
import { createStageLayerStructure } from './stage/stageLayerStructure'
import { createStageMasks } from './stage/stageMasks'
import { createStagePsd } from './stage/stagePsd'
import { createStageTools } from './stage/stageTools'
import { createStageView } from './stage/stageView'

export type { MaskInit } from './stage/stageMasks'

const legacyBlend = (m: unknown): BlendFn => {
  const b = m === 'source-over' ? 'normal' : m
  return typeof b === 'string' && b in LAYER_MODES ? (b as BlendFn) : 'normal'
}

function migrateState(raw: string): unknown {
  let obj: unknown
  try {
    obj = JSON.parse(raw || '{}')
  } catch {
    return {}
  }
  if (!obj || typeof obj !== 'object') return {}
  const o = obj as Record<string, unknown>
  if (!Array.isArray(o.layers)) return obj

  const migrateMask = (m: unknown) => {
    const v = m as { contentId?: string; url?: string; enabled?: boolean } | undefined
    if (!v?.contentId) return undefined
    return { id: generateId('mask'), role: 'mask', contentId: v.contentId, url: v.url, enabled: v.enabled !== false }
  }
  const children = (o.layers as Array<Record<string, unknown>>).map((l) => {
    const base = {
      id: l.id,
      name: l.name,
      visible: l.visible !== false,
      opacity: l.opacity,
      mode: defaultMode(legacyBlend(l.blendMode)),
      transform: l.transform,
      locks: { content: l.locked === true, position: false, visibility: false },
      mask: migrateMask(l.mask),
    }
    if (l.type === 'text') {
      return {
        ...base, kind: 'text', text: l.text, fontRef: l.fontRef, fontSize: l.fontSize,
        color: l.color, letterSpacing: l.letterSpacing, lineHeight: l.lineHeight, align: l.align,
      }
    }
    return {
      ...base, kind: 'raster', contentId: l.contentId, url: l.url,
      naturalWidth: l.naturalWidth, naturalHeight: l.naturalHeight,
    }
  })
  return { width: o.width, height: o.height, root: { kind: 'group', children } }
}

export interface LayerEditorStorage {
  subfolder: string
  readState(): string
  writeState(json: string, width: number, height: number): void
  readCapturedImage(): string
  beginCapture(): (url: string, stale: boolean) => void
  commitBatch(json: string): void
}

export interface UseLayerEditorStageOptions {
  storage: LayerEditorStorage
  instanceId?: string | number
  host?: PentradoHost
  onCaptured?: (url: string) => void
  onBatchCaptured?: (json: string) => void
}

export type LayerEditorController = ReturnType<typeof useLayerEditorStage>

export function useLayerEditorStage(opts: UseLayerEditorStageOptions) {
  registerBuiltinKinds()
  registerBuiltinTools()

  const host = resolvePentradoHost(opts.host)
  const { t, notify } = host
  const toastError = (detail: string): void => notify('error', detail)
  const toastInfo = (detail: string): void => notify('success', detail)
  const storage = opts.storage
  const instanceId = opts.instanceId ?? generateId('pentrado')
  const version = ref(0)
  const tool = ref<ToolId>('select')
  const brushSize = ref(40)
  const brushOpacity = ref(1)
  const brushHardness = ref(1)
  const brushColor = ref('#ff4444')
  const backgroundColor = ref('#ffffff')
  const paintTarget = ref<'content' | 'mask'>('content')
  const shapeKind = ref<ShapeKind>('rect')
  const shapeFillEnabled = ref(true)
  const shapeFillColor = ref('#3b82f6')
  const shapeStrokeEnabled = ref(false)
  const shapeStrokeColor = ref('#ffffff')
  const shapeStrokeWidth = ref(4)
  const shapeCombine = ref(false)
  const shapeSides = ref(6)
  const shapeStarRatio = ref(0.5)
  const shapeTurns = ref(3)
  const warpPoints = ref(4)
  const wandThreshold = ref(0.06)
  const wandAntialias = ref(true)
  const wandContiguous = ref(true)
  const selectionRadius = ref(10)
  const symmetryMode = ref<'none' | 'mirror-h' | 'mirror-v' | 'mirror-both' | 'mandala'>('none')
  const symmetrySectors = ref(6)
  const gradientShape = ref<'linear' | 'radial'>('linear')
  const gradientToTransparent = ref(false)
  const gradientReverse = ref(false)

  function swapColors(): void {
    const fg = brushColor.value
    brushColor.value = backgroundColor.value
    backgroundColor.value = fg
  }
  function resetColors(): void {
    brushColor.value = '#000000'
    backgroundColor.value = '#ffffff'
  }
  const editingTextId = ref<string | null>(null)
  const maskView = ref(false)
  const capturing = ref(false)
  const exportingPsd = ref(false)
  const importingPsd = ref(false)
  const capturedImageUrl = shallowRef<string>(storage.readCapturedImage())
  const activeId = ref<string | null>(null)
  const glOk = ref(true)

  const fontStore = getFontStore(host.fontManifestUrl)

  let onContextRestored: (() => void) | null = null
  const compositor = createWebGLCompositor()
  glOk.value = compositor.init({
    width: 1024,
    height: 1024,
    onContextRestored: () => onContextRestored?.(),
  })
  const ctx = {} as StageCtx
  const editor = createEditor({ compositor, onChange: () => ctx.onChange() })
  const suspended = ref(false)
  const invalidateIfAwake = () => {
    if (!suspended.value) editor.invalidate()
  }
  onContextRestored = invalidateIfAwake
  function redrawIfAwake(): void {
    if (!suspended.value) editor.redraw()
  }

  const swapClient = createSwapClient()
  let stopPressureSampler: (() => void) | null = null
  if (swapClient && editor.content instanceof HybridContentStore) {
    editor.content.configureSwap({ swap: swapClient, onRestored: redrawIfAwake })
    stopPressureSampler = startPressureSampler()
  }

  let viewportEl: HTMLElement | null = null
  let containerEl: HTMLElement | null = null
  const panZoom = createPanZoom(() =>
    viewportEl && containerEl ? { viewport: viewportEl, container: containerEl } : null
  )

  function flattenRows(nodes: SceneNode[], depth: number, parentId: string | undefined, out: LayerRow[]): void {
    for (const n of nodes) {
      out.push({ node: n, depth, parentId })
      if (n.kind === 'group') flattenRows((n as GroupData).children, depth + 1, n.id, out)
    }
  }
  const layers = computed<LayerRow[]>(() => {
    void version.value
    const out: LayerRow[] = []
    flattenRows(editor.document().root.children, 0, undefined, out)
    return out
  })
  const canvasSize = computed(() => {
    void version.value
    const d = editor.document()
    return { width: d.width, height: d.height }
  })
  const activeNode = computed<SceneNode | null>(() => {
    void version.value
    return activeId.value ? engineNode(activeId.value) : null
  })
  const floating = computed(() => {
    void version.value
    return editor.floating()
  })
  const selectedIdList = computed(() => {
    void version.value
    return editor.selectedNodeIds()
  })
  const selectedIds = computed(() => new Set(selectedIdList.value))
  const canUndo = computed(() => version.value >= 0 && editor.history.canUndo())
  const canRedo = computed(() => version.value >= 0 && editor.history.canRedo())

  const content = editor.content
  const engineNode = (id: string): SceneNode | null => findNode(editor.document().root, id)?.node ?? null

  Object.assign(ctx, {
    opts, host, t, toastError, toastInfo, storage, instanceId, editor, content, compositor, fontStore, panZoom,
    version, activeId, glOk, suspended, capturing, exportingPsd, importingPsd, editingTextId, maskView, paintTarget, capturedImageUrl,
    tool, brushSize, brushOpacity, brushHardness, brushColor, backgroundColor,
    shapeKind, shapeFillEnabled, shapeFillColor, shapeStrokeEnabled, shapeStrokeColor, shapeStrokeWidth, shapeCombine,
    shapeSides, shapeStarRatio, shapeTurns, warpPoints, wandThreshold, wandAntialias, wandContiguous,
    symmetryMode, symmetrySectors, gradientShape, gradientToTransparent, gradientReverse,
    engineNode, invalidateIfAwake, stopPressureSampler,
  })

  const view = createStageView(ctx)
  Object.assign(ctx, { requestRender: view.requestRender, fitView: view.fitView, mainCanvas: view.mainCanvas, pickColorAt: view.pickColorAt })
  const capture = createStageCapture(ctx)
  Object.assign(ctx, {
    onChange: capture.onChange, scheduleUpload: capture.scheduleUpload, scheduleCapture: capture.scheduleCapture,
    flattenComposite: capture.flattenComposite, readbackCanvas: capture.readbackCanvas,
  })
  const props = createStageLayerProps(ctx)
  Object.assign(ctx, { editProp: props.editProp, selectionTargets: props.selectionTargets, batch: props.batch })
  const structure = createStageLayerStructure(ctx)
  Object.assign(ctx, { setLayerTransform: structure.setLayerTransform })
  const masks = createStageMasks(ctx)
  const tools = createStageTools(ctx)
  Object.assign(ctx, { syncEngineTool: tools.syncEngineTool })
  const imp = createStageImport(ctx)
  Object.assign(ctx, { addEmptyLayer: imp.addEmptyLayer, addTextLayerAt: imp.addTextLayerAt, addImageFromUrl: imp.addImageFromUrl })
  const artboard = createStageArtboard(ctx)
  Object.assign(ctx, { setArtboardSize: artboard.setArtboardSize })
  const psd = createStagePsd(ctx)
  const filters = createStageFilters(ctx)

  function setElements(els: { viewport: HTMLElement; container: HTMLElement; main: HTMLCanvasElement; overlay: HTMLCanvasElement }): void {
    viewportEl = els.viewport
    containerEl = els.container
    view.setElements(els)
  }
  function loadDocument(): void {
    capture.setPersisted(null)
    editor.loadJSON(migrateState(storage.readState()))
    capture.setPersisted(JSON.stringify(editor.serialize()))
    if (glOk.value) compositor.resize(editor.document().width, editor.document().height)
  }
  function loadFromStorage(): void {
    loadDocument()
    editingTextId.value = null
    capturedImageUrl.value = storage.readCapturedImage()
    void imp.hydrate()
    view.fitView()
  }

  loadDocument()
  void imp.hydrate()
  const unsubscribeFontReady = fontStore.onFontReady(invalidateIfAwake)

  onBeforeUnmount(() => {
    capture.flushPersist()
    view.dispose()
    swapClient?.dispose()
    unsubscribeFontReady()
    capture.dispose()
    compositor.dispose()
    content.dispose?.()
  })

  const withAllResident = <A extends unknown[], R>(fn: (...a: A) => R) =>
    async (...a: A): Promise<Awaited<R>> => {
      await editor.content.restoreAll?.()
      return await fn(...a)
    }

  return {
    layers, canvasSize, activeId, activeNode, selectedIds, selectedIdList,
    tool, brushSize, brushOpacity, brushHardness, brushColor, paintTarget,
    shapeKind, shapeFillEnabled, shapeFillColor, shapeStrokeEnabled, shapeStrokeColor, shapeStrokeWidth, shapeCombine,
    shapeSides, shapeStarRatio, shapeTurns,
    symmetryMode, symmetrySectors,
    gradientShape, gradientToTransparent, gradientReverse,
    backgroundColor, swapColors, resetColors,
    pickColorAt: view.pickColorAt,
    copyVisible: withAllResident(() => editor.copyVisible()),
    newFromVisible: withAllResident(() => editor.newFromVisible()),
    mergeVisible: withAllResident(() => editor.mergeVisible()),
    lastFilter: filters.lastFilter, repeatLastFilter: filters.repeatLastFilter,
    pathToSelection: imp.pathToSelection, strokePathBrush: imp.strokePathBrush, textToPath: imp.textToPath,
    penCommit: () => editor.penCommit(),
    penCancel: () => editor.penCancel(),
    penDrafting: () => editor.penDrafting(),
    applyCrop: withAllResident(artboard.applyCrop),
    cancelCrop: () => editor.cropClear(),
    cropPending: computed(() => {
      void version.value
      return editor.cropRect() != null
    }),
    editingTextId, capturing, capturedImageUrl,
    canUndo, canRedo,
    panZoom, setElements, fitView: view.fitView, requestRender: view.requestRender, requestOverlayRender: view.requestOverlayRender,
    activeToolHandler: tools.activeToolHandler,
    undo: structure.undo, redo: structure.redo,
    addImageFromUrl: imp.addImageFromUrl, addImageFromFile: imp.addImageFromFile, addTextLayerAt: imp.addTextLayerAt,
    removeLayer: structure.removeLayer, moveLayer: structure.moveLayer, moveLayerRelative: structure.moveLayerRelative, duplicateLayer: structure.duplicateLayer,
    groupActiveLayer: structure.groupActiveLayer, ungroupActiveLayer: structure.ungroupActiveLayer,
    toggleClipMask: props.toggleClipMask, canClipMask: props.canClipMask,
    setActiveLayer: props.setActiveLayer, setSelectedLayers: props.setSelectedLayers, setOpacity: props.setOpacity, setBlendMode: props.setBlendMode,
    toggleVisible: props.toggleVisible, toggleLock: props.toggleLock, renameLayer: props.renameLayer,
    addMask: masks.addMask, removeMask: masks.removeMask, toggleMaskEnabled: masks.toggleMaskEnabled, invertMask: masks.invertMask,
    applyMask: withAllResident(masks.applyMask), maskToSelection: masks.maskToSelection, maskView,
    hasSelection: () => editor.selectionBounds() != null,
    warpPoints,
    warpDirty: computed(() => {
      void version.value
      return editor.warpDirty()
    }),
    warpApply: () => { editor.warpApply() },
    warpCancel: () => { editor.warpCancel() },
    transformDirty: computed(() => {
      void version.value
      return editor.transformDirty()
    }),
    transformApply: () => { editor.transformApply() },
    transformCancel: () => { editor.transformCancel() },
    arrangeSelected: (op: ArrangeOp) => { editor.arrangeSelected(op) },
    snapGridSize: computed(() => {
      void version.value
      return editor.snapGrid()
    }),
    setSnapGrid: (size: number) => { editor.setSnapGrid(size) },
    guides: () => editor.guides(),
    guideAddLive: (axis: 'x' | 'y', pos: number) => editor.guideAddLive(axis, pos),
    guideMoveLive: (index: number, pos: number) => { editor.guideMoveLive(index, pos) },
    guideEndDrag: (index: number, end: { added: boolean; beforePos?: number; keep: boolean }) => {
      editor.guideEndDrag(index, end)
    },
    canTransformActive: () => canTransformNode(activeNode.value),
    startTransform: () => {
      if (canTransformNode(activeNode.value)) tool.value = 'transform'
    },
    filterSession: filters.filterSession, startFilter: filters.startFilter, updateFilterParam: filters.updateFilterParam,
    applyFilter: filters.applyFilter, cancelFilter: filters.cancelFilter,
    updateTextLayer: props.updateTextLayer,
    setArtboardSize: artboard.setArtboardSize, nudgeActive: structure.nudgeActive,
    captureBatch: capture.captureBatch, flushCapture: capture.flushCapture, cancelPendingCapture: capture.cancelPendingCapture,
    flushPersist: capture.flushPersist, reload: loadFromStorage,
    beginInteraction: capture.beginInteraction, endInteraction: capture.endInteraction,
    exportPsd: withAllResident(psd.exportPsd), exportPsdToLibrary: withAllResident(psd.exportPsdToLibrary),
    canExportToLibrary: psd.canExportToLibrary, importPsdFile: psd.importPsdFile, importPsdFromUrl: psd.importPsdFromUrl,
    addMedia: psd.addMedia, exportingPsd, importingPsd,
    documentIsEmpty: () => editor.document().root.children.length === 0,
    addEmptyLayer: imp.addEmptyLayer, floating, anchorFloating: structure.anchorFloating, cancelFloating: structure.cancelFloating,
    mergeDown: withAllResident(structure.mergeDown), flattenImage: withAllResident(structure.flattenImage),
    flipImage: withAllResident(structure.flipImage), cropToContent: withAllResident(structure.cropToContent),
    layerToCanvasSize: withAllResident(structure.layerToCanvasSize), toggleLockAlpha: props.toggleLockAlpha,
    rasterizeLayer: withAllResident(structure.rasterizeLayer),
    canRasterize: (id: string) => editor.canRasterize(id),
    setLayerFx: props.setLayerFx,
    toggleLockPosition: props.toggleLockPosition, toggleLockAll: props.toggleLockAll,
    selectAll: structure.selectAll, selectNone: structure.selectNone, invertSelection: structure.invertSelection,
    wandThreshold, wandAntialias, wandContiguous, selectionRadius,
    modifySelection: (kind: 'feather' | 'grow' | 'shrink' | 'border') => {
      editor.modifySelection(kind, selectionRadius.value)
    },
    clearSelectionPixels: () => { editor.clearSelectionPixels() },
    fillSelection: () => { editor.fillSelectionPixels(brushColor.value) },
    strokeSelection: () => { editor.strokeSelectionPixels(brushColor.value, Math.max(1, shapeStrokeWidth.value)) },
    cutSelection: () => { editor.cutSelection() },
    copySelection: () => { editor.copySelection() },
    pasteClipboard: () => { editor.pasteClipboard() },
    addAdjustmentLayer: props.addAdjustmentLayer, updateAdjustment: props.updateAdjustment, updateVectorStyle: props.updateVectorStyle,
    addFillLayer: props.addFillLayer, updateFillLayer: props.updateFillLayer,
    content, fontStore, host, suspended,
    document: () => editor.document(),
    setLayerTransform: structure.setLayerTransform, selectRect: structure.selectRect, withHistoryGroup: structure.withHistoryGroup,
    captureNow: capture.captureNow,
    glStats: () => compositor.debugStats?.() ?? null,
  }
}
