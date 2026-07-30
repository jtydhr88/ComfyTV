export type CurveKeys = Array<[number, number]>

export function parseCurve(raw: unknown): CurveKeys | null {
  let keys: unknown = raw
  if (typeof raw === 'string') {
    if (!raw.trim()) return null
    try {
      keys = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!Array.isArray(keys)) return null
  const out: CurveKeys = []
  for (const k of keys) {
    const t = Number((k as { t?: unknown })?.t)
    const v = Number((k as { v?: unknown })?.v)
    if (Number.isFinite(t) && Number.isFinite(v)) out.push([t, v])
  }
  if (out.length < 2) return null
  return out.sort((a, b) => a[0] - b[0])
}

export function sampleCurve(keys: CurveKeys, frac: number): number {
  if (frac <= keys[0][0]) return keys[0][1]
  if (frac >= keys[keys.length - 1][0]) return keys[keys.length - 1][1]
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i]
    const [t1, v1] = keys[i + 1]
    if (t0 <= frac && frac <= t1) {
      const u = (frac - t0) / Math.max(1e-9, t1 - t0)
      const s = u * u * (3 - 2 * u)
      return v0 + (v1 - v0) * s
    }
  }
  return keys[keys.length - 1][1]
}

export function curveLut(keys: CurveKeys, n = 64): Float64Array {
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) out[i] = sampleCurve(keys, i / (n - 1))
  return out
}
