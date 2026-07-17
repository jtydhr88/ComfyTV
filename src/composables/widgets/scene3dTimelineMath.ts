import type { TimelineTracksData } from '@/widgets/three/scene3d/timelineTracks'

export function computeTotalFrames(data: TimelineTracksData | null): number {
  if (!data) return 0
  const camEnd = Math.max(
    0,
    ...data.cameras.map((c) => c.sourceFrames / Math.max(0.1, c.speed))
  )
  const charEnd = Math.max(
    0,
    ...data.characters.map((c) => c.offsetFrames + c.displayFrames)
  )
  return Math.round(Math.max(camEnd, charEnd))
}

export function zoomFromExp(value: number): number {
  return Math.pow(2, value)
}

export function resolveContainerHeight(desired: number): number {
  return desired > 0 ? desired : 80
}
