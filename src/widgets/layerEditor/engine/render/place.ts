import type { Transform } from '../node'

export type Bitmap = HTMLCanvasElement | ImageBitmap | OffscreenCanvas

export function placeBitmap(
  bitmap: Bitmap,
  transform: Transform,
  docWidth: number,
  docHeight: number,
  scratch?: HTMLCanvasElement
): HTMLCanvasElement | null {
  const canvas = scratch ?? document.createElement('canvas')
  if (canvas.width !== docWidth) canvas.width = docWidth
  if (canvas.height !== docHeight) canvas.height = docHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.clearRect(0, 0, docWidth, docHeight)
  ctx.save()
  ctx.translate(transform.x + transform.w / 2, transform.y + transform.h / 2)
  ctx.rotate(transform.rotation)
  ctx.drawImage(bitmap, -transform.w / 2, -transform.h / 2, transform.w, transform.h)
  ctx.restore()
  return canvas
}
