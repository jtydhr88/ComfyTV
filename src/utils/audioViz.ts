export interface CompressorParams {
  thresholdDb: number
  ratio: number
  kneeFactor: number
  makeupDb?: number
}

export function kneeWidthDb(kneeFactor: number): number {
  return 20 * Math.log10(Math.max(1, kneeFactor))
}

export function compressorTransferDb(inDb: number, p: CompressorParams): number {
  const w = kneeWidthDb(p.kneeFactor)
  const t = p.thresholdDb
  const slope = 1 / Math.max(1, p.ratio) - 1
  let out: number
  if (w <= 0 || inDb < t - w / 2) {
    out = inDb < t ? inDb : t + (inDb - t) / Math.max(1, p.ratio)
  } else if (inDb <= t + w / 2) {
    out = inDb + (slope * (inDb - t + w / 2) ** 2) / (2 * w)
  } else {
    out = inDb + slope * (inDb - t)
  }
  return out + (p.makeupDb ?? 0)
}

export function transferCurvePoints(
  p: CompressorParams, n = 121, minDb = -60, maxDb = 0,
): { x: number, y: number }[] {
  const pts: { x: number, y: number }[] = []
  for (let i = 0; i < n; i++) {
    const x = minDb + ((maxDb - minDb) * i) / (n - 1)
    pts.push({ x, y: compressorTransferDb(x, p) })
  }
  return pts
}

export function envelopeDb(
  samples: Float32Array, sampleRate: number, blockMs = 10,
): Float32Array {
  const block = Math.max(1, Math.round((sampleRate * blockMs) / 1000))
  const n = Math.ceil(samples.length / block)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let sum = 0
    const start = i * block
    const end = Math.min(samples.length, start + block)
    for (let j = start; j < end; j++) sum += samples[j] * samples[j]
    const rms = Math.sqrt(sum / Math.max(1, end - start))
    out[i] = rms > 0 ? Math.max(-90, 20 * Math.log10(rms)) : -90
  }
  return out
}

export function resampleEnvelope(env: Float32Array, width: number): Float32Array {
  const out = new Float32Array(width)
  if (env.length === 0) return out.fill(-90)
  for (let x = 0; x < width; x++) {
    const a = Math.floor((x * env.length) / width)
    const b = Math.max(a + 1, Math.floor(((x + 1) * env.length) / width))
    let m = -90
    for (let i = a; i < Math.min(b, env.length); i++) m = Math.max(m, env[i])
    out[x] = m
  }
  return out
}
