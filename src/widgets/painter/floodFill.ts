import type { RGB } from '@/widgets/painter/types'

export interface PixelBuffer {
  data: Uint8ClampedArray
  width: number
  height: number
}

export const FILL_TOLERANCE = 32

export function floodFill(
  buf: PixelBuffer,
  startX: number,
  startY: number,
  color: RGB,
  alpha: number,
  tolerance = FILL_TOLERANCE,
): boolean {
  const { data, width, height } = buf
  const x0 = Math.floor(startX)
  const y0 = Math.floor(startY)
  if (x0 < 0 || x0 >= width || y0 < 0 || y0 >= height) return false

  const targetAlpha = data[(y0 * width + x0) * 4 + 3]
  const fillAlpha = Math.max(0, Math.min(255, Math.round(alpha)))

  const matches = (a: number) => Math.abs(a - targetAlpha) <= tolerance

  const visited = new Uint8Array(width * height)
  const stack: number[] = [y0 * width + x0]
  let changed = false

  while (stack.length > 0) {
    const idx = stack.pop()!
    if (visited[idx]) continue
    visited[idx] = 1

    const p = idx * 4
    if (!matches(data[p + 3])) continue

    data[p] = color.r
    data[p + 1] = color.g
    data[p + 2] = color.b
    data[p + 3] = fillAlpha
    changed = true

    const x = idx % width
    if (x > 0 && !visited[idx - 1]) stack.push(idx - 1)
    if (x < width - 1 && !visited[idx + 1]) stack.push(idx + 1)
    if (idx >= width && !visited[idx - width]) stack.push(idx - width)
    if (idx < width * (height - 1) && !visited[idx + width]) stack.push(idx + width)
  }

  return changed
}
