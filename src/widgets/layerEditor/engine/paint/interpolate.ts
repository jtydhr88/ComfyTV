import type { Vec2 } from '../node'

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export interface StepResult {
  dabs: Vec2[]
  carry: number
}

export function stepStroke(from: Vec2, to: Vec2, spacingPx: number, carry: number): StepResult {
  const s = Math.max(0.5, spacingPx)
  const segLen = dist(from, to)
  if (segLen <= 1e-9) return { dabs: [], carry }

  const dabs: Vec2[] = []
  const total = carry + segLen
  const n = Math.floor(total / s)
  for (let k = 1; k <= n; k++) {
    const t = (k * s - carry) / segLen
    dabs.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })
  }
  return { dabs, carry: total - n * s }
}
