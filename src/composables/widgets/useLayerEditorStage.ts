import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'

import { app, type LGraphNode } from '@/lib/comfyApp'
import { t } from '@/i18n'
import { uploadBlobNamed, uploadCanvas } from '@/utils/uploadCanvas'
import { onNodeConfigure, readWidgetStr, writeWidget } from '@/utils/widget'
import { getFontStore } from '@/widgets/layerEditor/fontStore'
import { createPanZoom } from '@/widgets/layerEditor/panZoom'
import { measureText, type TextStyle } from '@/widgets/layerEditor/textRender'
import type { BlendMode, Layer, LayerEditorState, TextLayer, ToolHandler, ToolId } from '@/widgets/layerEditor/types'
import {
  Dirty,
  LAYER_MODES,
  PropCommand,
  createEditor,
  createWebGLCompositor,
  defaultMode,
  findNode,
  generateId,
  getNodeKind,
  insideBox,
  pendingUploads,
  rasterKind,
  registerBuiltinKinds,
  registerBuiltinTools,
  textKind,
  type BlendFn,
  type CanvasItem,
  type RasterData,
  type SceneNode,
  type TextData,
} from '@/widgets/layerEditor/engine'

const STATE_WIDGET = 'layer_state'
const WIDTH_WIDGET = 'width'
const HEIGHT_WIDGET = 'height'
const IMAGE_WIDGET = 'captured_image'
const IMAGES_WIDGET = 'captured_images'

const UPLOAD_DEBOUNCE_MS = 800
const CAPTURE_DEBOUNCE_MS = 700
const MAX_CONTENT_DIM = 4096
const SUBFOLDER = 'comfytv/layer-editor'

const V1_BLENDS = new Set<string>([
  'source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion',
])
const engineToV1Blend = (b: BlendFn): BlendMode => {
  const m = b === 'normal' ? 'source-over' : b
  return (V1_BLENDS.has(m) ? m : 'source-over') as BlendMode
}
const v1ToEngineBlend = (m: BlendMode): BlendFn => {
  const b = m === 'source-over' ? 'normal' : m
  return (b in LAYER_MODES ? b : 'normal') as BlendFn
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
      mode: defaultMode(v1ToEngineBlend((l.blendMode as BlendMode) ?? 'source-over')),
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

export interface UseLayerEditorStageOptions {
  onCaptured?: (url: string) => void
  onBatchCaptured?: (json: string) => void
}

function toastError(detail: string): void {
  ;(app as any)?.extensionManager?.toast?.add?.({ severity: 'error', summary: 'ComfyTV', detail, life: 5000 })
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

function newCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}
function canvasToBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob null'))), 'image/png'))
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

export type LayerEditorController = ReturnType<typeof useLayerEditorStage>

export function useLayerEditorStage(node: LGraphNode, opts?: UseLayerEditorStageOptions) {
  registerBuiltinKinds()
  registerBuiltinTools()

  const version = ref(0)
  const tool = ref<ToolId>('select')
  const brushSize = ref(40)
  const brushOpacity = ref(1)
  const brushHardness = ref(1)
  const brushColor = ref('#ff4444')
  const paintTarget = ref<'content' | 'mask'>('content')
  const editingTextId = ref<string | null>(null)
  const capturing = ref(false)
  const capturedImageUrl = shallowRef<string>(readWidgetStr(node, IMAGE_WIDGET, ''))
  const activeId = ref<string | null>(null)
  const glOk = ref(true)

  const fontStore = getFontStore()

  const compositor = createWebGLCompositor()
  glOk.value = compositor.init({ width: 1024, height: 1024 })
  const editor = createEditor({ compositor, onChange })

  let lastPersisted: string | null = null

  let mainCanvas: HTMLCanvasElement | null = null
  let overlayCanvas: HTMLCanvasElement | null = null
  let viewportEl: HTMLElement | null = null
  let containerEl: HTMLElement | null = null
  const panZoom = createPanZoom(() =>
    viewportEl && containerEl ? { viewport: viewportEl, container: containerEl } : null
  )

  function nodeToLayer(n: SceneNode): Layer {
    const base = {
      id: n.id, name: n.name, visible: n.visible, locked: n.locks.content,
      opacity: n.opacity, blendMode: engineToV1Blend(n.mode.blend),
      transform: { ...n.transform },
      mask: n.mask ? { contentId: n.mask.contentId, url: n.mask.url, enabled: n.mask.enabled } : undefined,
    }
    if (n.kind === 'text') {
      const tx = n as TextData
      return { ...base, type: 'text', text: tx.text, fontRef: tx.fontRef, fontSize: tx.fontSize, color: tx.color, letterSpacing: tx.letterSpacing, lineHeight: tx.lineHeight, align: tx.align } as TextLayer
    }
    const r = n as RasterData
    return { ...base, type: 'raster', contentId: r.contentId ?? '', url: r.url, naturalWidth: r.naturalWidth ?? Math.round(n.transform.w), naturalHeight: r.naturalHeight ?? Math.round(n.transform.h) } as Layer
  }
  function toV1State(): LayerEditorState {
    const d = editor.document()
    return { version: 1, width: d.width, height: d.height, layers: d.root.children.map(nodeToLayer) }
  }

  const state = shallowRef<LayerEditorState>(toV1State())
  const activeLayer = computed<Layer | null>(() => state.value.layers.find((l) => l.id === activeId.value) ?? null)
  const selectedIds = computed(() => new Set(activeId.value ? [activeId.value] : []))
  const canUndo = computed(() => version.value >= 0 && editor.history.canUndo())
  const canRedo = computed(() => version.value >= 0 && editor.history.canRedo())

  const content = editor.content
  const engineNode = (id: string): SceneNode | null => findNode(editor.document().root, id)?.node ?? null

  let rafId: number | null = null
  function present(): void {
    if (!mainCanvas) return
    const { width, height } = editor.document()
    if (mainCanvas.width !== width) mainCanvas.width = width
    if (mainCanvas.height !== height) mainCanvas.height = height
    const ctx = mainCanvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    if (glOk.value) {
      editor.setZoom(Math.max(0.01, panZoom.zoom()))
      editor.render()
      ctx.putImageData(compositor.readback(), 0, 0)
    }
  }
  function drawOverlayCanvas(): void {
    if (!overlayCanvas) return
    const { width, height } = editor.document()
    if (overlayCanvas.width !== width) overlayCanvas.width = width
    if (overlayCanvas.height !== height) overlayCanvas.height = height
    editor.buildOverlay()
    const ctx = overlayCanvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    const z = Math.max(0.01, panZoom.zoom())
    ctx.lineWidth = 1 / z
    ctx.strokeStyle = '#3b82f6'
    ctx.fillStyle = '#ffffff'
    const hs = 4 / z
    for (const item of editor.overlay.items) drawItem(ctx, item, hs)
  }
  function drawItem(ctx: CanvasRenderingContext2D, item: CanvasItem, hs: number): void {
    switch (item.type) {
      case 'handle':
        ctx.beginPath()
        if (item.shape === 'circle') ctx.arc(item.pos.x, item.pos.y, hs, 0, Math.PI * 2)
        else ctx.rect(item.pos.x - hs, item.pos.y - hs, hs * 2, hs * 2)
        ctx.fill()
        ctx.stroke()
        break
      case 'line':
        ctx.beginPath(); ctx.moveTo(item.a.x, item.a.y); ctx.lineTo(item.b.x, item.b.y); ctx.stroke()
        break
      case 'polyline':
        ctx.beginPath()
        item.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
        if (item.closed) ctx.closePath()
        ctx.stroke()
        break
      case 'arc':
        ctx.beginPath(); ctx.arc(item.center.x, item.center.y, item.radius, 0, Math.PI * 2); ctx.stroke()
        break
      case 'rect':
        ctx.strokeRect(item.rect.x, item.rect.y, item.rect.w, item.rect.h)
        break
      case 'preview':
        ctx.drawImage(item.canvas, item.rect.x, item.rect.y, item.rect.w, item.rect.h)
        break
    }
  }
  function requestRender(): void {
    if (rafId == null) rafId = requestAnimationFrame(() => { rafId = null; present(); drawOverlayCanvas() })
  }

  function setElements(els: { viewport: HTMLElement; container: HTMLElement; main: HTMLCanvasElement; overlay: HTMLCanvasElement }): void {
    viewportEl = els.viewport
    containerEl = els.container
    mainCanvas = els.main
    overlayCanvas = els.overlay
    fitView()
  }
  function fitView(): void {
    panZoom.fit(editor.document().width, editor.document().height)
    requestRender()
  }

  function persistRaw(json: string): void {
    lastPersisted = json
    writeWidget(node, STATE_WIDGET, json, { fireCallback: false })
    writeWidget(node, WIDTH_WIDGET, editor.document().width, { fireCallback: false })
    writeWidget(node, HEIGHT_WIDGET, editor.document().height, { fireCallback: false })
  }
  function persist(): void {
    persistRaw(JSON.stringify(editor.serialize()))
  }

  let uploadTimer: number | null = null
  let uploading = false
  let uploadAgain = false
  function scheduleUpload(): void {
    if (uploadTimer != null) window.clearTimeout(uploadTimer)
    uploadTimer = window.setTimeout(uploadDirty, UPLOAD_DEBOUNCE_MS)
  }
  async function uploadDirty(): Promise<void> {
    if (uploading) { uploadAgain = true; return }
    uploading = true
    try {
      const jobs = pendingUploads(editor.document(), content)
      for (const job of jobs) {
        const blob = await canvasToBlob(job.canvas)
        const res = await uploadBlobNamed(blob, { subfolder: SUBFOLDER, filename: `comfytv-layer-${node.id}-${job.contentId}.png` })
        job.commitUrl(res.url)
        content.markUploaded(job.contentId, res.url)
      }
      if (jobs.length) persist()
    } catch {
      toastError(t('layerEditor.uploadFailed'))
    } finally {
      uploading = false
      if (uploadAgain) { uploadAgain = false; scheduleUpload() }
    }
  }

  function flattenComposite(): HTMLCanvasElement {
    const img = compositor.readback()
    const tmp = newCanvas(img.width, img.height)
    tmp.getContext('2d')!.putImageData(img, 0, 0)
    const out = newCanvas(img.width, img.height)
    const g = out.getContext('2d')!
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, img.width, img.height)
    g.drawImage(tmp, 0, 0)
    return out
  }

  let captureTimer: number | null = null
  let captureSeq = 0
  function scheduleCapture(): void {
    if (captureTimer != null) window.clearTimeout(captureTimer)
    captureTimer = window.setTimeout(runCapture, CAPTURE_DEBOUNCE_MS)
  }
  async function runCapture(): Promise<void> {
    if (!glOk.value) return
    const seq = ++captureSeq
    try {
      editor.render()
      const url = await uploadCanvas(flattenComposite(), { subfolder: SUBFOLDER, filenamePrefix: `comfytv-cap-${node.id}` })
      if (seq !== captureSeq) return
      capturedImageUrl.value = url
      writeWidget(node, IMAGE_WIDGET, url, { fireCallback: false })
      opts?.onCaptured?.(url)
    } catch {
      toastError(t('layerEditor.captureFailed'))
    }
  }

  async function captureBatch(): Promise<void> {
    if (!glOk.value) return
    capturing.value = true
    try {
      editor.render()
      const compositeUrl = await uploadCanvas(flattenComposite(), { subfolder: SUBFOLDER, filenamePrefix: `comfytv-cap-${node.id}` })
      capturedImageUrl.value = compositeUrl
      writeWidget(node, IMAGE_WIDGET, compositeUrl, { fireCallback: false })
      opts?.onCaptured?.(compositeUrl)

      const children = editor.document().root.children
      const saved = children.map((n) => n.visible)
      const images: Array<{ index: number; label: string; image_url: string }> = [{ index: 1, label: 'composite', image_url: compositeUrl }]
      let idx = 2
      for (let i = 0; i < children.length; i++) {
        if (!saved[i]) continue
        children.forEach((n, j) => (n.visible = j === i))
        editor.render()
        const url = await uploadCanvas(flattenComposite(), { subfolder: SUBFOLDER, filenamePrefix: `comfytv-layer-${node.id}` })
        images.push({ index: idx++, label: children[i].name, image_url: url })
      }
      children.forEach((n, j) => (n.visible = saved[j]))
      editor.render()
      const json = JSON.stringify({ images })
      writeWidget(node, IMAGES_WIDGET, json, { fireCallback: false })
      opts?.onBatchCaptured?.(json)
    } catch {
      toastError(t('layerEditor.captureFailed'))
    } finally {
      capturing.value = false
      requestRender()
    }
  }

  function onChange(): void {
    version.value += 1
    activeId.value = editor.activeNodeId()
    state.value = toV1State()
    requestRender()
    if (lastPersisted === null) return
    const json = JSON.stringify(editor.serialize())
    if (json === lastPersisted) return
    persistRaw(json)
    scheduleUpload()
    scheduleCapture()
  }

  function editProp<T>(label: string, dirty: number, get: () => T, set: (v: T) => void, value: T, mergeKey?: string): void {
    const before = get()
    if (before === value) return
    set(value)
    editor.history.push(new PropCommand(label, dirty, get, set, before, value, mergeKey))
    editor.invalidate()
  }

  function setActiveLayer(id: string | null): void {
    editor.setActiveNode(id)
  }
  function undo(): void { editor.undo() }
  function redo(): void { editor.redo() }

  function setOpacity(id: string, v: number): void {
    const n = engineNode(id); if (!n) return
    editProp('Opacity', Dirty.META, () => n.opacity, (x) => (n.opacity = x), clamp01(v), `opacity:${id}`)
  }
  function setBlendMode(id: string, v: BlendMode): void {
    const n = engineNode(id); if (!n) return
    editProp('Blend', Dirty.DRAWABLE, () => n.mode, (m) => (n.mode = m), defaultMode(v1ToEngineBlend(v)), `blend:${id}`)
  }
  function toggleVisible(id: string): void {
    const n = engineNode(id); if (!n) return
    editProp('Visibility', Dirty.META, () => n.visible, (x) => (n.visible = x), !n.visible)
  }
  function toggleLock(id: string): void {
    const n = engineNode(id); if (!n) return
    editProp('Lock', Dirty.META, () => n.locks.content, (x) => (n.locks.content = x), !n.locks.content)
  }
  function renameLayer(id: string, name: string): void {
    const n = engineNode(id); if (!n) return
    editProp('Rename', Dirty.META, () => n.name, (x) => (n.name = x), name.trim() || 'Layer')
  }

  function moveLayer(id: string, dir: 1 | -1): void {
    const loc = findNode(editor.document().root, id)
    if (loc) editor.reorder(id, loc.index + dir)
  }
  function removeLayer(id: string): void {
    editor.setActiveNode(id)
    editor.removeActive()
  }
  function duplicateLayer(id: string): void {
    const loc = findNode(editor.document().root, id)
    if (!loc) return
    const kind = getNodeKind(loc.node.kind)
    const copy = kind.normalize(kind.serialize(loc.node)) as SceneNode
    copy.id = generateId(loc.node.kind)
    copy.transform = { ...copy.transform, x: copy.transform.x + 16, y: copy.transform.y + 16 }
    editor.addNode(copy, loc.index + 1)
  }

  async function addImageFromUrl(url: string, name: string): Promise<void> {
    try {
      const img = await loadImageElement(url)
      const scale = Math.min(1, MAX_CONTENT_DIM / Math.max(img.width, img.height))
      const nw = Math.max(1, Math.round(img.width * scale))
      const nh = Math.max(1, Math.round(img.height * scale))
      const c = newCanvas(nw, nh)
      c.getContext('2d')!.drawImage(img, 0, 0, nw, nh)
      const cid = content.register(c, scale === 1 ? { uploadedUrl: url } : undefined)
      const d = editor.document()
      editor.addNode(rasterKind.create({
        name, contentId: cid, url: scale === 1 ? url : undefined, naturalWidth: nw, naturalHeight: nh,
        transform: { x: (d.width - nw) / 2, y: (d.height - nh) / 2, w: nw, h: nh, rotation: 0 },
      }))
    } catch {
      toastError(t('layerEditor.loadImageFailed'))
    }
  }
  function addImageFromFile(file: File): void {
    const reader = new FileReader()
    reader.onload = () => void addImageFromUrl(String(reader.result), file.name.replace(/\.[^.]+$/, ''))
    reader.readAsDataURL(file)
  }
  function addTextLayerAt(at: { x: number; y: number }): string {
    const layer = textKind.create({ text: '', transform: { x: at.x, y: at.y, w: 200, h: 64, rotation: 0 } })
    editor.addNode(layer)
    return layer.id
  }

  function setArtboardSize(w: number, h: number): void {
    const d = editor.document()
    const before = { w: d.width, h: d.height }
    if (before.w === w && before.h === h) return
    const apply = (v: { w: number; h: number }): void => {
      d.width = v.w
      d.height = v.h
      if (glOk.value) compositor.resize(v.w, v.h)
    }
    apply({ w, h })
    editor.history.push(
      new PropCommand('Artboard', Dirty.STRUCTURE, () => ({ w: d.width, h: d.height }), apply, before, { w, h })
    )
    editor.invalidate()
    fitView()
  }
  function nudgeActive(dx: number, dy: number): void {
    const id = activeId.value; if (!id) return
    const n = engineNode(id); if (!n) return
    editProp('Move', Dirty.META, () => ({ ...n.transform }), (tf) => (n.transform = tf), { ...n.transform, x: n.transform.x + dx, y: n.transform.y + dy }, `nudge:${id}`)
  }

  function styleOf(n: TextData): TextStyle {
    return { id: n.id, text: n.text, fontRef: n.fontRef, fontSize: n.fontSize, color: n.color, letterSpacing: n.letterSpacing, lineHeight: n.lineHeight, align: n.align }
  }
  const TEXT_FIELDS = ['text', 'fontRef', 'fontSize', 'color', 'letterSpacing', 'lineHeight', 'align', 'transform'] as const
  function snapshotText(n: TextData): Record<string, unknown> {
    const s: Record<string, unknown> = {}
    for (const k of TEXT_FIELDS) s[k] = k === 'transform' ? { ...n.transform } : (n as any)[k]
    return s
  }
  function updateTextLayer(id: string, patch: Partial<TextLayer>): void {
    const n = engineNode(id) as TextData | null
    if (!n || n.kind !== 'text') return
    const before = snapshotText(n)
    Object.assign(n, patch)
    const font = fontStore.getFontSyncWithFallback(n.fontRef)
    if (font) {
      const m = measureText(styleOf(n), font)
      n.transform = { ...n.transform, w: m.w, h: m.h }
    }
    const after = snapshotText(n)
    editor.history.push(
      new PropCommand('Text', Dirty.DRAWABLE, () => snapshotText(n), (v) => Object.assign(n, v), before, after, `text:${id}`)
    )
    editor.invalidate()
  }

  function whiteMask(w: number, h: number): HTMLCanvasElement {
    const c = newCanvas(w, h)
    const g = c.getContext('2d')!
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, w, h)
    return c
  }
  function addMask(id: string): void {
    const n = engineNode(id); if (!n || n.mask) return
    const w = n.kind === 'raster' ? (n as RasterData).naturalWidth : Math.max(1, Math.round(n.transform.w))
    const h = n.kind === 'raster' ? (n as RasterData).naturalHeight : Math.max(1, Math.round(n.transform.h))
    const cid = content.register(whiteMask(w, h))
    editProp('Add Mask', Dirty.CHANNEL, () => n.mask, (m) => (n.mask = m), { id: generateId('mask'), role: 'mask', contentId: cid, enabled: true })
    paintTarget.value = 'mask'
  }
  function removeMask(id: string): void {
    const n = engineNode(id); if (!n || !n.mask) return
    editProp('Delete Mask', Dirty.CHANNEL, () => n.mask, (m) => (n.mask = m), undefined)
    paintTarget.value = 'content'
  }
  function toggleMaskEnabled(id: string): void {
    const n = engineNode(id); if (!n || !n.mask) return
    const mask = n.mask
    editProp('Toggle Mask', Dirty.CHANNEL, () => mask.enabled, (x) => (mask.enabled = x), !mask.enabled)
  }

  function syncEngineTool(): void {
    editor.setBrush({ size: brushSize.value, hardness: brushHardness.value, opacity: brushOpacity.value, flow: 1, color: brushColor.value, spacing: 0.1 })
    let id: string = tool.value
    if (tool.value === 'brush') id = paintTarget.value === 'mask' ? 'mask-brush' : 'brush'
    else if (tool.value === 'eraser') id = paintTarget.value === 'mask' ? 'mask-eraser' : 'eraser'
    if (editor.activeToolId() !== id) editor.setTool(id)
  }
  const textToolHandler: ToolHandler = {
    onPointerDown: (_e, pt) => {
      const hit = [...editor.document().root.children].reverse().find((n) => n.kind === 'text' && insideBox(n.transform, pt))
      const id = hit ? hit.id : addTextLayerAt(pt)
      editor.setActiveNode(id)
      editingTextId.value = id
      return true
    },
    onPointerMove: () => {},
    onPointerUp: () => {},
    cursorFor: () => 'text',
  }
  const engineToolHandler: ToolHandler = {
    onPointerDown: (e, pt) => {
      syncEngineTool()
      editor.pointerDown(e, pt)
      return true
    },
    onPointerMove: (e, pt) => editor.pointerMove(e, pt),
    onPointerUp: (e, pt) => editor.pointerUp(e, pt),
    cursorFor: () => (tool.value === 'select' ? 'default' : 'crosshair'),
  }
  function activeToolHandler(): ToolHandler {
    return tool.value === 'text' ? textToolHandler : engineToolHandler
  }

  function loadUrlToCanvas(url: string): Promise<HTMLCanvasElement> {
    return loadImageElement(url).then((img) => {
      const c = newCanvas(img.width, img.height)
      c.getContext('2d')!.drawImage(img, 0, 0)
      return c
    })
  }
  async function hydrate(): Promise<void> {
    try {
      await editor.hydrate(loadUrlToCanvas)
    } catch (e) {
      console.warn('[ComfyTV/layerEditor] hydrate failed', e)
    }
  }
  function loadDocument(): void {
    lastPersisted = null
    editor.loadJSON(migrateState(readWidgetStr(node, STATE_WIDGET, '{}')))
    lastPersisted = JSON.stringify(editor.serialize())
    if (glOk.value) compositor.resize(editor.document().width, editor.document().height)
  }
  function loadFromNode(): void {
    loadDocument()
    editingTextId.value = null
    capturedImageUrl.value = readWidgetStr(node, IMAGE_WIDGET, '')
    void hydrate()
    fitView()
  }

  loadDocument()

  onNodeConfigure(node, loadFromNode)
  void hydrate()
  const unsubscribeFontReady = fontStore.onFontReady(() => editor.invalidate())

  onBeforeUnmount(() => {
    unsubscribeFontReady()
    if (rafId != null) cancelAnimationFrame(rafId)
    if (uploadTimer != null) window.clearTimeout(uploadTimer)
    if (captureTimer != null) window.clearTimeout(captureTimer)
    captureSeq += 1
    compositor.dispose()
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
