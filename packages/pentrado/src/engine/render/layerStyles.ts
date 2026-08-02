import type { LayerFxData } from './layerFx'

/**
 * Photoshop-style layer effects operating on the layer's alpha shape.
 * All distance math uses the exact Euclidean distance transform
 * (Felzenszwalb & Huttenlocher), so strokes and bevels are round and
 * antialiased regardless of shape.
 */

const INF = 1e20

/** 1D squared-distance transform (Felzenszwalb), in place via out/v/z scratch. */
function edt1d(f: Float32Array, out: Float32Array, v: Int32Array, z: Float32Array, n: number): void {
  let k = 0
  v[0] = 0
  z[0] = -INF
  z[1] = INF
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) {
      k--
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = INF
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    out[q] = (q - v[k]) * (q - v[k]) + f[v[k]]
  }
}

/**
 * Euclidean distance (px) from every pixel to the nearest "inside" pixel.
 * `inside` gives per-pixel coverage in [0,1]; pixels at or above 0.5 count
 * as inside (distance 0), and the half-coverage boundary keeps sub-pixel
 * placement via the seed offset.
 */
export function distanceToShape(alpha: Float32Array, w: number, h: number): Float32Array {
  const n = w * h
  const f = new Float32Array(Math.max(w, h))
  const d = new Float32Array(n)
  for (let p = 0; p < n; p++) {
    // Seed: inside = 0; boundary pixels get a sub-pixel head start from
    // their coverage so antialiased edges stay smooth.
    const a = alpha[p]
    d[p] = a >= 0.5 ? 0 : a > 0 ? (0.5 - a) * (0.5 - a) : INF
  }
  const out = new Float32Array(Math.max(w, h))
  const v = new Int32Array(Math.max(w, h) + 1)
  const z = new Float32Array(Math.max(w, h) + 2)
  // Columns
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = d[y * w + x]
    edt1d(f, out, v, z, h)
    for (let y = 0; y < h; y++) d[y * w + x] = out[y]
  }
  // Rows
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = d[y * w + x]
    edt1d(f, out, v, z, w)
    for (let x = 0; x < w; x++) d[y * w + x] = Math.sqrt(out[x])
  }
  return d
}

export function alphaOf(img: ImageData): Float32Array {
  const n = img.width * img.height
  const a = new Float32Array(n)
  for (let p = 0; p < n; p++) a[p] = img.data[p * 4 + 3] / 255
  return a
}

function invert(a: Float32Array): Float32Array {
  const out = new Float32Array(a.length)
  for (let p = 0; p < a.length; p++) out[p] = 1 - a[p]
  return out
}

function unpackColor(color: number): [number, number, number] {
  return [(color >> 16) & 255, (color >> 8) & 255, color & 255]
}

/** Composite `src` (straight alpha arrays) over `img` in place. */
function overInPlace(img: ImageData, srcA: Float32Array, cr: number, cg: number, cb: number): void {
  const d = img.data
  for (let p = 0; p < srcA.length; p++) {
    const sa = srcA[p]
    if (sa <= 0) continue
    const i = p * 4
    const da = d[i + 3] / 255
    const oa = sa + da * (1 - sa)
    if (oa <= 0) continue
    d[i] = Math.round((cr * sa + d[i] * da * (1 - sa)) / oa)
    d[i + 1] = Math.round((cg * sa + d[i + 1] * da * (1 - sa)) / oa)
    d[i + 2] = Math.round((cb * sa + d[i + 2] * da * (1 - sa)) / oa)
    d[i + 3] = Math.round(oa * 255)
  }
}

/** Composite `img` over a colored source (dest-over): the effect sits BELOW the layer. */
function underInPlace(img: ImageData, srcA: Float32Array, cr: number, cg: number, cb: number): void {
  const d = img.data
  for (let p = 0; p < srcA.length; p++) {
    const sa = srcA[p]
    if (sa <= 0) continue
    const i = p * 4
    const da = d[i + 3] / 255
    const oa = da + sa * (1 - da)
    if (oa <= 0) continue
    d[i] = Math.round((d[i] * da + cr * sa * (1 - da)) / oa)
    d[i + 1] = Math.round((d[i + 1] * da + cg * sa * (1 - da)) / oa)
    d[i + 2] = Math.round((d[i + 2] * da + cb * sa * (1 - da)) / oa)
    d[i + 3] = Math.round(oa * 255)
  }
}

/** Stroke: position 0=outside, 1=inside, 2=center. */
export function applyStroke(img: ImageData, params: Record<string, number>): void {
  const w = img.width
  const h = img.height
  const size = Math.max(0, params.size ?? 4)
  if (size <= 0) return
  const position = Math.round(params.position ?? 0)
  const [cr, cg, cb] = unpackColor(params.color ?? 0)
  const opacity = Math.max(0, Math.min(1, params.strokeOpacity ?? 1))
  const alpha = alphaOf(img)
  const distOut = distanceToShape(alpha, w, h)
  const distIn = distanceToShape(invert(alpha), w, h)
  const band = new Float32Array(w * h)
  for (let p = 0; p < band.length; p++) {
    // Signed distance: negative inside the shape.
    const sd = alpha[p] >= 0.5 ? -distIn[p] : distOut[p]
    let lo: number
    let hi: number
    if (position === 1) {
      lo = -size
      hi = 0
    } else if (position === 2) {
      lo = -size / 2
      hi = size / 2
    } else {
      lo = 0
      hi = size
    }
    // 1px antialiased band edges.
    const cov = Math.min(sd - lo + 0.5, hi - sd + 0.5)
    band[p] = Math.max(0, Math.min(1, cov)) * opacity
  }
  overInPlace(img, band, cr, cg, cb)
}

export function applyColorOverlay(img: ImageData, params: Record<string, number>): void {
  const [cr, cg, cb] = unpackColor(params.color ?? 0xff0000)
  const t = Math.max(0, Math.min(1, params.overlayOpacity ?? 1))
  const d = img.data
  for (let p = 0; p < img.width * img.height; p++) {
    const i = p * 4
    if (d[i + 3] === 0) continue
    d[i] = Math.round(d[i] + (cr - d[i]) * t)
    d[i + 1] = Math.round(d[i + 1] + (cg - d[i + 1]) * t)
    d[i + 2] = Math.round(d[i + 2] + (cb - d[i + 2]) * t)
  }
}

/** Distance-falloff glow alpha: 1 at the edge, 0 at `size`. */
function glowBand(dist: Float32Array, size: number, opacity: number): Float32Array {
  const out = new Float32Array(dist.length)
  const s = Math.max(0.01, size)
  for (let p = 0; p < dist.length; p++) {
    const d = dist[p]
    if (d <= 0 || d >= s) continue
    const t = 1 - d / s
    out[p] = t * t * opacity
  }
  return out
}

export function applyOuterGlow(img: ImageData, params: Record<string, number>): void {
  const size = Math.max(0, params.size ?? 12)
  if (size <= 0) return
  const [cr, cg, cb] = unpackColor(params.color ?? 0xffe680)
  const opacity = Math.max(0, Math.min(1, params.glowOpacity ?? 0.75))
  const alpha = alphaOf(img)
  const dist = distanceToShape(alpha, img.width, img.height)
  underInPlace(img, glowBand(dist, size, opacity), cr, cg, cb)
}

export function applyInnerGlow(img: ImageData, params: Record<string, number>): void {
  const size = Math.max(0, params.size ?? 12)
  if (size <= 0) return
  const [cr, cg, cb] = unpackColor(params.color ?? 0xffe680)
  const opacity = Math.max(0, Math.min(1, params.glowOpacity ?? 0.75))
  const alpha = alphaOf(img)
  const distIn = distanceToShape(invert(alpha), img.width, img.height)
  const band = glowBand(distIn, size, opacity)
  // Clip to the shape so the glow never spills outside.
  for (let p = 0; p < band.length; p++) band[p] *= alpha[p]
  overInPlace(img, band, cr, cg, cb)
}

export function applyInnerShadow(img: ImageData, params: Record<string, number>): void {
  const w = img.width
  const h = img.height
  const size = Math.max(0.01, params.size ?? 8)
  const dx = Math.round(params.x ?? 4)
  const dy = Math.round(params.y ?? 4)
  const [cr, cg, cb] = unpackColor(params.color ?? 0)
  const opacity = Math.max(0, Math.min(1, params.shadowOpacity ?? 0.6))
  const alpha = alphaOf(img)
  // Distance to the OUTSIDE, sampled with the shadow offset: pixels near the
  // edge on the light-facing side pick up shadow.
  const distIn = distanceToShape(invert(alpha), w, h)
  const band = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      if (alpha[p] <= 0) continue
      const sx = Math.max(0, Math.min(w - 1, x - dx))
      const sy = Math.max(0, Math.min(h - 1, y - dy))
      const d = distIn[sy * w + sx]
      if (d >= size) continue
      const t = 1 - d / size
      band[p] = t * t * opacity * alpha[p]
    }
  }
  overInPlace(img, band, cr, cg, cb)
}

/** Inner bevel: highlight/shadow from the inner distance field's gradient. */
export function applyBevel(img: ImageData, params: Record<string, number>): void {
  const w = img.width
  const h = img.height
  const size = Math.max(1, params.size ?? 6)
  const depth = Math.max(0, Math.min(1, params.depth ?? 0.5))
  const angle = (((params.angle ?? 120) * Math.PI) / 180)
  const lx = Math.cos(angle)
  const ly = -Math.sin(angle)
  const alpha = alphaOf(img)
  const distIn = distanceToShape(invert(alpha), w, h)
  const d = img.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      if (alpha[p] <= 0) continue
      const di = distIn[p]
      if (di >= size) continue
      const xl = Math.max(0, x - 1)
      const xr = Math.min(w - 1, x + 1)
      const yu = Math.max(0, y - 1)
      const yd = Math.min(h - 1, y + 1)
      const gx = (distIn[y * w + xr] - distIn[y * w + xl]) / 2
      const gy = (distIn[yd * w + x] - distIn[yu * w + x]) / 2
      const len = Math.hypot(gx, gy)
      if (len < 1e-4) continue
      // Outward normal = -grad(distIn); highlight where it faces the light.
      const shade = -((gx / len) * lx + (gy / len) * ly) * (1 - di / size) * depth * alpha[p]
      const i = p * 4
      if (shade > 0) {
        d[i] = Math.round(d[i] + (255 - d[i]) * shade)
        d[i + 1] = Math.round(d[i + 1] + (255 - d[i + 1]) * shade)
        d[i + 2] = Math.round(d[i + 2] + (255 - d[i + 2]) * shade)
      } else if (shade < 0) {
        const s = 1 + shade
        d[i] = Math.round(d[i] * s)
        d[i + 1] = Math.round(d[i + 1] * s)
        d[i + 2] = Math.round(d[i + 2] * s)
      }
    }
  }
}

export function applyLayerStyle(img: ImageData, f: LayerFxData): void {
  switch (f.op) {
    case 'stroke':
      applyStroke(img, f.params)
      break
    case 'color-overlay':
      applyColorOverlay(img, f.params)
      break
    case 'outer-glow':
      applyOuterGlow(img, f.params)
      break
    case 'inner-glow':
      applyInnerGlow(img, f.params)
      break
    case 'inner-shadow':
      applyInnerShadow(img, f.params)
      break
    case 'bevel':
      applyBevel(img, f.params)
      break
  }
}
