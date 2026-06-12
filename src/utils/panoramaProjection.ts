export const ASPECT_OPTIONS = [
  '1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '4:5', '5:4', '21:9',
] as const

export const RESOLUTION_OPTIONS = ['1K', '2K', '4K'] as const

export const RESOLUTION_TO_SHORT_SIDE: Record<string, number> = {
  '1K': 1024,
  '2K': 2048,
  '4K': 4096,
}

export const DEFAULT_SHORT_SIDE = 1024

export const CAPTURE_FOV = 75

export const LABELS_4 = ['Front', 'Right', 'Back', 'Left'] as const

export function parseAspect(s: string): { w: number; h: number } {
  const [a, b] = s.split(':')
  const wa = Number(a), wb = Number(b)
  if (!Number.isFinite(wa) || !Number.isFinite(wb) || wb === 0) {
    return { w: 16, h: 9 }
  }
  return { w: wa, h: wb }
}

export function captureDimensions(
  aspect: string,
  resolution: string,
): { w: number; h: number } {
  const { w: aw, h: ah } = parseAspect(aspect)
  const short = RESOLUTION_TO_SHORT_SIDE[resolution] ?? DEFAULT_SHORT_SIDE
  if (aw >= ah) {
    return {
      w: Math.max(16, Math.round((short * aw / ah) / 8) * 8),
      h: Math.max(16, Math.round(short / 8) * 8),
    }
  }
  return {
    w: Math.max(16, Math.round(short / 8) * 8),
    h: Math.max(16, Math.round((short * ah / aw) / 8) * 8),
  }
}
