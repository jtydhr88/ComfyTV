const PREVIEW_TRANSITION = 'transform 80ms linear'

export function mirrorPreviewStyle(flipH: boolean, flipV: boolean): Record<string, string> {
  return {
    transform: `scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`,
    transition: PREVIEW_TRANSITION,
  }
}

export function rotatePreviewStyle(deg: number): Record<string, string> {
  return {
    transform: `rotate(${deg}deg)`,
    transition: PREVIEW_TRANSITION,
  }
}

export function rotatedSize(w: number, h: number, deg: number): { width: number; height: number } {
  const rad = (deg * Math.PI) / 180
  const cosT = Math.abs(Math.cos(rad))
  const sinT = Math.abs(Math.sin(rad))
  return {
    width: Math.max(1, Math.ceil(w * cosT + h * sinT)),
    height: Math.max(1, Math.ceil(w * sinT + h * cosT)),
  }
}

export function mirrorToCanvas(
  img: HTMLImageElement,
  horizontal: boolean,
  vertical: boolean,
): HTMLCanvasElement {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  ctx.translate(horizontal ? w : 0, vertical ? h : 0)
  ctx.scale(horizontal ? -1 : 1, vertical ? -1 : 1)
  ctx.drawImage(img, 0, 0)
  return canvas
}

export function rotateToCanvas(img: HTMLImageElement, deg: number): HTMLCanvasElement {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const rad = (deg * Math.PI) / 180
  const { width, height } = rotatedSize(w, h, deg)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')

  ctx.translate(width / 2, height / 2)
  ctx.rotate(rad)
  ctx.drawImage(img, -w / 2, -h / 2)
  return canvas
}
