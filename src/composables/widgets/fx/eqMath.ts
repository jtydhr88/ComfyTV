export interface EqBand {
  type: 'peak' | 'highpass' | 'lowpass' | 'lowshelf' | 'highshelf'
  f: number
  g: number
  q: number
}

export const EQ_W = 260
export const EQ_H = 140
export const EQ_FS = 44100
export const EQ_FMIN = 20
export const EQ_FMAX = 20000
export const EQ_GMAX = 24

export const BAND_COLORS = ['#ffb74d', '#4fc3f7', '#aed581', '#f06292', '#ba68c8', '#fff176']

export function freqToX(f: number): number {
  return (Math.log10(f / EQ_FMIN) / Math.log10(EQ_FMAX / EQ_FMIN)) * EQ_W
}

export function xToFreq(x: number): number {
  return EQ_FMIN * Math.pow(EQ_FMAX / EQ_FMIN, x / EQ_W)
}

export function gainToY(g: number): number {
  return EQ_H / 2 - (g / EQ_GMAX) * (EQ_H / 2 - 8)
}

export function yToGain(y: number): number {
  return ((EQ_H / 2 - y) / (EQ_H / 2 - 8)) * EQ_GMAX
}

export function peakDb(band: EqBand, f: number): number {
  const A = Math.pow(10, band.g / 40)
  const w0 = (2 * Math.PI * band.f) / EQ_FS
  const alpha = Math.sin(w0) / (2 * Math.max(0.1, band.q))
  const b0 = 1 + alpha * A
  const b1 = -2 * Math.cos(w0)
  const b2 = 1 - alpha * A
  const a0 = 1 + alpha / A
  const a1 = b1
  const a2 = 1 - alpha / A
  const w = (2 * Math.PI * f) / EQ_FS
  const cw = Math.cos(w), c2w = Math.cos(2 * w)
  const num = (b0 * b0 + b1 * b1 + b2 * b2) + 2 * (b0 * b1 + b1 * b2) * cw + 2 * b0 * b2 * c2w
  const den = (a0 * a0 + a1 * a1 + a2 * a2) + 2 * (a0 * a1 + a1 * a2) * cw + 2 * a0 * a2 * c2w
  return 10 * Math.log10(Math.max(1e-12, num / den))
}

export function bandDb(band: EqBand, f: number): number {
  switch (band.type) {
    case 'peak': return peakDb(band, f)
    case 'highpass': return f >= band.f ? 0 : Math.max(-40, -12 * Math.log2(band.f / f))
    case 'lowpass': return f <= band.f ? 0 : Math.max(-40, -12 * Math.log2(f / band.f))
    case 'lowshelf': {
      const t = 1 / (1 + Math.pow(f / band.f, 2))
      return band.g * t
    }
    case 'highshelf': {
      const t = 1 / (1 + Math.pow(band.f / f, 2))
      return band.g * t
    }
  }
  return 0
}
