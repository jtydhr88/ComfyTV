export type Rgb8 = [number, number, number]

export interface PseudocolorParams {
  preset: string
  opacity: number
}

export function pseudocolorIndex(rgb: Rgb8): number {
  const l = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
  const yLim = Math.round(16 + (219 / 255) * l)
  const g = Math.round((yLim - 16) * 255 / 219)
  return Math.max(0, Math.min(255, g))
}

export function applyPseudocolor(
  rgb: Rgb8, lut: readonly number[][], opacity: number,
): Rgb8 {
  const pal = lut[pseudocolorIndex(rgb)]
  const mix = (i: number) =>
    Math.max(0, Math.min(255, Math.round(rgb[i] + (pal[i] - rgb[i]) * opacity)))
  return [mix(0), mix(1), mix(2)]
}
