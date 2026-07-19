export interface ImageDataLike {
  data: Uint8ClampedArray
  width: number
  height: number
}

export type ScopeKind = 'waveform' | 'waveform_parade' | 'vectorscope' | 'histogram'

export const SCOPE_BINS = 256

export interface WaveformDensity {
  width: number
  channels: 1 | 3
  data: Uint32Array
}

export interface HistogramData {
  r: Uint32Array
  g: Uint32Array
  b: Uint32Array
}

function clampByte(v: number): number {
  const r = Math.round(v)
  return r < 0 ? 0 : r > 255 ? 255 : r
}

export function lumaBt601(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

export function rgbToCbCr(r: number, g: number, b: number): [number, number] {
  return [
    -0.168736 * r - 0.331264 * g + 0.5 * b + 128,
    0.5 * r - 0.418688 * g - 0.081312 * b + 128,
  ]
}

export function computeWaveform(img: ImageDataLike, mode: 'luma' | 'parade'): WaveformDensity {
  const { data, width, height } = img
  const channels = mode === 'parade' ? 3 : 1
  const out = new Uint32Array(channels * width * SCOPE_BINS)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (mode === 'luma') {
        const l = clampByte(lumaBt601(data[i], data[i + 1], data[i + 2]))
        out[x * SCOPE_BINS + l]++
      } else {
        for (let c = 0; c < 3; c++) {
          out[(c * width + x) * SCOPE_BINS + data[i + c]]++
        }
      }
    }
  }
  return { width, channels, data: out }
}

export function computeVectorscope(img: ImageDataLike): Uint32Array {
  const { data, width, height } = img
  const out = new Uint32Array(SCOPE_BINS * SCOPE_BINS)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const [cb, cr] = rgbToCbCr(data[i], data[i + 1], data[i + 2])
      out[clampByte(cr) * SCOPE_BINS + clampByte(cb)]++
    }
  }
  return out
}

export interface VectorscopeTarget {
  label: string
  u: number
  v: number
}

const TARGET_COLORS: Array<[string, number, number, number]> = [
  ['R', 1, 0, 0],
  ['Yl', 1, 1, 0],
  ['G', 0, 1, 0],
  ['Cy', 0, 1, 1],
  ['B', 0, 0, 1],
  ['Mg', 1, 0, 1],
]

export function vectorscopeTargets(level = 0.75): VectorscopeTarget[] {
  return TARGET_COLORS.map(([label, r, g, b]) => {
    const [u, v] = rgbToCbCr(r * level * 255, g * level * 255, b * level * 255)
    return { label, u: clampByte(u), v: clampByte(v) }
  })
}

export function computeHistogram(img: ImageDataLike): HistogramData {
  const { data, width, height } = img
  const r = new Uint32Array(SCOPE_BINS)
  const g = new Uint32Array(SCOPE_BINS)
  const b = new Uint32Array(SCOPE_BINS)
  const n = width * height * 4
  for (let i = 0; i < n; i += 4) {
    r[data[i]]++
    g[data[i + 1]]++
    b[data[i + 2]]++
  }
  return { r, g, b }
}

function intensity(count: number, logMax: number): number {
  if (count <= 0) return 0
  return 0.3 + 0.7 * (Math.log1p(count) / logMax)
}

function logMaxOf(data: Uint32Array): number {
  let max = 0
  for (let i = 0; i < data.length; i++) if (data[i] > max) max = data[i]
  return Math.log1p(Math.max(max, 1))
}

function rangeMax(data: Uint32Array, lo: number, hi: number): number {
  let max = data[lo] ?? 0
  for (let i = lo + 1; i < hi; i++) if (data[i] > max) max = data[i]
  return max
}

const WAVEFORM_TINTS: Array<[number, number, number]> = [
  [255, 70, 70],
  [70, 255, 70],
  [90, 150, 255],
]

export function renderWaveformPixels(wf: WaveformDensity, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4)
  const logMax = logMaxOf(wf.data)
  const panelW = Math.floor(w / wf.channels)
  for (let ch = 0; ch < wf.channels; ch++) {
    const [tr, tg, tb] = wf.channels === 1 ? [110, 255, 110] : WAVEFORM_TINTS[ch]
    const x0 = ch * panelW
    for (let x = 0; x < panelW; x++) {
      const colLo = Math.floor((x * wf.width) / panelW)
      const colHi = Math.max(colLo + 1, Math.floor(((x + 1) * wf.width) / panelW))
      for (let y = 0; y < h; y++) {
        const binLo = Math.floor(((h - 1 - y) * SCOPE_BINS) / h)
        const binHi = Math.max(binLo + 1, Math.floor(((h - y) * SCOPE_BINS) / h))
        let count = 0
        for (let col = colLo; col < colHi; col++) {
          const base = (ch * wf.width + col) * SCOPE_BINS
          const m = rangeMax(wf.data, base + binLo, base + binHi)
          if (m > count) count = m
        }
        const v = intensity(count, logMax)
        if (v <= 0) continue
        const o = (y * w + x0 + x) * 4
        out[o] = tr * v
        out[o + 1] = tg * v
        out[o + 2] = tb * v
        out[o + 3] = 255
      }
    }
  }
  return out
}

export function renderVectorscopePixels(density: Uint32Array, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4)
  const logMax = logMaxOf(density)
  const side = Math.min(w, h)
  const offX = Math.floor((w - side) / 2)
  const offY = Math.floor((h - side) / 2)
  const graticule = new Float32Array(SCOPE_BINS * SCOPE_BINS)
  for (const t of vectorscopeTargets()) {
    for (let d = -3; d <= 3; d++) {
      graticule[t.v * SCOPE_BINS + clampByte(t.u + d)] = 1
      graticule[clampByte(t.v + d) * SCOPE_BINS + t.u] = 1
    }
  }
  for (let d = -5; d <= 5; d++) {
    graticule[128 * SCOPE_BINS + 128 + d] = 0.6
    graticule[(128 + d) * SCOPE_BINS + 128] = 0.6
  }
  for (let y = 0; y < side; y++) {
    const cr = SCOPE_BINS - 1 - Math.floor((y * SCOPE_BINS) / side)
    for (let x = 0; x < side; x++) {
      const cb = Math.floor((x * SCOPE_BINS) / side)
      const idx = cr * SCOPE_BINS + cb
      const v = intensity(density[idx], logMax)
      const gv = graticule[idx]
      const o = ((y + offY) * w + x + offX) * 4
      if (v > 0) {
        out[o] = 255 * v
        out[o + 1] = 255 * v
        out[o + 2] = 255 * v
        out[o + 3] = 255
      } else if (gv > 0) {
        out[o] = 40 * gv
        out[o + 1] = 130 * gv
        out[o + 2] = 40 * gv
        out[o + 3] = 255
      }
    }
  }
  return out
}

export function renderHistogramPixels(hist: HistogramData, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4)
  const channels: Array<[Uint32Array, number]> = [[hist.r, 0], [hist.g, 1], [hist.b, 2]]
  const logMax = Math.max(logMaxOf(hist.r), logMaxOf(hist.g), logMaxOf(hist.b))
  for (let x = 0; x < w; x++) {
    const binLo = Math.floor((x * SCOPE_BINS) / w)
    const binHi = Math.max(binLo + 1, Math.floor(((x + 1) * SCOPE_BINS) / w))
    for (const [data, ch] of channels) {
      const count = rangeMax(data, binLo, binHi)
      const barH = Math.round(intensity(count, logMax) * h)
      for (let y = h - barH; y < h; y++) {
        const o = (y * w + x) * 4
        out[o + ch] = Math.min(255, out[o + ch] + 220)
        out[o + 3] = 255
      }
    }
  }
  return out
}

export function renderScopePixels(
  kind: ScopeKind,
  img: ImageDataLike,
  w: number,
  h: number,
): Uint8ClampedArray {
  if (kind === 'vectorscope') return renderVectorscopePixels(computeVectorscope(img), w, h)
  if (kind === 'histogram') return renderHistogramPixels(computeHistogram(img), w, h)
  return renderWaveformPixels(
    computeWaveform(img, kind === 'waveform_parade' ? 'parade' : 'luma'), w, h,
  )
}

export function drawScope(
  ctx: CanvasRenderingContext2D,
  kind: ScopeKind,
  img: ImageDataLike,
  w: number,
  h: number,
): void {
  const pixels = renderScopePixels(kind, img, w, h)
  const frame = ctx.createImageData(w, h)
  frame.data.set(pixels)
  ctx.putImageData(frame, 0, 0)
}
