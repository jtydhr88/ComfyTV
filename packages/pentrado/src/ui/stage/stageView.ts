import { noteActivity } from '../../engine/impl/memoryPressure'
import { viewportStamp } from '../../engine/render/renderStack'
import type { CanvasItem } from '../../engine'
import { SUSPEND_GRACE_MS, type StageCtx } from './stageContext'

export function createStageView(ctx: StageCtx) {
  const { editor, content, panZoom, compositor, activeId, engineNode, maskView, glOk, suspended } = ctx
  let suspendTimer: number | null = null
  let visObserver: IntersectionObserver | null = null
  let suspendEpoch = 0
  let mainCanvas: HTMLCanvasElement | null = null
  let overlayCanvas: HTMLCanvasElement | null = null
  let viewportEl: HTMLElement | null = null
  let containerEl: HTMLElement | null = null
  let rafId: number | null = null
  let overlayRafId: number | null = null
  let lastPresentWasMask = false
  let lastViewportKey = ''

  function suspendNow(): void {
    if (suspended.value) return
    suspended.value = true
    editor.content.suspendAll?.()
  }
  function wake(): void {
    suspendEpoch++
    if (suspendTimer != null) {
      window.clearTimeout(suspendTimer)
      suspendTimer = null
    }
    if (!suspended.value) return
    suspended.value = false
    editor.content.resumePrefetch?.()
    editor.invalidate()
    requestRender()
  }
  function observeVisibility(el: HTMLElement): void {
    visObserver?.disconnect()
    ctx.stopPressureSampler?.()
    if (typeof IntersectionObserver === 'undefined') return
    visObserver = new IntersectionObserver((entries) => {
      const visible = entries.some((e) => e.isIntersecting)
      if (visible) {
        wake()
      } else if (suspendTimer == null && !suspended.value) {
        const epoch = ++suspendEpoch
        suspendTimer = window.setTimeout(() => {
          suspendTimer = null
          if (epoch === suspendEpoch) suspendNow()
        }, SUSPEND_GRACE_MS + Math.random() * SUSPEND_GRACE_MS)
      }
    })
    visObserver.observe(el)
  }

  function presentMaskView(g: CanvasRenderingContext2D, width: number, height: number): boolean {
    const n = activeId.value ? engineNode(activeId.value) : null
    if (!n?.mask) return false
    const entry = content.get(n.mask.contentId)
    if (!entry) return false
    const bitmap = editor.paintPreview(`mask:${n.id}`) ?? entry.canvas
    g.fillStyle = '#000000'
    g.fillRect(0, 0, width, height)
    const tf = n.transform.w > 0 && n.transform.h > 0
      ? n.transform
      : { x: 0, y: 0, w: entry.width, h: entry.height, rotation: 0 }
    g.save()
    g.translate(tf.x + tf.w / 2, tf.y + tf.h / 2)
    g.rotate(tf.rotation)
    g.drawImage(bitmap, -tf.w / 2, -tf.h / 2, tf.w, tf.h)
    g.restore()
    return true
  }
  function syncViewport(): void {
    if (!viewportEl) return
    const r = viewportEl.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return
    const a = panZoom.screenToArtboard(r.left, r.top)
    const b = panZoom.screenToArtboard(r.right, r.bottom)
    const rect = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }
    editor.setViewport(rect)
    const key = viewportStamp(rect)
    if (key !== lastViewportKey) {
      lastViewportKey = key
      noteActivity()
      editor.redraw()
    }
  }
  function present(): void {
    if (!mainCanvas) return
    const { width, height } = editor.document()
    const resized = mainCanvas.width !== width || mainCanvas.height !== height
    if (resized) {
      mainCanvas.width = width
      mainCanvas.height = height
    }
    const g = mainCanvas.getContext('2d')
    if (!g) return
    if (maskView.value && presentMaskView(g, width, height)) {
      lastPresentWasMask = true
      return
    }
    if (!glOk.value) {
      g.clearRect(0, 0, width, height)
      return
    }
    editor.setZoom(Math.max(0.01, panZoom.zoom()))
    syncViewport()
    const dmg = editor.takePresentDamage()
    const clean = !dmg.full && !dmg.rect
    if (clean && !resized && !lastPresentWasMask) return
    if (dmg.rect && !dmg.full && !resized && !lastPresentWasMask) {
      const gc = compositor.presentCanvas(dmg.rect)
      if (!gc) return
      const x = Math.max(0, Math.floor(dmg.rect.x))
      const y = Math.max(0, Math.floor(dmg.rect.y))
      const w = Math.min(width, Math.ceil(dmg.rect.x + dmg.rect.w)) - x
      const h = Math.min(height, Math.ceil(dmg.rect.y + dmg.rect.h)) - y
      if (w <= 0 || h <= 0) return
      g.clearRect(x, y, w, h)
      g.drawImage(gc, x, y, w, h, x, y, w, h)
      return
    }
    lastPresentWasMask = false
    g.clearRect(0, 0, width, height)
    editor.render()
    const gc = compositor.presentCanvas()
    if (gc) g.drawImage(gc, 0, 0)
  }
  function drawOverlayCanvas(): void {
    if (!overlayCanvas || !viewportEl || !containerEl) return
    const dpr = window.devicePixelRatio || 1
    const bw = Math.max(1, Math.round(viewportEl.clientWidth * dpr))
    const bh = Math.max(1, Math.round(viewportEl.clientHeight * dpr))
    if (overlayCanvas.width !== bw) overlayCanvas.width = bw
    if (overlayCanvas.height !== bh) overlayCanvas.height = bh
    editor.buildOverlay()
    const g = overlayCanvas.getContext('2d')
    if (!g) return
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, bw, bh)
    const z = Math.max(0.01, panZoom.zoom())
    g.setTransform(z * dpr, 0, 0, z * dpr, containerEl.offsetLeft * dpr, containerEl.offsetTop * dpr)
    g.lineWidth = 1 / z
    g.strokeStyle = '#3b82f6'
    g.fillStyle = '#ffffff'
    const hs = 4 / z
    for (const item of editor.overlay.items) drawItem(g, item, hs)
  }
  function drawItem(g: CanvasRenderingContext2D, item: CanvasItem, hs: number): void {
    switch (item.type) {
      case 'handle':
        g.beginPath()
        if (item.shape === 'circle') g.arc(item.pos.x, item.pos.y, hs, 0, Math.PI * 2)
        else g.rect(item.pos.x - hs, item.pos.y - hs, hs * 2, hs * 2)
        g.fill()
        g.stroke()
        break
      case 'line':
        g.beginPath(); g.moveTo(item.a.x, item.a.y); g.lineTo(item.b.x, item.b.y); g.stroke()
        break
      case 'polyline':
        g.beginPath()
        item.points.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)))
        if (item.closed) g.closePath()
        if (item.ants) {
          g.save()
          g.strokeStyle = '#000000'
          g.stroke()
          g.strokeStyle = '#ffffff'
          g.setLineDash([hs, hs])
          g.stroke()
          g.restore()
        } else {
          g.stroke()
        }
        break
      case 'arc':
        g.beginPath(); g.arc(item.center.x, item.center.y, item.radius, 0, Math.PI * 2); g.stroke()
        break
      case 'rect':
        if (item.ants) {
          g.save()
          g.strokeStyle = '#000000'
          g.strokeRect(item.rect.x, item.rect.y, item.rect.w, item.rect.h)
          g.strokeStyle = '#ffffff'
          g.setLineDash([hs, hs])
          g.strokeRect(item.rect.x, item.rect.y, item.rect.w, item.rect.h)
          g.restore()
        } else {
          g.strokeRect(item.rect.x, item.rect.y, item.rect.w, item.rect.h)
        }
        break
      case 'preview':
        g.drawImage(item.canvas, item.rect.x, item.rect.y, item.rect.w, item.rect.h)
        break
    }
  }
  function requestRender(): void {
    if (rafId == null) rafId = requestAnimationFrame(() => { rafId = null; present(); drawOverlayCanvas() })
  }
  function requestOverlayRender(): void {
    if (rafId != null || overlayRafId != null) return
    overlayRafId = requestAnimationFrame(() => { overlayRafId = null; drawOverlayCanvas() })
  }
  function setElements(els: { viewport: HTMLElement; container: HTMLElement; main: HTMLCanvasElement; overlay: HTMLCanvasElement }): void {
    viewportEl = els.viewport
    containerEl = els.container
    mainCanvas = els.main
    overlayCanvas = els.overlay
    observeVisibility(els.container)
    fitView()
  }
  function fitView(): void {
    panZoom.fit(editor.document().width, editor.document().height)
    requestRender()
  }
  function pickColorAt(pt: { x: number; y: number }, target: 'fg' | 'bg' = 'fg'): boolean {
    if (!mainCanvas) return false
    const g = mainCanvas.getContext('2d')
    if (!g) return false
    const { width, height } = editor.document()
    const x = Math.max(0, Math.min(width - 1, Math.floor(pt.x)))
    const y = Math.max(0, Math.min(height - 1, Math.floor(pt.y)))
    const d = g.getImageData(x, y, 1, 1).data
    const hex = `#${((d[0] << 16) | (d[1] << 8) | d[2]).toString(16).padStart(6, '0')}`
    if (target === 'bg') ctx.backgroundColor.value = hex
    else ctx.brushColor.value = hex
    return true
  }
  function dispose(): void {
    visObserver?.disconnect()
    if (suspendTimer != null) window.clearTimeout(suspendTimer)
    if (rafId != null) cancelAnimationFrame(rafId)
  }
  return {
    requestRender, requestOverlayRender, setElements, fitView, pickColorAt, dispose,
    mainCanvas: () => mainCanvas,
  }
}
