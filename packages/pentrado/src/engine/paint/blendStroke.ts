export interface StrokeParams {
  mode: 'brush' | 'eraser'
  channel: 'content' | 'mask'
  color: [number, number, number]
  opacity: number
  lockAlpha?: boolean
  bgColor?: [number, number, number]
}

export interface StrokeRect {
  x0: number
  y0: number
  x1: number
  y1: number
}

function srgbByteToLinear(v: number): number {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function linearToSrgbByte(v: number): number {
  const c = Math.max(0, Math.min(1, v))
  return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)
}

export function maskGrayFromColor(color: [number, number, number]): number {
  const y =
    0.2126 * srgbByteToLinear(color[0]) +
    0.7152 * srgbByteToLinear(color[1]) +
    0.0722 * srgbByteToLinear(color[2])
  return linearToSrgbByte(y)
}

function blendPixel(
  out: Uint8ClampedArray,
  base: Uint8ClampedArray,
  i: number,
  a: number,
  params: StrokeParams
): void {
  const { mode, channel, color, lockAlpha } = params
  const br = base[i]
  const bg = base[i + 1]
  const bb = base[i + 2]
  const ba = base[i + 3]

  if (channel === 'mask') {
    const g = mode === 'brush' ? maskGrayFromColor(color) : 255
    const nv = g * a + br * (1 - a)
    out[i] = out[i + 1] = out[i + 2] = nv
    out[i + 3] = 255
    return
  }

  if (mode === 'eraser') {
    if (lockAlpha && params.bgColor) {
      out[i] = params.bgColor[0] * a + br * (1 - a)
      out[i + 1] = params.bgColor[1] * a + bg * (1 - a)
      out[i + 2] = params.bgColor[2] * a + bb * (1 - a)
      out[i + 3] = ba
      return
    }
    out[i] = br
    out[i + 1] = bg
    out[i + 2] = bb
    out[i + 3] = lockAlpha ? ba : ba * (1 - a)
    return
  }

  if (lockAlpha) {
    out[i] = color[0] * a + br * (1 - a)
    out[i + 1] = color[1] * a + bg * (1 - a)
    out[i + 2] = color[2] * a + bb * (1 - a)
    out[i + 3] = ba
    return
  }

  const baN = ba / 255
  const outA = a + baN * (1 - a)
  if (outA <= 0) {
    out[i] = out[i + 1] = out[i + 2] = 0
    out[i + 3] = 0
    return
  }
  out[i] = (color[0] * a + br * baN * (1 - a)) / outA
  out[i + 1] = (color[1] * a + bg * baN * (1 - a)) / outA
  out[i + 2] = (color[2] * a + bb * baN * (1 - a)) / outA
  out[i + 3] = outA * 255
}

export function compositeStroke(
  base: Uint8ClampedArray,
  cov: Float32Array,
  params: StrokeParams,
  selection?: Float32Array | null
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(base.length)
  for (let p = 0, i = 0; p < cov.length; p++, i += 4) {
    const a = cov[p] * params.opacity * (selection ? selection[p] : 1)
    blendPixel(out, base, i, a, params)
  }
  return out
}

export function compositeStrokeRect(
  out: Uint8ClampedArray,
  base: Uint8ClampedArray,
  covAt: (x: number, y: number) => number,
  params: StrokeParams,
  width: number,
  rect: StrokeRect,
  selection?: Float32Array | null
): void {
  for (let y = rect.y0; y <= rect.y1; y++) {
    for (let x = rect.x0; x <= rect.x1; x++) {
      const p = y * width + x
      const a = covAt(x, y) * params.opacity * (selection ? selection[p] : 1)
      blendPixel(out, base, p * 4, a, params)
    }
  }
}
