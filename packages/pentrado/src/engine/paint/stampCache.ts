import { brushProfile } from './brushProfile'

export interface BrushStamp {
  size: number
  center: number
  data: Float32Array
}

const SUBPIXEL_STEPS = 4
const CACHE_CAP = 128

const cache = new Map<string, BrushStamp>()

export function quantizeSubpixel(frac: number): number {
  return Math.round(frac * SUBPIXEL_STEPS) / SUBPIXEL_STEPS
}

function buildStamp(radius: number, hardness: number, hardEdge: boolean, fx: number, fy: number): BrushStamp {
  const r = Math.ceil(radius) + 1
  const size = r * 2 + 1
  const data = new Float32Array(size * size)
  const cx = r + fx
  const cy = r + fy
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (d > radius) continue
      data[y * size + x] = hardEdge ? 1 : brushProfile(d / radius, hardness)
    }
  }
  return { size, center: r, data }
}

export function getStamp(radius: number, hardness: number, hardEdge: boolean, fx: number, fy: number): BrushStamp {
  const rq = Math.max(0.1, radius > 16 ? Math.round(radius * 2) / 2 : Math.round(radius * 10) / 10)
  const hq = Math.round(hardness * 100) / 100
  const key = `${rq}|${hq}|${hardEdge ? 1 : 0}|${fx}|${fy}`
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const stamp = buildStamp(rq, hq, hardEdge, fx, fy)
  if (cache.size >= CACHE_CAP) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, stamp)
  return stamp
}

export function stampCacheSize(): number {
  return cache.size
}

export function clearStampCache(): void {
  cache.clear()
}
