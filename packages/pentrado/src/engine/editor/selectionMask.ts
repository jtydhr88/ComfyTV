import type { Rect, Vec2 } from '../node'

export type SelectionOp = 'replace' | 'add' | 'subtract' | 'intersect'

export interface GrayMask {
  data: Float32Array
  width: number
  height: number
}

export function emptyMask(width: number, height: number): GrayMask {
  return { data: new Float32Array(width * height), width, height }
}

export function maskFromCanvas(canvas: HTMLCanvasElement): GrayMask | null {
  const g = canvas.getContext('2d')
  if (!g) return null
  const img = g.getImageData(0, 0, canvas.width, canvas.height)
  const mask = emptyMask(canvas.width, canvas.height)
  for (let p = 0; p < mask.data.length; p++) mask.data[p] = img.data[p * 4] / 255
  return mask
}

export function maskToCanvas(mask: GrayMask): HTMLCanvasElement | null {
  const c = document.createElement('canvas')
  c.width = mask.width
  c.height = mask.height
  const g = c.getContext('2d')
  if (!g) return null
  const img = g.createImageData(mask.width, mask.height)
  for (let p = 0; p < mask.data.length; p++) {
    const v = Math.round(Math.max(0, Math.min(1, mask.data[p])) * 255)
    img.data[p * 4] = img.data[p * 4 + 1] = img.data[p * 4 + 2] = v
    img.data[p * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
  return c
}

export function combineMasks(base: GrayMask, addOn: GrayMask, op: SelectionOp): GrayMask {
  const out = emptyMask(base.width, base.height)
  const a = base.data
  const b = addOn.data
  const d = out.data
  switch (op) {
    case 'replace':
      d.set(b)
      break
    case 'add':
      for (let p = 0; p < d.length; p++) d[p] = Math.min(a[p] + b[p], 1)
      break
    case 'subtract':
      for (let p = 0; p < d.length; p++) d[p] = Math.max(a[p] - b[p], 0)
      break
    case 'intersect':
      for (let p = 0; p < d.length; p++) d[p] = Math.min(a[p], b[p])
      break
  }
  return out
}

export function maskBounds(mask: GrayMask): Rect | null {
  let minX = mask.width
  let minY = mask.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < mask.height; y++) {
    const row = y * mask.width
    for (let x = 0; x < mask.width; x++) {
      if (mask.data[row + x] > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

export function isMaskEmpty(mask: GrayMask): boolean {
  for (let p = 0; p < mask.data.length; p++) if (mask.data[p] > 0) return false
  return true
}
