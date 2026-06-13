import { SHORT_SIDE_BY_TIER, DEFAULT_SHORT_SIDE } from './sizing'

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
  const short = SHORT_SIDE_BY_TIER[resolution] ?? DEFAULT_SHORT_SIDE
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
