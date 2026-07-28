export function gauss(f: number): number {
  if (f < -0.5) {
    const g = -1 - f
    return 2 * g * g
  }
  if (f < 0.5) return 1 - 2 * f * f
  const g = 1 - f
  return 2 * g * g
}

export function brushProfile(r: number, hardness: number): number {
  if (r >= 1) return 0
  const rr = r < 0 ? 0 : r
  const exponent = 1 - hardness < 4e-7 ? 1e6 : 0.4 / (1 - hardness)
  return gauss(Math.pow(rr, exponent))
}
