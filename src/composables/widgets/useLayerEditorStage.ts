import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'

import { app, type LGraphNode } from '@/lib/comfyApp'
import { t } from '@/i18n'
import { uploadBlobNamed, uploadCanvas } from '@/utils/uploadCanvas'
import { onNodeConfigure, readWidgetStr, writeWidget } from '@/utils/widget'
import { ContentStore } from '@/widgets/layerEditor/ContentStore'
import { getFontStore } from '@/widgets/layerEditor/fontStore'
import { LayerHistory, type LayerHistorySnapshot } from '@/widgets/layerEditor/LayerHistory'
import { alphaMaskToLuminance, createOpaqueMask, luminanceToAlphaMask } from '@/widgets/layerEditor/maskUtils'
import { createPanZoom } from '@/widgets/layerEditor/panZoom'
import {
  exportComposited,
  exportLayerAlone,
  renderMain,
  renderOverlay,
  type RenderDeps,
} from '@/widgets/layerEditor/renderer'
import {
  cloneState,
  contentIdsInJson,
  createRasterLayer,
  createTextLayer,
  generateId,
  normalizeLayerState,
} from '@/widgets/layerEditor/stateSerde'
import { measureText, TextRenderCache } from '@/widgets/layerEditor/textRender'
import {
  createPaintTool,
  createSelectTool,
  createTextTool,
  type ToolContext,
  type ToolHandler,
} from '@/widgets/layerEditor/tools'
import type {
  BlendMode,
  Layer,
  LayerEditorState,
  TextLayer,
  ToolId,
} from '@/widgets/layerEditor/types'

const STATE_WIDGET = 'layer_state'
const WIDTH_WIDGET = 'width'
const HEIGHT_WIDGET = 'height'
const IMAGE_WIDGET = 'captured_image'
const IMAGES_WIDGET = 'captured_images'

const UPLOAD_DEBOUNCE_MS = 800
const CAPTURE_DEBOUNCE_MS = 700
const CONTENT_BYTE_BUDGET = 256 * 1024 * 1024
const MAX_CONTENT_DIM = 4096

export interface UseLayerEditorStageOptions {
  onCaptured?: (url: string) => void
  onBatchCaptured?: (json: string) => void
}

function toastError(detail: string): void {
  ;(app as any)?.extensionManager?.toast?.add?.({
    severity: 'error',
    summary: 'ComfyTV',
    detail,
    life: 5000,
  })
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`failed to load image: ${url}`))
    img.src = url
  })
}

export type LayerEditorController = ReturnType<typeof useLayerEditorStage>

export function useLayerEditorStage(node: LGraphNode, opts?: UseLayerEditorStageOptions) {
  const state = ref<LayerEditorState>(
    normalizeLayerState(readWidgetStr(node, STATE_WIDGET, '{}')),
  )
  const activeId = ref<string | null>(null)
  const tool = ref<ToolId>('select')
  const brushSize = ref(40)
  const brushOpacity = ref(1)
  const brushHardness = ref(1)
  const brushColor = ref('#ff4444')
  const paintTarget = ref<'content' | 'mask'>('content')
  const editingTextId = ref<string | null>(null)
  const capturing = ref(false)
  const historyVersion = ref(0)

  const content = new ContentStore()
  const history = new LayerHistory()
  const textCache = new TextRenderCache()
  const fontStore = getFontStore()
  const overrides = new Map<string, HTMLCanvasElement>()

  let lastCommitted: LayerHistorySnapshot = {
    json: JSON.stringify(state.value),
    selectedId: null,
  }

  const activeLayer = computed<Layer | null>(
    () => state.value.layers.find((l) => l.id === activeId.value) ?? null,
  )
  const selectedIds = computed(() => new Set(activeId.value ? [activeId.value] : []))
  const canUndo = computed(() => historyVersion.value >= 0 && history.canUndo())
  const canRedo = computed(() => historyVersion.value >= 0 && history.canRedo())

  let mainCanvas: HTMLCanvasElement | null = null
  let overlayCanvas: HTMLCanvasElement | null = null
  let viewportEl: HTMLElement | null = null
  let containerEl: HTMLElement | null = null

  const panZoom = createPanZoom(() =>
    viewportEl && containerEl ? { viewport: viewportEl, container: containerEl } : null,
  )

  const renderDeps: RenderDeps = {
    content,
    overrides,
    getTextBitmap: (layer: TextLayer) =>
      textCache.get(layer, fontStore.getFontSyncWithFallback(layer.fontRef)),
  }

  let rafId: number | null = null

  function renderNow(): void {
    rafId = null
    if (!mainCanvas || !overlayCanvas) return
    const { width, height } = state.value
    if (mainCanvas.width !== width || mainCanvas.height !== height) {
      mainCanvas.width = width
      mainCanvas.height = height
    }
    if (overlayCanvas.width !== width || overlayCanvas.height !== height) {
      overlayCanvas.width = width
      overlayCanvas.height = height
    }
    renderMain(mainCanvas.getContext('2d')!, state.value, renderDeps)
    renderOverlay(
      overlayCanvas.getContext('2d')!,
      state.value,
      { activeId: activeId.value, selectedIds: selectedIds.value },
      Math.max(0.01, panZoom.zoom()),
    )
  }

  function requestRender(): void {
    if (rafId == null) rafId = requestAnimationFrame(renderNow)
  }

  function setElements(els: {
    viewport: HTMLElement
    container: HTMLElement
    main: HTMLCanvasElement
    overlay: HTMLCanvasElement
  }): void {
    viewportEl = els.viewport
    containerEl = els.container
    mainCanvas = els.main
    overlayCanvas = els.overlay
    fitView()
  }

  function fitView(): void {
    panZoom.fit(state.value.width, state.value.height)
    requestRender()
  }

  const idsByJson = new Map<string, string[]>()

  function liveContentIds(): Set<string> {
    const jsons = [lastCommitted.json, ...history.allJson()]
    const live = new Set<string>()
    for (const json of jsons) {
      let ids = idsByJson.get(json)
      if (!ids) {
        ids = contentIdsInJson(json)
        idsByJson.set(json, ids)
      }
      for (const id of ids) live.add(id)
    }
    if (idsByJson.size > jsons.length * 2) {
      const keep = new Set(jsons)
      for (const key of idsByJson.keys()) {
        if (!keep.has(key)) idsByJson.delete(key)
      }
    }
    return live
  }

  function collectGarbage(): void {
    content.collectGarbage(liveContentIds())
    while (content.totalBytes() > CONTENT_BYTE_BUDGET && history.dropOldest(5) > 0) {
      content.collectGarbage(liveContentIds())
    }
  }

  function commit(next: LayerEditorState, mergeKey?: string): void {
    state.value = normalizeLayerState(JSON.stringify(next))
    const json = JSON.stringify(state.value)
    if (json !== lastCommitted.json) {
      history.record(lastCommitted, mergeKey)
      historyVersion.value += 1
      lastCommitted = { json, selectedId: activeId.value }
    }
    writeWidget(node, STATE_WIDGET, json, { fireCallback: false })
    writeWidget(node, WIDTH_WIDGET, state.value.width, { fireCallback: false })
    writeWidget(node, HEIGHT_WIDGET, state.value.height, { fireCallback: false })
    collectGarbage()
    scheduleUpload()
    scheduleCapture()
    requestRender()
  }
  function silentPatch(mutate: (draft: LayerEditorState) => boolean): void {
    const draft = cloneState(state.value)
    if (!mutate(draft)) return
    state.value = draft
    lastCommitted = { json: JSON.stringify(draft), selectedId: lastCommitted.selectedId }
    writeWidget(node, STATE_WIDGET, lastCommitted.json, { fireCallback: false })
    requestRender()
  }

  function restoreSnapshot(entry: LayerHistorySnapshot): void {
    state.value = normalizeLayerState(entry.json)
    const restoredId =
      entry.selectedId && state.value.layers.some((l) => l.id === entry.selectedId)
        ? entry.selectedId
        : null
    activeId.value = restoredId
    lastCommitted = { json: JSON.stringify(state.value), selectedId: restoredId }
    writeWidget(node, STATE_WIDGET, lastCommitted.json, { fireCallback: false })
    scheduleUpload()
    scheduleCapture()
    requestRender()
  }

  function undo(): void {
    const entry = history.undo(lastCommitted)
    if (!entry) return
    historyVersion.value += 1
    restoreSnapshot(entry)
  }

  function redo(): void {
    const entry = history.redo(lastCommitted)
    if (!entry) return
    historyVersion.value += 1
    restoreSnapshot(entry)
  }

  function resetHistoryBaseline(): void {
    history.clear()
    historyVersion.value += 1
    lastCommitted = { json: JSON.stringify(state.value), selectedId: activeId.value }
  }
  function syncTextMetrics(): void {
    silentPatch((draft) => {
      let changed = false
      for (const layer of draft.layers) {
        if (layer.type !== 'text') continue
        const font = fontStore.getFontSyncWithFallback(layer.fontRef)
        if (!font) continue
        const m = measureText(layer, font)
        if (Math.abs(layer.transform.w - m.w) > 0.5 || Math.abs(layer.transform.h - m.h) > 0.5) {
          layer.transform.w = m.w
          layer.transform.h = m.h
          changed = true
        }
      }
      return changed
    })
  }

  const unsubscribeFontReady = fontStore.onFontReady(() => {
    syncTextMetrics()
    scheduleCapture()
    requestRender()
  })

  let uploadTimer: number | null = null
  let uploading = false
  let uploadAgain = false

  function scheduleUpload(): void {
    if (uploadTimer != null) window.clearTimeout(uploadTimer)
    uploadTimer = window.setTimeout(() => {
      uploadTimer = null
      void uploadDirty()
    }, UPLOAD_DEBOUNCE_MS)
  }

  async function uploadDirty(): Promise<void> {
    if (uploading) {
      uploadAgain = true
      return
    }
    uploading = true
    try {
      const targets: Array<{ contentId: string; isMask: boolean }> = []
      for (const layer of state.value.layers) {
        if (layer.type === 'raster' && !layer.url) {
          targets.push({ contentId: layer.contentId, isMask: false })
        }
        if (layer.mask && !layer.mask.url) {
          targets.push({ contentId: layer.mask.contentId, isMask: true })
        }
      }
      for (const target of targets) {
        const entry = content.get(target.contentId)
        if (!entry) continue
        let url = entry.uploadedUrl
        if (!url) {
          const canvas = target.isMask ? alphaMaskToLuminance(entry.canvas) : entry.canvas
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/png'),
          )
          if (!blob) continue
          const uploaded = await uploadBlobNamed(blob, {
            subfolder: 'layer-editor',
            filename: `comfytv-layer-${String(node?.id ?? 'unknown')}-${target.contentId}.png`,
          })
          url = uploaded.url
          content.markUploaded(target.contentId, url)
        }
        const finalUrl = url
        silentPatch((draft) => {
          let changed = false
          for (const layer of draft.layers) {
            if (!target.isMask && layer.type === 'raster'
              && layer.contentId === target.contentId && layer.url !== finalUrl) {
              layer.url = finalUrl
              changed = true
            }
            if (target.isMask && layer.mask
              && layer.mask.contentId === target.contentId && layer.mask.url !== finalUrl) {
              layer.mask.url = finalUrl
              changed = true
            }
          }
          return changed
        })
      }
    } catch (e) {
      console.error('[ComfyTV/layerEditor] content upload failed', e)
      toastError(t('layerEditor.uploadFailed'))
    } finally {
      uploading = false
      if (uploadAgain) {
        uploadAgain = false
        scheduleUpload()
      }
    }
  }

  let captureTimer: number | null = null
  let captureSeq = 0
  const capturedImageUrl = shallowRef<string>(readWidgetStr(node, IMAGE_WIDGET, ''))

  function scheduleCapture(): void {
    if (captureTimer != null) window.clearTimeout(captureTimer)
    captureTimer = window.setTimeout(() => {
      captureTimer = null
      void runCapture()
    }, CAPTURE_DEBOUNCE_MS)
  }

  async function runCapture(): Promise<void> {
    if (state.value.layers.length === 0) return
    const mySeq = ++captureSeq
    try {
      const canvas = exportComposited(state.value, renderDeps, 'white')
      const url = await uploadCanvas(canvas, {
        subfolder: 'layer-editor',
        filename: `comfytv-layer-${String(node?.id ?? 'unknown')}-composite-${Date.now()}.png`,
      })
      if (mySeq !== captureSeq) return
      capturedImageUrl.value = url
      writeWidget(node, IMAGE_WIDGET, url, { fireCallback: false })
      opts?.onCaptured?.(url)
    } catch (e) {
      console.error('[ComfyTV/layerEditor] capture failed', e)
    }
  }
  async function captureBatch(): Promise<void> {
    if (capturing.value) return
    capturing.value = true
    try {
      const doc = state.value
      const stamp = Date.now()
      const nodeId = String(node?.id ?? 'unknown')

      const composite = exportComposited(doc, renderDeps, 'white')
      const compositeUrl = await uploadCanvas(composite, {
        subfolder: 'layer-editor',
        filename: `comfytv-layer-${nodeId}-composite-${stamp}.png`,
      })
      captureSeq += 1
      capturedImageUrl.value = compositeUrl
      writeWidget(node, IMAGE_WIDGET, compositeUrl, { fireCallback: false })
      opts?.onCaptured?.(compositeUrl)

      const uploads: Array<{ label: string; url: string }> = [
        { label: 'composite', url: compositeUrl },
      ]
      for (const layer of doc.layers) {
        if (!layer.visible) continue
        const alone = exportLayerAlone(doc, layer, renderDeps)
        const url = await uploadCanvas(alone, {
          subfolder: 'layer-editor',
          filename: `comfytv-layer-${nodeId}-${layer.id}-${stamp}.png`,
        })
        uploads.push({ label: layer.name, url })
      }
      const batch = JSON.stringify({
        images: uploads.map((u, index) => ({
          index: String(index + 1),
          label: u.label,
          image_url: u.url,
        })),
      })
      writeWidget(node, IMAGES_WIDGET, batch, { fireCallback: false })
      opts?.onBatchCaptured?.(batch)
    } catch (e) {
      console.error('[ComfyTV/layerEditor] batch capture failed', e)
      toastError(t('layerEditor.captureFailed'))
    } finally {
      capturing.value = false
    }
  }

  function setActiveLayer(id: string | null): void {
    activeId.value = id
    requestRender()
  }

  function fitTransformForImage(w: number, h: number) {
    const doc = state.value
    let lw = w
    let lh = h
    const maxDim = Math.max(doc.width, doc.height)
    if (lw > maxDim || lh > maxDim) {
      const ratio = Math.min(maxDim / lw, maxDim / lh)
      lw = Math.round(lw * ratio)
      lh = Math.round(lh * ratio)
    }
    return {
      x: (doc.width - lw) / 2,
      y: (doc.height - lh) / 2,
      w: lw,
      h: lh,
      rotation: 0,
    }
  }

  function contentCanvasFromImage(img: HTMLImageElement): HTMLCanvasElement {
    let w = img.naturalWidth
    let h = img.naturalHeight
    if (w > MAX_CONTENT_DIM || h > MAX_CONTENT_DIM) {
      const ratio = Math.min(MAX_CONTENT_DIM / w, MAX_CONTENT_DIM / h)
      w = Math.max(1, Math.round(w * ratio))
      h = Math.max(1, Math.round(h * ratio))
    }
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d')!.drawImage(img, 0, 0, w, h)
    return c
  }

  function addImageLayerFromElement(
    img: HTMLImageElement,
    name: string,
    sourceUrl?: string,
  ): void {
    const canvas = contentCanvasFromImage(img)
    const keepUrl =
      sourceUrl && canvas.width === img.naturalWidth && canvas.height === img.naturalHeight
        ? sourceUrl
        : undefined
    const contentId = content.register(canvas, { uploadedUrl: keepUrl })
    const layer = createRasterLayer({
      contentId,
      name,
      naturalWidth: canvas.width,
      naturalHeight: canvas.height,
      transform: fitTransformForImage(canvas.width, canvas.height),
      url: keepUrl,
    })
    const next = cloneState(state.value)
    next.layers.push(layer)
    commit(next)
    setActiveLayer(layer.id)
  }

  async function addImageFromUrl(url: string, name: string): Promise<void> {
    try {
      const img = await loadImageElement(url)
      addImageLayerFromElement(img, name, url)
    } catch (e) {
      console.error('[ComfyTV/layerEditor] failed to load image', e)
      toastError(t('layerEditor.loadImageFailed'))
    }
  }

  function addImageFromFile(file: File): void {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => addImageLayerFromElement(img, file.name)
      img.onerror = () => toastError(t('layerEditor.loadImageFailed'))
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  function removeLayer(id: string): void {
    const next = cloneState(state.value)
    const idx = next.layers.findIndex((l) => l.id === id)
    if (idx === -1) return
    next.layers.splice(idx, 1)
    textCache.drop(id)
    commit(next)
    if (activeId.value === id) {
      setActiveLayer(next.layers[Math.min(idx, next.layers.length - 1)]?.id ?? null)
    }
  }

  function moveLayer(id: string, dir: 1 | -1): void {
    const next = cloneState(state.value)
    const idx = next.layers.findIndex((l) => l.id === id)
    const target = idx + dir
    if (idx === -1 || target < 0 || target >= next.layers.length) return
    ;[next.layers[idx], next.layers[target]] = [next.layers[target], next.layers[idx]]
    commit(next)
  }

  function duplicateLayer(id: string): void {
    const src = state.value.layers.find((l) => l.id === id)
    if (!src) return
    const next = cloneState(state.value)
    const idx = next.layers.findIndex((l) => l.id === id)
    const copy = JSON.parse(JSON.stringify(src)) as Layer
    copy.id = generateId()
    copy.name = `${src.name} copy`
    copy.transform.x += 16
    copy.transform.y += 16
    next.layers.splice(idx + 1, 0, copy)
    commit(next)
    setActiveLayer(copy.id)
  }

  function patchLayer(id: string, mutate: (layer: Layer) => void, mergeKey?: string): void {
    const next = cloneState(state.value)
    const layer = next.layers.find((l) => l.id === id)
    if (!layer) return
    mutate(layer)
    commit(next, mergeKey)
  }

  const setOpacity = (id: string, v: number) =>
    patchLayer(id, (l) => { l.opacity = Math.min(1, Math.max(0, v)) }, `opacity:${id}`)
  const setBlendMode = (id: string, v: BlendMode) =>
    patchLayer(id, (l) => { l.blendMode = v })
  const toggleVisible = (id: string) =>
    patchLayer(id, (l) => { l.visible = !l.visible })
  const toggleLock = (id: string) =>
    patchLayer(id, (l) => { l.locked = !l.locked })
  const renameLayer = (id: string, name: string) =>
    patchLayer(id, (l) => { l.name = name.trim() || l.name })

  function addMask(id: string): void {
    const layer = state.value.layers.find((l) => l.id === id)
    if (!layer || layer.mask) return
    const w = layer.type === 'raster' ? layer.naturalWidth : Math.max(1, Math.round(layer.transform.w))
    const h = layer.type === 'raster' ? layer.naturalHeight : Math.max(1, Math.round(layer.transform.h))
    const contentId = content.register(createOpaqueMask(w, h))
    patchLayer(id, (l) => { l.mask = { contentId, enabled: true } })
    paintTarget.value = 'mask'
  }

  function removeMask(id: string): void {
    patchLayer(id, (l) => { delete l.mask })
    if (paintTarget.value === 'mask') paintTarget.value = 'content'
  }

  const toggleMaskEnabled = (id: string) =>
    patchLayer(id, (l) => { if (l.mask) l.mask.enabled = !l.mask.enabled })

  function updateTextLayer(id: string, patch: Partial<TextLayer>): void {
    patchLayer(id, (l) => {
      if (l.type !== 'text') return
      Object.assign(l, patch)
      const font = fontStore.getFontSyncWithFallback(l.fontRef)
      if (font) {
        const m = measureText(l, font)
        l.transform.w = m.w
        l.transform.h = m.h
      }
    }, `text:${id}`)
  }

  function addTextLayerAt(at: { x: number; y: number }): string {
    const next = cloneState(state.value)
    const layer = createTextLayer({ text: '', at })
    next.layers.push(layer)
    commit(next)
    setActiveLayer(layer.id)
    return layer.id
  }

  function setArtboardSize(w: number, h: number): void {
    const next = cloneState(state.value)
    next.width = w
    next.height = h
    commit(next)
    fitView()
  }

  function nudgeActive(dx: number, dy: number): void {
    const id = activeId.value
    if (!id) return
    patchLayer(id, (l) => {
      l.transform.x += dx
      l.transform.y += dy
    }, `nudge:${id}`)
  }

  const toolCtx: ToolContext = {
    getState: () => state.value,
    getActiveId: () => activeId.value,
    setActiveLayer,
    content,
    zoom: () => Math.max(0.01, panZoom.zoom()),
    commit: commitFromTool,
    requestRender,
    brush: () => ({
      size: brushSize.value,
      opacity: brushOpacity.value,
      hardness: brushHardness.value,
      color: brushColor.value,
    }),
    brushTool: () => (tool.value === 'eraser' ? 'eraser' : 'brush'),
    paintTarget: () => paintTarget.value,
    setOverride: (key, canvas) => {
      if (canvas) overrides.set(key, canvas)
      else overrides.delete(key)
    },
    openTextEditor: (layerId) => {
      editingTextId.value = layerId
    },
  }
  function commitFromTool(next: LayerEditorState, mergeKey?: string): void {
    if (mergeKey?.startsWith('resize:')) {
      const id = mergeKey.slice('resize:'.length)
      const nextLayer = next.layers.find((l) => l.id === id)
      const curLayer = state.value.layers.find((l) => l.id === id)
      if (nextLayer?.type === 'text' && curLayer?.type === 'text' && curLayer.transform.h > 0) {
        const scale = nextLayer.transform.h / curLayer.transform.h
        nextLayer.fontSize = Math.min(2048, Math.max(4, nextLayer.fontSize * scale))
        const font = fontStore.getFontSyncWithFallback(nextLayer.fontRef)
        if (font) {
          const m = measureText(nextLayer, font)
          nextLayer.transform.w = m.w
          nextLayer.transform.h = m.h
        }
      }
    }
    commit(next, mergeKey)
  }

  const toolHandlers: Record<ToolId, ToolHandler> = {
    select: createSelectTool(toolCtx),
    brush: createPaintTool(toolCtx),
    eraser: createPaintTool(toolCtx),
    text: createTextTool(toolCtx),
  }

  function activeToolHandler(): ToolHandler {
    return toolHandlers[tool.value]
  }

  async function hydrateContent(): Promise<void> {
    const jobs: Array<Promise<void>> = []
    for (const layer of state.value.layers) {
      if (layer.type === 'raster' && layer.url && !content.has(layer.contentId)) {
        const { contentId, url, naturalWidth, naturalHeight } = layer
        jobs.push(
          loadImageElement(url).then((img) => {
            const c = document.createElement('canvas')
            c.width = naturalWidth
            c.height = naturalHeight
            c.getContext('2d')!.drawImage(img, 0, 0, naturalWidth, naturalHeight)
            content.register(c, { id: contentId, uploadedUrl: url })
            requestRender()
          }).catch((e) => console.warn('[ComfyTV/layerEditor] layer hydrate failed', e)),
        )
      }
      if (layer.mask?.url && !content.has(layer.mask.contentId)) {
        const maskRef = layer.mask
        const w = layer.type === 'raster' ? layer.naturalWidth : Math.max(1, Math.round(layer.transform.w))
        const h = layer.type === 'raster' ? layer.naturalHeight : Math.max(1, Math.round(layer.transform.h))
        jobs.push(
          loadImageElement(maskRef.url!).then((img) => {
            const mask = luminanceToAlphaMask(img, w, h)
            content.register(mask, { id: maskRef.contentId, uploadedUrl: maskRef.url })
            requestRender()
          }).catch((e) => console.warn('[ComfyTV/layerEditor] mask hydrate failed', e)),
        )
      }
    }
    await Promise.all(jobs)
  }

  function loadFromNode(): void {
    state.value = normalizeLayerState(readWidgetStr(node, STATE_WIDGET, '{}'))
    activeId.value = null
    editingTextId.value = null
    capturedImageUrl.value = readWidgetStr(node, IMAGE_WIDGET, '')
    textCache.clear()
    resetHistoryBaseline()
    void hydrateContent()
    fitView()
    requestRender()
  }

  onNodeConfigure(node, loadFromNode)
  void hydrateContent()
  resetHistoryBaseline()

  onBeforeUnmount(() => {
    unsubscribeFontReady()
    if (rafId != null) cancelAnimationFrame(rafId)
    if (uploadTimer != null) window.clearTimeout(uploadTimer)
    if (captureTimer != null) window.clearTimeout(captureTimer)
    captureSeq += 1
  })

  return {
    state, activeId, activeLayer, selectedIds,
    tool, brushSize, brushOpacity, brushHardness, brushColor, paintTarget,
    editingTextId, capturing, capturedImageUrl,
    canUndo, canRedo,
    panZoom, setElements, fitView, requestRender,
    activeToolHandler,
    undo, redo,
    addImageFromUrl, addImageFromFile, addTextLayerAt,
    removeLayer, moveLayer, duplicateLayer,
    setActiveLayer, setOpacity, setBlendMode, toggleVisible, toggleLock, renameLayer,
    addMask, removeMask, toggleMaskEnabled, updateTextLayer,
    setArtboardSize, nudgeActive,
    captureBatch,
    content, fontStore,
  }
}
