export type CurvePoints = [number, number][]

export const CURVES_W = 240
export const CURVES_H = 160
export const CURVES_PAD = 6

export function normalizeCurvePoints(raw: [number, number][] | null | undefined): CurvePoints {
  const p = (raw ?? []).slice() as CurvePoints
  if (p.length < 2) return [[0, 0], [1, 1]]
  return p.sort((a, b) => a[0] - b[0])
}

export function splineM(p: CurvePoints): number[] {
  const n = p.length
  const m = new Array(n).fill(0)
  if (n < 3) return m
  const a = new Array(n).fill(0)
  const b = new Array(n).fill(0)
  const c = new Array(n).fill(0)
  const d = new Array(n).fill(0)
  for (let i = 1; i < n - 1; i++) {
    const h0 = p[i][0] - p[i - 1][0]
    const h1 = p[i + 1][0] - p[i][0]
    a[i] = h0
    b[i] = 2 * (h0 + h1)
    c[i] = h1
    d[i] = 6 * ((p[i + 1][1] - p[i][1]) / (h1 || 1e-6) - (p[i][1] - p[i - 1][1]) / (h0 || 1e-6))
  }
  for (let i = 2; i < n - 1; i++) {
    const w = a[i] / (b[i - 1] || 1e-6)
    b[i] -= w * c[i - 1]
    d[i] -= w * d[i - 1]
  }
  for (let i = n - 2; i >= 1; i--) {
    m[i] = (d[i] - c[i] * m[i + 1]) / (b[i] || 1e-6)
  }
  return m
}

export function evalSpline(p: CurvePoints, m: number[], x: number): number {
  if (x <= p[0][0]) return p[0][1]
  if (x >= p[p.length - 1][0]) return p[p.length - 1][1]
  let i = 0
  while (i < p.length - 2 && x > p[i + 1][0]) i++
  const h = p[i + 1][0] - p[i][0] || 1e-6
  const t0 = (p[i + 1][0] - x) / h
  const t1 = (x - p[i][0]) / h
  const y = t0 * p[i][1] + t1 * p[i + 1][1]
    + ((t0 * t0 * t0 - t0) * m[i] + (t1 * t1 * t1 - t1) * m[i + 1]) * (h * h) / 6
  return Math.min(1, Math.max(0, y))
}

export function toPx(x: number, y: number): [number, number] {
  return [
    CURVES_PAD + x * (CURVES_W - 2 * CURVES_PAD),
    CURVES_H - CURVES_PAD - y * (CURVES_H - 2 * CURVES_PAD),
  ]
}

export function fromPx(px: number, py: number): [number, number] {
  return [
    Math.min(1, Math.max(0, (px - CURVES_PAD) / (CURVES_W - 2 * CURVES_PAD))),
    Math.min(1, Math.max(0, (CURVES_H - CURVES_PAD - py) / (CURVES_H - 2 * CURVES_PAD))),
  ]
}
