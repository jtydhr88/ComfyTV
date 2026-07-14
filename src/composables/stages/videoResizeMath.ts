export function evenDim(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2)
}

export function presetDims(short: number, srcW: number, srcH: number): { width: number; height: number } | null {
  if (srcW <= 0 || srcH <= 0) return null
  const ar = srcW / srcH
  if (srcW >= srcH) {
    return { width: evenDim(short * ar), height: evenDim(short) }
  }
  return { width: evenDim(short), height: evenDim(short / ar) }
}

export function resolveTarget(
  width: number, height: number, srcW: number, srcH: number,
): { width: number; height: number } | null {
  const ar = srcW > 0 && srcH > 0 ? srcW / srcH : 0
  const rw = width > 0 ? width : (height > 0 && ar > 0 ? evenDim(height * ar) : 0)
  const rh = height > 0 ? height : (width > 0 && ar > 0 ? evenDim(width / ar) : 0)
  return rw > 0 && rh > 0 ? { width: rw, height: rh } : null
}
