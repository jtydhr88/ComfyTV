export type Mat3 = [number, number, number, number, number, number,
  number, number, number]

export interface VideoTransformParams {
  posX: number
  posY: number
  scale: number
  rotation: number
  skewX: number
}

export function matMul(a: Mat3, b: Mat3): Mat3 {
  const out = new Array(9).fill(0) as Mat3
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c]
        + a[r * 3 + 2] * b[6 + c]
    }
  }
  return out
}

function translation(x: number, y: number): Mat3 {
  return [1, 0, x, 0, 1, y, 0, 0, 1]
}

function rotation(rads: number): Mat3 {
  const c = Math.cos(rads)
  const s = Math.sin(rads)
  return [c, s, 0, -s, c, 0, 0, 0, 1]
}

function scaleMat(sx: number, sy: number): Mat3 {
  return [sx, 0, 0, 0, sy, 0, 0, 0, 1]
}

function skewXY(skewX: number, skewY: number): Mat3 {
  return [1 + skewX * skewY, skewX, 0, skewY, 1, 0, 0, 0, 1]
}

export function transformCanonical(
  tx: number, ty: number, sx: number, sy: number,
  skewX: number, skewY: number, rads: number,
  cx: number, cy: number,
): Mat3 {
  return matMul(
    matMul(
      matMul(
        matMul(
          matMul(translation(cx, cy), translation(tx, ty)),
          rotation(-rads)),
        skewXY(skewX, skewY)),
      scaleMat(sx, sy)),
    translation(-cx, -cy))
}

export function invertAffine(m: Mat3): Mat3 | null {
  const [a, b, c, d, e, f] = [m[0], m[1], m[2], m[3], m[4], m[5]]
  const det = a * e - b * d
  if (Math.abs(det) < 1e-12) return null
  const ia = e / det
  const ib = -b / det
  const id = -d / det
  const ie = a / det
  return [ia, ib, -(ia * c + ib * f),
    id, ie, -(id * c + ie * f),
    0, 0, 1]
}

export function transformInverse(
  p: Partial<VideoTransformParams>,
  width: number,
  height: number,
): Mat3 | null {
  const s = Math.max(1e-6, p.scale ?? 1)
  const m = transformCanonical(
    p.posX ?? 0, -(p.posY ?? 0), s, s,
    -(p.skewX ?? 0), 0,
    -((p.rotation ?? 0) * Math.PI) / 180,
    width / 2, height / 2)
  return invertAffine(m)
}

export function applyMat(m: Mat3, x: number, y: number): [number, number] {
  return [m[0] * x + m[1] * y + m[2], m[3] * x + m[4] * y + m[5]]
}
