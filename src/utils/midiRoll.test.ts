import { describe, expect, it } from 'vitest'
import {
  buildRollNotes, drawRoll, followOffset, isBlackKey, maxEnd, rollColor,
  KEY_WIDTH, PX_PER_SEC,
} from './midiRoll'

describe('midiRoll', () => {
  it('isBlackKey matches the piano layout', () => {
    expect(isBlackKey(60)).toBe(false)
    expect(isBlackKey(61)).toBe(true)
    expect(isBlackKey(63)).toBe(true)
    expect(isBlackKey(64)).toBe(false)
    expect(isBlackKey(66)).toBe(true)
    expect(isBlackKey(71)).toBe(false)
  })

  it('rollColor is stable per key and distinct across keys', () => {
    const a = rollColor('p0')
    expect(rollColor('p0')).toBe(a)
    expect(rollColor('drums')).not.toBe(a)
  })

  it('buildRollNotes maps events with program and drum color keys', () => {
    const notes = buildRollNotes(
      [
        { t: 0, dur: 0.5, midi: 60, vel: 100, ch: 0 },
        { t: 1, dur: 0.1, midi: 38, vel: 120, ch: 9 },
        { t: 2, dur: 0.5, midi: 40, vel: 90, ch: 2 },
      ],
      { '0': 0, '2': 33 },
    )
    expect(notes[0]).toMatchObject({ start: 0, end: 0.5, pitch: 60 })
    expect(notes[1].color).toBe(rollColor('drums'))
    expect(notes[2].color).toBe(rollColor('p33'))
    expect(notes[0].color).toBe(rollColor('p0'))
    expect(maxEnd(notes)).toBeCloseTo(2.5)
  })

  it('followOffset holds still, then follows past the right third', () => {
    expect(followOffset(0, 1, 100, 10)).toBe(0)
    expect(followOffset(0, 8, 100, 10)).toBeCloseTo(8 - 6.6)
    expect(followOffset(5, 2, 100, 10)).toBe(2)
    expect(followOffset(0, 99, 100, 10)).toBeCloseTo(90)
  })

  it('drawRoll paints notes and playhead on a fake context', () => {
    const calls: string[] = []
    const rects: Array<[number, number, number, number]> = []
    const ctx = new Proxy({}, {
      get(_t, prop: string) {
        if (prop === 'fillRect') {
          return (...a: [number, number, number, number]) => {
            calls.push('fillRect')
            rects.push(a)
          }
        }
        return (..._a: unknown[]) => { calls.push(prop) }
      },
      set() { return true },
    }) as CanvasRenderingContext2D
    const notes = buildRollNotes(
      [{ t: 0, dur: 1, midi: 60, vel: 100, ch: 0 }], { '0': 0 },
    )
    drawRoll(ctx, 400, 140, notes, 0, 0.5)
    expect(calls).toContain('clip')
    expect(calls.filter((c) => c === 'stroke').length).toBeGreaterThan(2)
    const noteRect = rects.find(
      ([x, , w]) => x === KEY_WIDTH && Math.abs(w - (PX_PER_SEC - 1.5)) < 1e-6,
    )
    expect(noteRect).toBeTruthy()
  })
})
