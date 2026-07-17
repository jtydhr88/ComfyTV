export interface RgbOffsets {
  r: number
  g: number
  b: number
}

const AX = [
  { x: Math.cos(Math.PI / 2), y: -Math.sin(Math.PI / 2) },
  { x: Math.cos((210 * Math.PI) / 180), y: -Math.sin((210 * Math.PI) / 180) },
  { x: Math.cos((330 * Math.PI) / 180), y: -Math.sin((330 * Math.PI) / 180) },
]

export function clampOffset(v: number): number {
  return Math.min(1, Math.max(-1, Math.round(v * 1000) / 1000))
}

export function fmtOffset(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(2)
}

export function offsetsToPuck(v: RgbOffsets): { x: number; y: number } {
  const x = (2 / 3) * (v.r * AX[0].x + v.g * AX[1].x + v.b * AX[2].x)
  const y = (2 / 3) * (v.r * AX[0].y + v.g * AX[1].y + v.b * AX[2].y)
  return { x, y }
}

export function puckToOffsets(x: number, y: number): RgbOffsets {
  const len = Math.hypot(x, y)
  if (len > 1) { x /= len; y /= len }
  return {
    r: clampOffset(x * AX[0].x + y * AX[0].y),
    g: clampOffset(x * AX[1].x + y * AX[1].y),
    b: clampOffset(x * AX[2].x + y * AX[2].y),
  }
}
