import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'

import { app, type LGraphNode } from '@/lib/comfyApp'
import { t } from '@/i18n'
import { uploadBlobNamed, uploadCanvas } from '@/utils/uploadCanvas'
import { onNodeConfigure, readWidgetStr, writeWidget } from '@/utils/widget'
import { getFontStore } from '@/widgets/layerEditor/fontStore'
import { createPanZoom } from '@/widgets/layerEditor/panZoom'
import { measureText, type TextStyle } from '@/widgets/layerEditor/textRender'
import type { LayerRow, ToolHandler, ToolId } from '@/widgets/layerEditor/types'
import {
  adjustmentKind,
  clonePath,
  cloneFillSpec,
  defaultParams,
  deriveVectorTransform,
  Dirty,
  fillKind,
  normalizeFillSpec,
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
  rasterizeSelectionToLocal,
  registerBuiltinKinds,
  registerBuiltinTools,
  SetContentCommand,
  STROKE_ONLY_SHAPES,
  textKind,
  transformPath,
  type BlendFn,
  type CanvasItem,
  type AdjustmentData,
  type AdjustmentOp,
  type FillData,
  type FillSpec,
  type FillStyle,
  type GroupData,
  type PathData,
  type RasterData,
  type SceneNode,
  type ShapeKind,
  type StrokeStyle,
  type TextData,
  type Transform,
  type VectorData,
} from '@/widgets/layerEditor/engine'

const STATE_WIDGET = 'layer_state'

export type MaskInit = 'white' | 'black' | 'selection' | 'alpha' | 'gray'
const WIDTH_WIDGET = 'width'
const HEIGHT_WIDGET = 'height'
const IMAGE_WIDGET = 'captured_image'
const IMAGES_WIDGET = 'captured_images'

const UPLOAD_DEBOUNCE_MS = 800
const CAPTURE_DEBOUNCE_MS = 700
const MAX_CONTENT_DIM = 4096
const SUBFOLDER = 'comfytv/layer-editor'

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

export function widgetStorage(node: LGraphNode): LayerEditorStorage {
  return {
    subfolder: SUBFOLDER,
    readState: () => readWidgetStr(node, STATE_WIDGET, '{}'),
    writeState: (json, width, height) => {
      writeWidget(node, STATE_WIDGET, json, { fireCallback: false })
      writeWidget(node, WIDTH_WIDGET, width, { fireCallback: false })
      writeWidget(node, HEIGHT_WIDGET, height, { fireCallback: false })
    },
    readCapturedImage: () => readWidgetStr(node, IMAGE_WIDGET, ''),
    beginCapture: () => (url, stale) => {
      if (stale) return
      writeWidget(node, IMAGE_WIDGET, url, { fireCallback: false })
    },
    commitBatch: (json) => writeWidget(node, IMAGES_WIDGET, json, { fireCallback: false }),
  }
}

export interface UseLayerEditorStageOptions {
  onCaptured?: (url: string) => void
  onBatchCaptured?: (json: string) => void
  storage?: LayerEditorStorage
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

  const storage = opts?.storage ?? widgetStorage(node)
  const version = ref(0)
  const tool = ref<ToolId>('select')
  const brushSize = ref(40)
  const brushOpacity = ref(1)
  const brushHardness = ref(1)
  const brushColor = ref('#ff4444')
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
  const editingTextId = ref<string | null>(null)
  const maskView = ref(false)
  const capturing = ref(false)
  const capturedImageUrl = shallowRef<string>(storage.readCapturedImage())
  const activeId = ref<string | null>(null)
  const glOk = ref(true)

  const fontStore = getFontStore()

  let onContextRestored: (() => void) | null = null
  const compositor = createWebGLCompositor()
  glOk.value = compositor.init({
    width: 1024,
    height: 1024,
    onContextRestored: () => onContextRestored?.(),
  })
  const editor = createEditor({ compositor, onChange })
  onContextRestored = () => editor.invalidate()

  let lastPersisted: string | null = null

  let mainCanvas: HTMLCanvasElement | null = null
  let overlayCanvas: HTMLCanvasElement | null = null
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
  const selectedIds = computed(() => new Set(activeId.value ? [activeId.value] : []))
  const canUndo = computed(() => version.value >= 0 && editor.history.canUndo())
  const canRedo = computed(() => version.value >= 0 && editor.history.canRedo())

  const content = editor.content
  const engineNode = (id: string): SceneNode | null => findNode(editor.document().root, id)?.node ?? null

  let rafId: number | null = null
  function presentMaskView(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
    const n = activeId.value ? engineNode(activeId.value) : null
    if (!n?.mask) return false
    const entry = content.get(n.mask.contentId)
    if (!entry) return false
    const bitmap = editor.paintPreview(`mask:${n.id}`) ?? entry.canvas
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)
    const tf = n.transform.w > 0 && n.transform.h > 0
      ? n.transform
      : { x: 0, y: 0, w: entry.width, h: entry.height, rotation: 0 }
    ctx.save()
    ctx.translate(tf.x + tf.w / 2, tf.y + tf.h / 2)
    ctx.rotate(tf.rotation)
    ctx.drawImage(bitmap, -tf.w / 2, -tf.h / 2, tf.w, tf.h)
    ctx.restore()
    return true
  }
  function present(): void {
    if (!mainCanvas) return
    const { width, height } = editor.document()
    if (mainCanvas.width !== width) mainCanvas.width = width
    if (mainCanvas.height !== height) mainCanvas.height = height
    const ctx = mainCanvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    if (maskView.value && presentMaskView(ctx, width, height)) return
    if (glOk.value) {
      editor.setZoom(Math.max(0.01, panZoom.zoom()))
      editor.render()
      ctx.putImageData(compositor.readback(), 0, 0)
    }
  }
  function drawOverlayCanvas(): void {
    if (!overlayCanvas || !viewportEl || !containerEl) return
    const dpr = window.devicePixelRatio || 1
    const bw = Math.max(1, Math.round(viewportEl.clientWidth * dpr))
    const bh = Math.max(1, Math.round(viewportEl.clientHeight * dpr))
    if (overlayCanvas.width !== bw) overlayCanvas.width = bw
    if (overlayCanvas.height !== bh) overlayCanvas.height = bh
    editor.buildOverlay()
    const ctx = overlayCanvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, bw, bh)
    const z = Math.max(0.01, panZoom.zoom())
    ctx.setTransform(z * dpr, 0, 0, z * dpr, containerEl.offsetLeft * dpr, containerEl.offsetTop * dpr)
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
        if (item.ants) {
          ctx.save()
          ctx.strokeStyle = '#000000'
          ctx.strokeRect(item.rect.x, item.rect.y, item.rect.w, item.rect.h)
          ctx.strokeStyle = '#ffffff'
          ctx.setLineDash([hs, hs])
          ctx.strokeRect(item.rect.x, item.rect.y, item.rect.w, item.rect.h)
          ctx.restore()
        } else {
          ctx.strokeRect(item.rect.x, item.rect.y, item.rect.w, item.rect.h)
        }
        break
      case 'preview':
        ctx.drawImage(item.canvas, item.rect.x, item.rect.y, item.rect.w, item.rect.h)
        break
    }
  }
  function requestRender(): void {
    if (rafId == null) rafId = requestAnimationFrame(() => { rafId = null; present(); drawOverlayCanvas() })
  }
  let overlayRafId: number | null = null
  function requestOverlayRender(): void {
    if (rafId != null || overlayRafId != null) return
    overlayRafId = requestAnimationFrame(() => { overlayRafId = null; drawOverlayCanvas() })
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
    storage.writeState(json, editor.document().width, editor.document().height)
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
        const existing = content.get(job.contentId)?.uploadedUrl
        if (existing) {
          job.commitUrl(existing)
          continue
        }
        const blob = await canvasToBlob(job.canvas)
        const res = await uploadBlobNamed(blob, { subfolder: storage.subfolder, filename: `comfytv-layer-${node.id}-${job.contentId}.png` })
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
    if (!glOk.value || capturing.value) return
    const seq = ++captureSeq
    try {
      editor.render()
      const snapshot = flattenComposite()
      const commit = storage.beginCapture()
      const url = await uploadCanvas(snapshot, { subfolder: storage.subfolder, filenamePrefix: `comfytv-cap-${node.id}` })
      const stale = seq !== captureSeq
      commit(url, stale)
      if (stale) return
      capturedImageUrl.value = url
      opts?.onCaptured?.(url)
    } catch {
      toastError(t('layerEditor.captureFailed'))
    }
  }
  function flushCapture(): void {
    if (captureTimer == null) return
    window.clearTimeout(captureTimer)
    captureTimer = null
    void runCapture()
  }
  function cancelPendingCapture(): void {
    if (captureTimer != null) {
      window.clearTimeout(captureTimer)
      captureTimer = null
    }
    captureSeq += 1
  }

  async function captureBatch(): Promise<void> {
    if (!glOk.value) return
    capturing.value = true
    try {
      editor.render()
      const commit = storage.beginCapture()
      const compositeUrl = await uploadCanvas(flattenComposite(), { subfolder: storage.subfolder, filenamePrefix: `comfytv-cap-${node.id}` })
      commit(compositeUrl, false)
      capturedImageUrl.value = compositeUrl
      opts?.onCaptured?.(compositeUrl)

      const children = editor.document().root.children
      const saved = children.map((n) => n.visible)
      const images: Array<{ index: number; label: string; image_url: string }> = [{ index: 1, label: 'composite', image_url: compositeUrl }]
      let idx = 2
      try {
        for (let i = 0; i < children.length; i++) {
          if (!saved[i] || children[i].kind === 'adjustment') continue
          children.forEach((n, j) => (n.visible = j === i))
          editor.render()
          const url = await uploadCanvas(flattenComposite(), { subfolder: storage.subfolder, filenamePrefix: `comfytv-layer-${node.id}` })
          images.push({ index: idx++, label: children[i].name, image_url: url })
        }
      } finally {
        children.forEach((n, j) => (n.visible = saved[j]))
        editor.render()
      }
      const json = JSON.stringify({ images })
      storage.commitBatch(json)
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
    requestRender()
    if (capturing.value) return
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
  function setBlendMode(id: string, v: BlendFn): void {
    const n = engineNode(id); if (!n) return
    editProp('Blend', Dirty.DRAWABLE, () => n.mode, (m) => (n.mode = m), defaultMode(v in LAYER_MODES ? v : 'normal'), `blend:${id}`)
  }
  function toggleVisible(id: string): void {
    const n = engineNode(id); if (!n) return
    editProp('Visibility', Dirty.META, () => n.visible, (x) => (n.visible = x), !n.visible)
  }
  function toggleLock(id: string): void {
    const n = engineNode(id); if (!n) return
    editProp('Lock', Dirty.META, () => n.locks.content, (x) => (n.locks.content = x), !n.locks.content)
  }
  function toggleLockPosition(id: string): void {
    const n = engineNode(id); if (!n) return
    editProp('Lock Position', Dirty.META, () => n.locks.position, (x) => (n.locks.position = x), !n.locks.position)
  }
  function toggleLockAll(id: string): void {
    const n = engineNode(id); if (!n) return
    const target = !(n.locks.content && n.locks.position)
    editProp(
      'Lock All', Dirty.META,
      () => ({ content: n.locks.content, position: n.locks.position }),
      (v) => { n.locks.content = v.content; n.locks.position = v.position },
      { content: target, position: target }
    )
  }
  function renameLayer(id: string, name: string): void {
    const n = engineNode(id); if (!n) return
    editProp('Rename', Dirty.META, () => n.name, (x) => (n.name = x), name.trim() || 'Layer')
  }

  function moveLayer(id: string, dir: 1 | -1): void {
    editor.moveNode(id, dir)
  }
  function removeLayer(id: string): void {
    const n = engineNode(id)
    if (n && n.locks.content && n.locks.position) return
    editor.setActiveNode(id)
    editor.removeActive()
  }
  function regenIds(n: SceneNode): void {
    n.id = generateId(n.kind)
    if (n.kind === 'group') for (const c of (n as GroupData).children) regenIds(c)
  }
  function duplicateLayer(id: string): void {
    const loc = findNode(editor.document().root, id)
    if (!loc) return
    const kind = getNodeKind(loc.node.kind)
    const copy = kind.normalize(kind.serialize(loc.node)) as SceneNode
    regenIds(copy)
    if (copy.kind === 'vector') {
      const v = copy as VectorData
      v.path = transformPath(v.path, (p) => ({ x: p.x + 16, y: p.y + 16 }))
      v.transform = deriveVectorTransform(v.path, v.stroke?.width ?? 0)
    } else if (copy.kind !== 'group') {
      copy.transform = { ...copy.transform, x: copy.transform.x + 16, y: copy.transform.y + 16 }
    }
    editor.addNode(copy, loc.index + 1, loc.parent.id)
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
      const hasRaster = d.root.children.some((n) => n.kind === 'raster')
      if (!hasRaster) {
        editor.addNode(rasterKind.create({
          name, contentId: cid, url: scale === 1 ? url : undefined, naturalWidth: nw, naturalHeight: nh,
          transform: { x: (d.width - nw) / 2, y: (d.height - nh) / 2, w: nw, h: nh, rotation: 0 },
        }))
        return
      }
      editor.startFloating(cid, nw, nh, name)
    } catch {
      toastError(t('layerEditor.loadImageFailed'))
    }
  }

  function addEmptyLayer(): void {
    const d = editor.document()
    const c = newCanvas(d.width, d.height)
    c.getContext('2d')?.clearRect(0, 0, d.width, d.height)
    const cid = content.register(c)
    const count = d.root.children.length + 1
    editor.addNode(rasterKind.create({
      name: `Layer ${count}`, contentId: cid, naturalWidth: d.width, naturalHeight: d.height,
      transform: { x: 0, y: 0, w: d.width, h: d.height, rotation: 0 },
    }))
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
    editor.flattenImage()
  }
  function flipImage(axis: 'h' | 'v'): void {
    editor.flipImage(axis)
  }
  function cropToContent(id: string): void {
    editor.cropToContent(id)
  }
  function layerToCanvasSize(id: string): void {
    editor.layerToCanvasSize(id)
  }
  function toggleLockAlpha(id: string): void {
    const n = engineNode(id)
    if (!n || n.kind !== 'raster') return
    const r = n as RasterData
    editProp('Lock Alpha', Dirty.META, () => r.lockAlpha === true, (v) => (r.lockAlpha = v), !(r.lockAlpha === true))
  }
  function addAdjustmentLayer(op: AdjustmentOp = 'brightness-contrast'): void {
    editor.addNode(adjustmentKind.create({ op, params: defaultParams(op) }))
  }
  function addFillLayer(spec?: FillSpec): void {
    editor.addNode(fillKind.create(spec ? { fill: spec } : {}), 0)
  }
  function updateFillLayer(id: string, spec: FillSpec): void {
    const n = engineNode(id)
    if (!n || n.kind !== 'fill') return
    const f = n as FillData
    const snapshot = () => ({ fill: cloneFillSpec(f.fill) })
    const restore = (v: { fill: FillSpec }) => {
      f.fill = cloneFillSpec(v.fill)
    }
    const before = snapshot()
    f.fill = normalizeFillSpec(spec)
    editor.history.push(
      new PropCommand('Fill', Dirty.DRAWABLE, snapshot, restore, before, snapshot(), `fill:${id}`)
    )
    editor.invalidate()
  }
  function updateAdjustment(id: string, patch: { op?: string; params?: Record<string, number> }): void {
    const n = engineNode(id)
    if (!n || n.kind !== 'adjustment') return
    const adj = n as AdjustmentData
    const snapshot = () => ({ op: adj.op, params: { ...adj.params } })
    const restore = (v: { op: string; params: Record<string, number> }) => {
      adj.op = v.op
      adj.params = { ...v.params }
    }
    const before = snapshot()
    if (patch.op && patch.op !== adj.op) {
      adj.op = patch.op
      adj.params = defaultParams(patch.op as AdjustmentOp)
    }
    if (patch.params) adj.params = { ...adj.params, ...patch.params }
    editor.history.push(
      new PropCommand('Adjustment', Dirty.DRAWABLE, snapshot, restore, before, snapshot(), `adjust:${id}`)
    )
    editor.invalidate()
  }
  function updateVectorStyle(id: string, patch: { fill?: FillStyle | null; stroke?: StrokeStyle | null }): void {
    const n = engineNode(id)
    if (!n || n.kind !== 'vector') return
    const v = n as VectorData
    const snapshot = () => ({
      fill: v.fill ? { ...v.fill } : undefined,
      stroke: v.stroke ? { ...v.stroke } : undefined,
      transform: { ...v.transform },
    })
    const restore = (s: { fill?: FillStyle; stroke?: StrokeStyle; transform: Transform }) => {
      v.fill = s.fill ? { ...s.fill } : undefined
      v.stroke = s.stroke ? { ...s.stroke } : undefined
      v.transform = { ...s.transform }
    }
    const before = snapshot()
    if (patch.fill !== undefined) v.fill = patch.fill ? { ...patch.fill } : undefined
    if (patch.stroke !== undefined) v.stroke = patch.stroke ? { ...patch.stroke } : undefined
    v.transform = deriveVectorTransform(v.path, v.stroke?.width ?? 0)
    editor.history.push(
      new PropCommand('Shape Style', Dirty.DRAWABLE, snapshot, restore, before, snapshot(), `vector:${id}`)
    )
    editor.invalidate()
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
  function updateTextLayer(id: string, patch: Partial<TextData>): void {
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

  function solidMask(w: number, h: number, color: string): HTMLCanvasElement {
    const c = newCanvas(w, h)
    const g = c.getContext('2d')!
    g.fillStyle = color
    g.fillRect(0, 0, w, h)
    return c
  }
  function maskFromLayerPixels(n: RasterData, w: number, h: number, source: 'alpha' | 'gray'): HTMLCanvasElement | null {
    const entry = content.get(n.contentId)
    if (!entry) return null
    const src = newCanvas(w, h)
    const sg = src.getContext('2d')!
    sg.drawImage(entry.canvas, 0, 0, w, h)
    const img = sg.getImageData(0, 0, w, h)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const v = source === 'alpha'
        ? d[i + 3]
        : Math.round((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) * (d[i + 3] / 255))
      d[i] = d[i + 1] = d[i + 2] = v
      d[i + 3] = 255
    }
    sg.putImageData(img, 0, 0)
    return src
  }
  function maskFromSelection(tf: Transform, w: number, h: number): HTMLCanvasElement | null {
    const d = editor.document()
    if (!d.selectionId) return null
    const channel = d.channels.find((ch) => ch.id === d.selectionId)
    if (!channel) return null
    const entry = content.get(channel.contentId)
    if (!entry) return null
    const cov = rasterizeSelectionToLocal(entry.canvas, tf, w, h)
    if (!cov) return null
    const c = newCanvas(w, h)
    const g = c.getContext('2d')!
    const img = g.createImageData(w, h)
    for (let p = 0; p < cov.length; p++) {
      const v = Math.round(cov[p] * 255)
      img.data[p * 4] = img.data[p * 4 + 1] = img.data[p * 4 + 2] = v
      img.data[p * 4 + 3] = 255
    }
    g.putImageData(img, 0, 0)
    return c
  }
  function addMask(id: string, init: MaskInit = 'white'): void {
    const n = engineNode(id); if (!n || n.mask) return
    const d = editor.document()
    const docSized = n.kind === 'adjustment' || n.kind === 'fill' || n.kind === 'group'
    const w = n.kind === 'raster' ? (n as RasterData).naturalWidth : docSized ? d.width : Math.max(1, Math.round(n.transform.w))
    const h = n.kind === 'raster' ? (n as RasterData).naturalHeight : docSized ? d.height : Math.max(1, Math.round(n.transform.h))
    const tf = n.transform.w > 0 && n.transform.h > 0 ? n.transform : { x: 0, y: 0, w, h, rotation: 0 }
    let canvas: HTMLCanvasElement | null = null
    if (init === 'black') canvas = solidMask(w, h, '#000000')
    else if (init === 'selection') canvas = maskFromSelection(tf, w, h)
    else if (init === 'alpha' || init === 'gray') {
      if (n.kind === 'raster') canvas = maskFromLayerPixels(n as RasterData, w, h, init)
    }
    canvas ??= solidMask(w, h, '#ffffff')
    const cid = content.register(canvas)
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
  function invertMask(id: string): void {
    const n = engineNode(id); if (!n || !n.mask) return
    const mask = n.mask
    const entry = content.get(mask.contentId)
    if (!entry) return
    const c = newCanvas(entry.width, entry.height)
    const g = c.getContext('2d')!
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, entry.width, entry.height)
    g.globalCompositeOperation = 'difference'
    g.drawImage(entry.canvas, 0, 0)
    const beforeId = mask.contentId
    const beforeUrl = mask.url
    const afterId = content.register(c)
    mask.contentId = afterId
    mask.url = undefined
    editor.history.push(new SetContentCommand('Invert Mask', mask, beforeId, afterId, content, beforeUrl))
    editor.invalidate()
  }
  function applyMask(id: string): void {
    const n = engineNode(id)
    if (!n || !n.mask || n.kind !== 'raster') return
    const r = n as RasterData
    const contentEntry = content.get(r.contentId)
    const maskEntry = content.get(n.mask.contentId)
    if (!contentEntry || !maskEntry) return
    const w = contentEntry.width
    const h = contentEntry.height
    const scaled = newCanvas(w, h)
    scaled.getContext('2d')!.drawImage(maskEntry.canvas, 0, 0, w, h)
    const maskData = scaled.getContext('2d')!.getImageData(0, 0, w, h).data
    const c = newCanvas(w, h)
    const g = c.getContext('2d')!
    g.drawImage(contentEntry.canvas, 0, 0)
    const img = g.getImageData(0, 0, w, h)
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i + 3] = (img.data[i + 3] * maskData[i]) / 255
    }
    g.putImageData(img, 0, 0)
    const beforeId = r.contentId
    const beforeUrl = r.url
    const afterId = content.register(c)
    editor.history.beginGroup('Apply Mask')
    r.contentId = afterId
    r.url = undefined
    editor.history.push(new SetContentCommand('Apply Mask', r, beforeId, afterId, content, beforeUrl))
    editProp('Delete Mask', Dirty.CHANNEL, () => n.mask, (m) => (n.mask = m), undefined)
    editor.history.endGroup()
    paintTarget.value = 'content'
    editor.invalidate()
  }
  function maskToSelection(id: string): void {
    if (editor.maskToSelection(id)) editor.invalidate()
  }

  function syncEngineTool(): void {
    editor.setBrush({ size: brushSize.value, hardness: brushHardness.value, opacity: brushOpacity.value, flow: 1, color: brushColor.value, spacing: 0.1 })
    editor.setShapeOptions({
      shape: shapeKind.value,
      fill: shapeFillEnabled.value ? { color: shapeFillColor.value } : null,
      stroke: shapeStrokeEnabled.value || STROKE_ONLY_SHAPES.has(shapeKind.value)
        ? { color: shapeStrokeColor.value, width: Math.max(1, shapeStrokeWidth.value), cap: 'butt', join: 'miter' }
        : null,
      combine: shapeCombine.value,
      sides: shapeSides.value,
      starRatio: shapeStarRatio.value,
      turns: shapeTurns.value,
    })
    let id: string = tool.value
    if (tool.value === 'brush') id = paintTarget.value === 'mask' ? 'mask-brush' : 'brush'
    else if (tool.value === 'eraser') id = paintTarget.value === 'mask' ? 'mask-eraser' : 'eraser'
    else if (tool.value === 'text') id = 'select'
    if (editor.activeToolId() !== id) editor.setTool(id)
  }
  watch(
    [tool, paintTarget, brushSize, brushHardness, brushOpacity, brushColor,
     shapeKind, shapeFillEnabled, shapeFillColor, shapeStrokeEnabled, shapeStrokeColor, shapeStrokeWidth, shapeCombine,
     shapeSides, shapeStarRatio, shapeTurns],
    syncEngineTool
  )
  watch(maskView, () => requestRender())
  watch(warpPoints, () => editor.setWarpOptions({ points: warpPoints.value }))
  const textToolHandler: ToolHandler = {
    onPointerDown: (_e, pt) => {
      const hit = [...editor.document().root.children].reverse().find((n) => n.kind === 'text' && insideBox(n.transform, pt))
      if (hit && hit.locks.content) {
        editor.setActiveNode(hit.id)
        return true
      }
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
    cursorFor: (pt) => editor.cursorAt(pt),
  }
  function activeToolHandler(): ToolHandler {
    if (editor.floating()) return engineToolHandler
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
    editor.loadJSON(migrateState(storage.readState()))
    lastPersisted = JSON.stringify(editor.serialize())
    if (glOk.value) compositor.resize(editor.document().width, editor.document().height)
  }
  function loadFromNode(): void {
    loadDocument()
    editingTextId.value = null
    capturedImageUrl.value = storage.readCapturedImage()
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
    layers, canvasSize, activeId, activeNode, selectedIds,
    tool, brushSize, brushOpacity, brushHardness, brushColor, paintTarget,
    shapeKind, shapeFillEnabled, shapeFillColor, shapeStrokeEnabled, shapeStrokeColor, shapeStrokeWidth, shapeCombine,
    shapeSides, shapeStarRatio, shapeTurns,
    editingTextId, capturing, capturedImageUrl,
    canUndo, canRedo,
    panZoom, setElements, fitView, requestRender, requestOverlayRender,
    activeToolHandler,
    undo, redo,
    addImageFromUrl, addImageFromFile, addTextLayerAt,
    removeLayer, moveLayer, moveLayerRelative, duplicateLayer,
    groupActiveLayer, ungroupActiveLayer,
    setActiveLayer, setOpacity, setBlendMode, toggleVisible, toggleLock, renameLayer,
    addMask, removeMask, toggleMaskEnabled, invertMask, applyMask, maskToSelection, maskView,
    hasSelection: () => editor.selectionBounds() != null,
    warpPoints,
    warpDirty: computed(() => {
      void version.value
      return editor.warpDirty()
    }),
    warpApply: () => { editor.warpApply() },
    warpCancel: () => { editor.warpCancel() },
    updateTextLayer,
    setArtboardSize, nudgeActive,
    captureBatch, flushCapture, cancelPendingCapture, reload: loadFromNode,
    documentIsEmpty: () => editor.document().root.children.length === 0,
    addEmptyLayer, floating, anchorFloating, cancelFloating,
    mergeDown, flattenImage, flipImage, cropToContent, layerToCanvasSize, toggleLockAlpha,
    toggleLockPosition, toggleLockAll,
    selectAll, selectNone, invertSelection,
    addAdjustmentLayer, updateAdjustment, updateVectorStyle,
    addFillLayer, updateFillLayer,
    content, fontStore,
  }
}
