import type { FrameRange, SceneShotEntry } from './types'

export interface ShotSegment {
  shot: SceneShotEntry
  index: number
  startFrame: number
  endFrame: number
}

export function shotSegments(shots: readonly SceneShotEntry[]): ShotSegment[] {
  const segments: ShotSegment[] = []
  let cursor = 0
  shots.forEach((shot, index) => {
    const dur = Math.max(1, Math.round(shot.durFrames))
    segments.push({ shot, index, startFrame: cursor, endFrame: cursor + dur })
    cursor += dur
  })
  return segments
}

export function totalShotFrames(shots: readonly SceneShotEntry[]): number {
  return shots.reduce((sum, shot) => sum + Math.max(1, Math.round(shot.durFrames)), 0)
}

export function shotAtFrame(
  shots: readonly SceneShotEntry[],
  frame: number
): ShotSegment | null {
  const segments = shotSegments(shots)
  if (segments.length === 0) return null
  const last = segments[segments.length - 1]
  if (frame >= last.endFrame) return last
  if (frame < 0) return segments[0]
  return segments.find((seg) => frame >= seg.startFrame && frame < seg.endFrame) ?? last
}

export function frameInRange(range: FrameRange | undefined, frame: number): boolean {
  if (!range) return true
  return frame >= range.start && frame < range.end
}

export function shotLocalSeconds(
  segment: ShotSegment,
  globalSeconds: number,
  fps: number
): number {
  return globalSeconds - segment.startFrame / fps
}

export function shotProgress(
  segment: ShotSegment,
  globalSeconds: number,
  fps: number
): number {
  const durSeconds = (segment.endFrame - segment.startFrame) / fps
  if (durSeconds <= 0) return 0
  const local = shotLocalSeconds(segment, globalSeconds, fps)
  return Math.min(1, Math.max(0, local / durSeconds))
}
