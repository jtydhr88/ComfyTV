import type { Rect } from '../node'
import { emptyMask, type GrayMask } from './selectionMask'

function vanHerk(line: Float32Array, out: Float32Array, n: number, radius: number, pick: (a: number, b: number) => number, pad: number): void {
  const w = 2 * radius + 1
  const fwd = new Float32Array(n)
  const bwd = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    fwd[i] = i % w === 0 ? line[i] : pick(fwd[i - 1], line[i])
  }
  for (let i = n - 1; i >= 0; i--) {
    bwd[i] = i % w === w - 1 || i === n - 1 ? line[i] : pick(bwd[i + 1], line[i])
  }
  for (let i = 0; i < n; i++) {
    const lo = i - radius
    const hi = i + radius
    const a = hi < n ? fwd[hi] : pad
    const b = lo >= 0 ? bwd[lo] : pad
    out[i] = hi < n && lo >= 0 ? pick(a, b) : pick(pick(hi < n ? a : pad, lo >= 0 ? b : pad), pad)
  }
}

function verticalFilter(mask: GrayMask, radius: number, pick: (a: number, b: number) => number, pad: number): GrayMask {
  const out = emptyMask(mask.width, mask.height)
  const col = new Float32Array(mask.height)
  const res = new Float32Array(mask.height)
  for (let x = 0; x < mask.width; x++) {
    for (let y = 0; y < mask.height; y++) col[y] = mask.data[y * mask.width + x]
    vanHerk(col, res, mask.height, radius, pick, pad)
    for (let y = 0; y < mask.height; y++) out.data[y * mask.width + x] = res[y]
  }
  return out
}

function ellipticalFilter(mask: GrayMask, radius: number, pick: (a: number, b: number) => number, pad: number): GrayMask {
  const r = Math.max(1, Math.round(radius))
  const circ = new Int32Array(2 * r + 1)
  for (let i = -r; i <= r; i++) {
    const t = Math.max(0, Math.abs(i) - 0.5)
    circ[i + r] = Math.round(Math.sqrt(Math.max(0, r * r - t * t)))
  }
  const byHeight = new Map<number, GrayMask>()
  for (const h of circ) {
    if (!byHeight.has(h)) byHeight.set(h, h === 0 ? mask : verticalFilter(mask, h, pick, pad))
  }
  const out = emptyMask(mask.width, mask.height)
  for (let y = 0; y < mask.height; y++) {
    const row = y * mask.width
    for (let x = 0; x < mask.width; x++) {
      let v: number | null = null
      for (let i = -r; i <= r; i++) {
        const xx = x + i
        const src = xx >= 0 && xx < mask.width ? byHeight.get(circ[i + r])!.data[row + xx] : pad
        v = v === null ? src : pick(v, src)
      }
      out.data[row + x] = v ?? pad
    }
  }
  return out
}

function cropMask(mask: GrayMask, r: Rect): GrayMask {
  const out = emptyMask(r.w, r.h)
  for (let y = 0; y < r.h; y++) {
    const src = (r.y + y) * mask.width + r.x
    out.data.set(mask.data.subarray(src, src + r.w), y * r.w)
  }
  return out
}

function pasteMask(sub: GrayMask, r: Rect, width: number, height: number): GrayMask {
  const out = emptyMask(width, height)
  for (let y = 0; y < r.h; y++) {
    out.data.set(sub.data.subarray(y * r.w, y * r.w + r.w), (r.y + y) * width + r.x)
  }
  return out
}

function withBounds(
  mask: GrayMask,
  bounds: Rect | null | undefined,
  pad: number,
  run: (m: GrayMask) => GrayMask
): GrayMask {
  if (!bounds) return run(mask)
  const x0 = Math.max(0, Math.floor(bounds.x - pad))
  const y0 = Math.max(0, Math.floor(bounds.y - pad))
  const x1 = Math.min(mask.width, Math.ceil(bounds.x + bounds.w + pad))
  const y1 = Math.min(mask.height, Math.ceil(bounds.y + bounds.h + pad))
  if (x1 <= x0 || y1 <= y0) return emptyMask(mask.width, mask.height)
  const rect: Rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  if (rect.x === 0 && rect.y === 0 && rect.w === mask.width && rect.h === mask.height) return run(mask)
  return pasteMask(run(cropMask(mask, rect)), rect, mask.width, mask.height)
}

export function growMask(mask: GrayMask, radius: number, bounds: Rect | null = null): GrayMask {
  return withBounds(mask, bounds, Math.round(radius) + 1, (m) => ellipticalFilter(m, radius, Math.max, 0))
}

export function shrinkMask(mask: GrayMask, radius: number, bounds: Rect | null = null): GrayMask {
  return withBounds(mask, bounds, Math.round(radius) + 1, (m) => ellipticalFilter(m, radius, Math.min, 0))
}

export function borderMask(mask: GrayMask, radius: number, bounds: Rect | null = null): GrayMask {
  return withBounds(mask, bounds, Math.round(radius) + 1, (m) => {
    const grown = ellipticalFilter(m, radius, Math.max, 0)
    const shrunk = ellipticalFilter(m, radius, Math.min, 0)
    const out = emptyMask(m.width, m.height)
    for (let p = 0; p < out.data.length; p++) {
      out.data[p] = Math.max(grown.data[p] - shrunk.data[p], 0)
    }
    return out
  })
}

function boxBlurPass(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const norm = 1 / (2 * r + 1)
  for (let y = 0; y < h; y++) {
    const row = y * w
    let acc = 0
    for (let i = -r; i <= r; i++) acc += src[row + Math.max(0, Math.min(w - 1, i))]
    for (let x = 0; x < w; x++) {
      dst[row + x] = acc * norm
      const outIdx = Math.max(0, Math.min(w - 1, x - r))
      const inIdx = Math.max(0, Math.min(w - 1, x + r + 1))
      acc += src[row + inIdx] - src[row + outIdx]
    }
  }
}

function transposeMask(mask: GrayMask): GrayMask {
  const out = { data: new Float32Array(mask.data.length), width: mask.height, height: mask.width }
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      out.data[x * mask.height + y] = mask.data[y * mask.width + x]
    }
  }
  return out
}

function boxesForGauss(sigma: number, n: number): number[] {
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1)
  let wl = Math.floor(wIdeal)
  if (wl % 2 === 0) wl--
  const wu = wl + 2
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4)
  const m = Math.round(mIdeal)
  const sizes: number[] = []
  for (let i = 0; i < n; i++) sizes.push(i < m ? wl : wu)
  return sizes
}

export function featherMask(mask: GrayMask, radius: number, bounds: Rect | null = null): GrayMask {
  return withBounds(mask, bounds, Math.ceil(radius) + 2, (m) => featherMaskFull(m, radius))
}

function smallGaussian(mask: GrayMask, sigma: number): GrayMask {
  const r = 2
  const kernel = new Float32Array(2 * r + 1)
  let sum = 0
  for (let i = -r; i <= r; i++) {
    kernel[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma))
    sum += kernel[i + r]
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum
  const pass = (m: GrayMask): GrayMask => {
    const out = emptyMask(m.width, m.height)
    for (let y = 0; y < m.height; y++) {
      const row = y * m.width
      for (let x = 0; x < m.width; x++) {
        let acc = 0
        for (let i = -r; i <= r; i++) {
          const xx = Math.max(0, Math.min(m.width - 1, x + i))
          acc += m.data[row + xx] * kernel[i + r]
        }
        out.data[row + x] = acc
      }
    }
    return out
  }
  return transposeMask(pass(transposeMask(pass(mask))))
}

function featherMaskFull(mask: GrayMask, radius: number): GrayMask {
  const sigma = radius / 3.5
  if (sigma <= 0) return mask
  const boxes = boxesForGauss(sigma, 3)
  if (boxes.every((size) => Math.round((size - 1) / 2) < 1)) return smallGaussian(mask, sigma)
  const sizes = boxes
  let cur: GrayMask = { data: Float32Array.from(mask.data), width: mask.width, height: mask.height }
  const blurAxis = (m: GrayMask): GrayMask => {
    const tmp = new Float32Array(m.data.length)
    let src = m.data
    for (const size of sizes) {
      const r = Math.max(0, (size - 1) / 2)
      if (r < 1) continue
      boxBlurPass(src, tmp, m.width, m.height, Math.round(r))
      src = Float32Array.from(tmp)
    }
    return { data: src, width: m.width, height: m.height }
  }
  cur = blurAxis(cur)
  cur = transposeMask(blurAxis(transposeMask(cur)))
  return cur
}
