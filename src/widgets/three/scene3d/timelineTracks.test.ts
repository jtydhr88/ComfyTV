import { describe, expect, it } from 'vitest'

import { shotReorderIndex } from './timelineTracks'

const SEGMENTS = [
  { id: 'shot_1', startFrame: 0, endFrame: 48 },
  { id: 'shot_2', startFrame: 48, endFrame: 96 },
  { id: 'shot_3', startFrame: 96, endFrame: 108 }
]

describe('shotReorderIndex', () => {
  it('keeps the index when the segment stays in place', () => {
    expect(shotReorderIndex(SEGMENTS, 'shot_2', 72)).toBe(1)
  })

  it('moves a segment earlier when dragged before a neighbor center', () => {
    expect(shotReorderIndex(SEGMENTS, 'shot_2', 10)).toBe(0)
    expect(shotReorderIndex(SEGMENTS, 'shot_3', 30)).toBe(1)
  })

  it('moves a segment to the end when dragged past everything', () => {
    expect(shotReorderIndex(SEGMENTS, 'shot_1', 500)).toBe(2)
  })

  it('handles clamped drags that stop at another center boundary', () => {
    expect(shotReorderIndex(SEGMENTS, 'shot_1', 90)).toBe(1)
  })
})
