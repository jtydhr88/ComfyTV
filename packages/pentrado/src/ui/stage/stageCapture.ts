import { noteActivity } from '../../engine/impl/memoryPressure'
import { pendingUploads } from '../../engine'
import { canvasToBlob, CAPTURE_DEBOUNCE_MS, newCanvas, PERSIST_DEBOUNCE_MS, UPLOAD_DEBOUNCE_MS, type StageCtx } from './stageContext'

export function createStageCapture(ctx: StageCtx) {
  const { editor, content, compositor, host, storage, instanceId, opts, capturing, capturedImageUrl, glOk, version, activeId, t, toastError } = ctx
  let lastPersisted: string | null = null
  let uploadTimer: number | null = null
  let uploading = false
  let uploadAgain = false
  let captureTimer: number | null = null
  let captureSeq = 0
  let persistTimer: number | null = null
  let interactionDepth = 0
  let persistAfterInteraction = false

  function persistRaw(json: string): void {
    lastPersisted = json
    storage.writeState(json, editor.document().width, editor.document().height)
  }
  function persist(): void {
    persistRaw(JSON.stringify(editor.serialize()))
  }
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
        if (!(content.isFullyResident?.(job.contentId) ?? true)) await content.restoreAll?.([job.contentId])
        const blob = await canvasToBlob(job.canvas)
        const res = await host.uploadBlob(blob, { subfolder: storage.subfolder, filename: `pentrado-layer-${instanceId}-${job.contentId}.png` })
        job.commitUrl(res.url)
        content.markUploaded(job.contentId, res.url)
      }
      let uploaded = jobs.length > 0
      const f = editor.floating()
      if (f && !content.get(f.contentId)?.uploadedUrl) {
        const entry = content.get(f.contentId)
        if (entry) {
          if (!(content.isFullyResident?.(f.contentId) ?? true)) await content.restoreAll?.([f.contentId])
          const blob = await canvasToBlob(entry.canvas)
          const res = await host.uploadBlob(blob, { subfolder: storage.subfolder, filename: `pentrado-float-${instanceId}-${f.contentId}.png` })
          content.markUploaded(f.contentId, res.url)
          uploaded = true
        }
      }
      if (uploaded) persist()
    } catch {
      toastError(t('pentrado.uploadFailed'))
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
  function scheduleCapture(): void {
    if (!opts?.onCaptured) return
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
      const url = await host.uploadCanvas(snapshot, { subfolder: storage.subfolder, filenamePrefix: `pentrado-cap-${instanceId}` })
      const stale = seq !== captureSeq
      commit(url, stale)
      if (stale) return
      capturedImageUrl.value = url
      opts?.onCaptured?.(url)
    } catch (e) {
      console.error('[pentrado] capture failed:', e)
      toastError(t('pentrado.captureFailed'))
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
      const compositeUrl = await host.uploadCanvas(flattenComposite(), { subfolder: storage.subfolder, filenamePrefix: `pentrado-cap-${instanceId}` })
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
          const url = await host.uploadCanvas(flattenComposite(), { subfolder: storage.subfolder, filenamePrefix: `pentrado-layer-${instanceId}` })
          images.push({ index: idx++, label: children[i].name, image_url: url })
        }
      } finally {
        children.forEach((n, j) => (n.visible = saved[j]))
        editor.render()
      }
      const json = JSON.stringify({ images })
      storage.commitBatch(json)
      opts?.onBatchCaptured?.(json)
    } catch (e) {
      console.error('[pentrado] capture failed:', e)
      toastError(t('pentrado.captureFailed'))
    } finally {
      capturing.value = false
      ctx.requestRender()
    }
  }
  async function captureNow(): Promise<string | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
      for (let i = 0; i < 100 && capturing.value; i++) await new Promise((r) => setTimeout(r, 100))
      cancelPendingCapture()
      const seq = captureSeq + 1
      await runCapture()
      if (captureSeq === seq && capturedImageUrl.value) return capturedImageUrl.value
    }
    return null
  }
  function readbackCanvas(): HTMLCanvasElement {
    const img = compositor.readback()
    const c = newCanvas(img.width, img.height)
    c.getContext('2d')!.putImageData(img, 0, 0)
    return c
  }
  function persistNow(): void {
    if (lastPersisted === null) return
    if (capturing.value) {
      schedulePersist()
      return
    }
    const json = JSON.stringify(editor.serialize())
    if (json === lastPersisted) return
    persistRaw(json)
    scheduleUpload()
    scheduleCapture()
  }
  function schedulePersist(): void {
    if (persistTimer != null) window.clearTimeout(persistTimer)
    persistTimer = window.setTimeout(() => {
      persistTimer = null
      persistNow()
    }, PERSIST_DEBOUNCE_MS)
  }
  function flushPersist(): void {
    if (persistTimer != null) {
      window.clearTimeout(persistTimer)
      persistTimer = null
    }
    persistNow()
  }
  function beginInteraction(): void {
    noteActivity()
    interactionDepth += 1
  }
  function endInteraction(): void {
    interactionDepth = Math.max(0, interactionDepth - 1)
    if (interactionDepth === 0 && persistAfterInteraction) {
      persistAfterInteraction = false
      schedulePersist()
    }
  }
  function onChange(): void {
    noteActivity()
    version.value += 1
    activeId.value = editor.activeNodeId()
    ctx.requestRender()
    if (capturing.value) return
    if (lastPersisted === null) return
    if (interactionDepth > 0) {
      persistAfterInteraction = true
      return
    }
    schedulePersist()
  }
  function setPersisted(json: string | null): void {
    lastPersisted = json
  }
  function dispose(): void {
    if (persistTimer != null) window.clearTimeout(persistTimer)
    if (uploadTimer != null) window.clearTimeout(uploadTimer)
    if (captureTimer != null) window.clearTimeout(captureTimer)
    captureSeq += 1
  }
  return {
    scheduleUpload, flattenComposite, scheduleCapture, flushCapture, cancelPendingCapture, captureBatch, captureNow,
    readbackCanvas, flushPersist, beginInteraction, endInteraction, onChange, setPersisted, dispose,
  }
}
