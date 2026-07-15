
export interface PanZoomEls {
  viewport: HTMLElement
  container: HTMLElement
}

export interface PanZoom {
  zoom: () => number
  invalidate: () => void
  fit: (artW: number, artH: number) => void
  panBy: (dx: number, dy: number) => void
  handleWheel: (e: WheelEvent) => void
  screenToArtboard: (clientX: number, clientY: number) => { x: number; y: number }
}

export function createPanZoom(getEls: () => PanZoomEls | null): PanZoom {
  let zoomRatio = 1
  let panX = 0
  let panY = 0
  let artW = 1024
  let artH = 1024

  function invalidate(): void {
    const els = getEls()
    if (!els) return
    Object.assign(els.container.style, {
      width: `${artW * zoomRatio}px`,
      height: `${artH * zoomRatio}px`,
      left: `${panX}px`,
      top: `${panY}px`,
    })
  }

  function fit(w: number, h: number): void {
    artW = w
    artH = h
    const els = getEls()
    if (!els) return
    const availW = els.viewport.clientWidth
    const availH = els.viewport.clientHeight
    if (availW <= 0 || availH <= 0) return
    const zoom = Math.min(availW / artW, availH / artH, 1) * 0.9
    zoomRatio = Math.max(0.01, zoom)
    panX = (availW - artW * zoomRatio) / 2
    panY = (availH - artH * zoomRatio) / 2
    invalidate()
  }

  function panBy(dx: number, dy: number): void {
    panX += dx
    panY += dy
    invalidate()
  }

  function handleWheel(e: WheelEvent): void {
    const els = getEls()
    if (!els) return
    const oldZoom = zoomRatio
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const newZoom = Math.max(0.05, Math.min(20, oldZoom * factor))
    zoomRatio = newZoom
    const mouseX = e.offsetX - panX
    const mouseY = e.offsetY - panY
    const scale = newZoom / oldZoom
    panX += mouseX - mouseX * scale
    panY += mouseY - mouseY * scale
    invalidate()
  }

  function screenToArtboard(clientX: number, clientY: number): { x: number; y: number } {
    const els = getEls()
    if (!els) return { x: 0, y: 0 }
    const rect = els.container.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 }
    return {
      x: ((clientX - rect.left) / rect.width) * artW,
      y: ((clientY - rect.top) / rect.height) * artH,
    }
  }

  return {
    zoom: () => zoomRatio,
    invalidate,
    fit,
    panBy,
    handleWheel,
    screenToArtboard,
  }
}
