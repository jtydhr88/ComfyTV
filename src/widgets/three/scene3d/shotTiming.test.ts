import { describe, expect, it } from 'vitest'

import {
  frameInRange,
  shotAtFrame,
  shotLocalSeconds,
  shotProgress,
  shotSegments,
  totalShotFrames
} from './shotTiming'
import type { SceneShotEntry } from './types'

const SHOTS: SceneShotEntry[] = [
  { id: 'shot_1', durFrames: 48, cameraId: 'cam_1' },
  { id: 'shot_2', durFrames: 24, cameraId: 'cam_2', lock: 'char_1' },
  { id: 'shot_3', durFrames: 12, cameraId: 'cam_1' }
]

describe('shotSegments', () => {
  it('packs shots gaplessly with cumulative starts', () => {
    const segments = shotSegments(SHOTS)
    expect(segments.map((s) => [s.startFrame, s.endFrame])).toEqual([
      [0, 48],
      [48, 72],
      [72, 84]
    ])
    expect(totalShotFrames(SHOTS)).toBe(84)
  })

  it('enforces a minimum duration of one frame', () => {
    const segments = shotSegments([
      { id: 'shot_1', durFrames: 0, cameraId: '' },
      { id: 'shot_2', durFrames: 0.4, cameraId: '' }
    ])
    expect(segments.map((s) => [s.startFrame, s.endFrame])).toEqual([
      [0, 1],
      [1, 2]
    ])
  })
})

describe('shotAtFrame', () => {
  it('resolves the segment containing a frame', () => {
    expect(shotAtFrame(SHOTS, 0)?.shot.id).toBe('shot_1')
    expect(shotAtFrame(SHOTS, 47)?.shot.id).toBe('shot_1')
    expect(shotAtFrame(SHOTS, 48)?.shot.id).toBe('shot_2')
    expect(shotAtFrame(SHOTS, 83)?.shot.id).toBe('shot_3')
  })

  it('clamps out-of-range frames to the first/last segment', () => {
    expect(shotAtFrame(SHOTS, -5)?.shot.id).toBe('shot_1')
    expect(shotAtFrame(SHOTS, 500)?.shot.id).toBe('shot_3')
    expect(shotAtFrame([], 10)).toBeNull()
  })
})

describe('frameInRange', () => {
  it('treats a missing range as always active', () => {
    expect(frameInRange(undefined, 123)).toBe(true)
  })

  it('is inclusive of start and exclusive of end', () => {
    const range = { start: 10, end: 20 }
    expect(frameInRange(range, 9)).toBe(false)
    expect(frameInRange(range, 10)).toBe(true)
    expect(frameInRange(range, 19)).toBe(true)
    expect(frameInRange(range, 20)).toBe(false)
  })
})

describe('shot-local time', () => {
  it('offsets global seconds by the segment start', () => {
    const segment = shotSegments(SHOTS)[1]
    expect(shotLocalSeconds(segment, 3, 24)).toBeCloseTo(1)
  })

  it('maps global seconds to clamped progress within the segment', () => {
    const segment = shotSegments(SHOTS)[1]
    expect(shotProgress(segment, 2, 24)).toBe(0)
    expect(shotProgress(segment, 2.5, 24)).toBeCloseTo(0.5)
    expect(shotProgress(segment, 10, 24)).toBe(1)
  })
})
