export function getEffectiveBrushSize(size: number, hardness: number): number {
  const MAX_SCALE = 1.5
  const scale = 1.0 + (1.0 - hardness) * (MAX_SCALE - 1.0)
  return size * scale
}

export function getEffectiveHardness(
  size: number,
  hardness: number,
  effectiveSize: number
): number {
  if (effectiveSize <= 0) return 0
  return (size * hardness) / effectiveSize
}
