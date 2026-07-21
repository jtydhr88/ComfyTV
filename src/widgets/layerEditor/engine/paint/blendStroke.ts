export interface StrokeParams {
  mode: 'brush' | 'eraser'
  channel: 'content' | 'mask'
  color: [number, number, number]
  opacity: number
}

export function compositeStroke(
  base: Uint8ClampedArray,
  cov: Float32Array,
  params: StrokeParams
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(base.length)
  const { mode, channel, color, opacity } = params

  for (let p = 0, i = 0; p < cov.length; p++, i += 4) {
    const a = cov[p] * opacity
    const br = base[i]
    const bg = base[i + 1]
    const bb = base[i + 2]
    const ba = base[i + 3]

    if (channel === 'mask') {
      const v = br
      const nv = mode === 'brush' ? Math.max(v, a * 255) : v * (1 - a)
      out[i] = out[i + 1] = out[i + 2] = nv
      out[i + 3] = 255
      continue
    }

    if (mode === 'eraser') {
      out[i] = br
      out[i + 1] = bg
      out[i + 2] = bb
      out[i + 3] = ba * (1 - a)
      continue
    }

    const baN = ba / 255
    const outA = a + baN * (1 - a)
    if (outA <= 0) {
      out[i] = out[i + 1] = out[i + 2] = 0
      out[i + 3] = 0
      continue
    }
    out[i] = (color[0] * a + br * baN * (1 - a)) / outA
    out[i + 1] = (color[1] * a + bg * baN * (1 - a)) / outA
    out[i + 2] = (color[2] * a + bb * baN * (1 - a)) / outA
    out[i + 3] = outA * 255
  }
  return out
}
