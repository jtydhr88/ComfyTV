import { describe, expect, it } from 'vitest'

import {
  actionSampleTime,
  characterElapsedTime,
  clipLocalTime,
  sceneFallbackDuration
} from './characterTime'
import { createDefaultCharacter } from './types'

function animation(overrides = {}) {
  return { clip: 'Walk', speed: 1, loop: true, startOffset: 0, ...overrides }
}

describe('characterElapsedTime', () => {
  it('scales timeline time by speed and adds the start offset', () => {
    expect(characterElapsedTime(2, animation())).toBe(2)
    expect(characterElapsedTime(2, animation({ speed: 2 }))).toBe(4)
    expect(
      characterElapsedTime(2, animation({ speed: 0.5, startOffset: 1 }))
    ).toBe(2)
  })
})

describe('clipLocalTime', () => {
  it('wraps looping clips over the duration', () => {
    expect(clipLocalTime(2.5, 1, true)).toBeCloseTo(0.5)
    expect(clipLocalTime(-0.25, 1, true)).toBeCloseTo(0.75)
  })

  it('clamps non-looping clips to hold the last pose', () => {
    expect(clipLocalTime(5, 2, false)).toBe(2)
    expect(clipLocalTime(-1, 2, false)).toBe(0)
    expect(clipLocalTime(1.5, 2, false)).toBe(1.5)
  })

  it('returns 0 for empty clips', () => {
    expect(clipLocalTime(3, 0, true)).toBe(0)
  })
})

describe('actionSampleTime', () => {
  it('holds a non-looping clip just below duration past its end', () => {
    const t = actionSampleTime(5, 2, false)
    expect(t).toBeLessThan(2)
    expect(t).toBeCloseTo(2, 3)
  })

  it('matches clipLocalTime within the clip and for looping clips', () => {
    expect(actionSampleTime(1.5, 2, false)).toBe(1.5)
    expect(actionSampleTime(2.5, 1, true)).toBeCloseTo(0.5)
    expect(actionSampleTime(-1, 2, false)).toBe(0)
  })
})

describe('sceneFallbackDuration', () => {
  function character(model: string, clip: string, speed: number) {
    const entry = createDefaultCharacter(model, [])
    entry.animation.clip = clip
    entry.animation.speed = speed
    return entry
  }

  it('takes the longest speed-adjusted cycle', () => {
    const durations = new Map([
      ['human:Walk', 2],
      ['fox:Run', 6]
    ])
    const characters = [
      character('human', 'Walk', 1),
      character('fox', 'Run', 2)
    ]
    expect(sceneFallbackDuration(characters, durations)).toBe(3)
  })

  it('never returns less than one second', () => {
    expect(sceneFallbackDuration([], new Map())).toBe(1)
    expect(
      sceneFallbackDuration(
        [character('human', 'Blink', 4)],
        new Map([['human:Blink', 0.2]])
      )
    ).toBe(1)
  })
})
