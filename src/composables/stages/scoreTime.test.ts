import { describe, it, expect } from 'vitest'
import { beatAtTime } from './scoreTime'

describe('beatAtTime', () => {
  it('single tempo', () => {
    const map = [{ beat: 0, t: 0, bpm: 120 }]
    expect(beatAtTime(map, 0)).toBe(0)
    expect(beatAtTime(map, 1)).toBeCloseTo(2)
    expect(beatAtTime(map, 2.5)).toBeCloseTo(5)
  })

  it('tempo change segments', () => {
    const map = [
      { beat: 0, t: 0, bpm: 120 },
      { beat: 4, t: 2, bpm: 60 },
    ]
    expect(beatAtTime(map, 1)).toBeCloseTo(2)
    expect(beatAtTime(map, 2)).toBeCloseTo(4)
    expect(beatAtTime(map, 4)).toBeCloseTo(6)
  })

  it('empty map falls back', () => {
    expect(beatAtTime([], 1.5)).toBeCloseTo(3)
  })
})
