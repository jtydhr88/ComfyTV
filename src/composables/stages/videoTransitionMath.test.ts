import { describe, it, expect } from 'vitest'
import fixture from './videoTransitionMath.fixtures.json'
import {
  XFADE_TRANSITIONS,
  REFERENCE_MODES,
  type ReferenceMode,
  clampProgress,
  effectiveTransitionWindow,
  ffmpegProgress,
  previewTimeline,
  renderTransitionReference,
  seekTargets,
  timelineToSeeks,
  transitionModeIndex,
} from './videoTransitionMath'

describe('effectiveTransitionWindow', () => {
  it('auto offset places the transition at the end of A', () => {
    expect(effectiveTransitionWindow(10, 5, 1, 0)).toEqual({ duration: 1, offset: 9 })
  })

  it('treats non-positive and non-finite offsets as auto', () => {
    expect(effectiveTransitionWindow(10, 5, 1, -3).offset).toBe(9)
    expect(effectiveTransitionWindow(10, 5, 1, Number.NaN).offset).toBe(9)
  })

  it('clamps explicit offsets into [0, durA - duration]', () => {
    expect(effectiveTransitionWindow(10, 5, 1, 4).offset).toBe(4)
    expect(effectiveTransitionWindow(10, 5, 1, 99).offset).toBe(9)
  })

  it('clamps duration to both clip lengths with a 0.1s floor', () => {
    expect(effectiveTransitionWindow(10, 0.5, 3, 0).duration).toBe(0.5)
    expect(effectiveTransitionWindow(0.05, 5, 3, 0).duration).toBe(0.1)
    expect(effectiveTransitionWindow(10, 5, 0, 0).duration).toBe(1)
  })

  it('never returns a negative offset for short clips', () => {
    const w = effectiveTransitionWindow(0.5, 5, 2, 0)
    expect(w.offset).toBe(0)
    expect(w.duration).toBe(0.5)
  })
})

describe('seekTargets / progress helpers', () => {
  it('maps p to absolute times in A and B', () => {
    const w = { duration: 2, offset: 8 }
    expect(seekTargets(0, w)).toEqual({ a: 8, b: 0 })
    expect(seekTargets(0.5, w)).toEqual({ a: 9, b: 1 })
    expect(seekTargets(1, w)).toEqual({ a: 10, b: 2 })
  })

  it('clamps p outside [0,1]', () => {
    const w = { duration: 2, offset: 8 }
    expect(seekTargets(-1, w)).toEqual({ a: 8, b: 0 })
    expect(seekTargets(9, w)).toEqual({ a: 10, b: 2 })
    expect(clampProgress(Number.NaN)).toBe(0)
  })

  it('ffmpegProgress inverts user progress', () => {
    expect(ffmpegProgress(0)).toBe(1)
    expect(ffmpegProgress(0.25)).toBe(0.75)
    expect(ffmpegProgress(1)).toBe(0)
  })
})

describe('previewTimeline', () => {
  it('caps lead and tail at 1 second each', () => {
    expect(previewTimeline(9, 1, 10, 5)).toEqual({ lead: 1, tail: 1, total: 3 })
  })

  it('uses the full offset as lead when under 1 second', () => {
    expect(previewTimeline(0.5, 1, 10, 5)).toEqual({ lead: 0.5, tail: 1, total: 2.5 })
  })

  it('has no lead when the transition starts at 0', () => {
    expect(previewTimeline(0, 1, 1, 5)).toEqual({ lead: 0, tail: 1, total: 2 })
  })

  it('has no tail when B is fully consumed by the transition', () => {
    expect(previewTimeline(9, 1, 10, 1)).toEqual({ lead: 1, tail: 0, total: 2 })
  })

  it('uses the leftover of B as tail when under 1 second', () => {
    expect(previewTimeline(9, 1, 10, 1.5)).toEqual({ lead: 1, tail: 0.5, total: 2.5 })
  })

  it('clamps a negative B remainder to zero tail', () => {
    expect(previewTimeline(0, 0.1, 0.05, 0.05)).toEqual({ lead: 0, tail: 0, total: 0.1 })
  })

  it('composes with effectiveTransitionWindow for tiny clips', () => {
    const w = effectiveTransitionWindow(0.5, 5, 2, 0)
    const tl = previewTimeline(w.offset, w.duration, 0.5, 5)
    expect(tl).toEqual({ lead: 0, tail: 1, total: 1.5 })
  })
})

describe('timelineToSeeks', () => {
  const w = { duration: 2, offset: 8 }
  const tl = previewTimeline(8, 2, 10, 5)

  it('maps the lead segment to pure A rolling toward the transition', () => {
    expect(tl).toEqual({ lead: 1, tail: 1, total: 4 })
    expect(timelineToSeeks(0, w, tl)).toEqual({
      p: 0, aTime: 7, bTime: 0, aActive: true, bActive: false,
    })
    expect(timelineToSeeks(0.5, w, tl)).toEqual({
      p: 0, aTime: 7.5, bTime: 0, aActive: true, bActive: false,
    })
  })

  it('maps the transition segment with A continuing linearly and B from 0', () => {
    expect(timelineToSeeks(1, w, tl)).toEqual({
      p: 0, aTime: 8, bTime: 0, aActive: true, bActive: true,
    })
    expect(timelineToSeeks(2, w, tl)).toEqual({
      p: 0.5, aTime: 9, bTime: 1, aActive: true, bActive: true,
    })
    const s = timelineToSeeks(2.9, w, tl)
    expect(s.p).toBeCloseTo(0.95, 10)
    expect(s.aTime).toBeCloseTo(9.9, 10)
    expect(s.bTime).toBeCloseTo(1.9, 10)
  })

  it('maps the tail segment to pure B rolling with A parked at the end', () => {
    expect(timelineToSeeks(3, w, tl)).toEqual({
      p: 1, aTime: 10, bTime: 2, aActive: false, bActive: true,
    })
    expect(timelineToSeeks(3.5, w, tl)).toEqual({
      p: 1, aTime: 10, bTime: 2.5, aActive: false, bActive: true,
    })
    expect(timelineToSeeks(4, w, tl)).toEqual({
      p: 1, aTime: 10, bTime: 3, aActive: false, bActive: true,
    })
  })

  it('clamps t into [0, total] and treats NaN as 0', () => {
    expect(timelineToSeeks(-5, w, tl)).toEqual(timelineToSeeks(0, w, tl))
    expect(timelineToSeeks(99, w, tl)).toEqual(timelineToSeeks(4, w, tl))
    expect(timelineToSeeks(Number.NaN, w, tl)).toEqual(timelineToSeeks(0, w, tl))
  })

  it('starts inside the transition when lead is zero', () => {
    const w0 = { duration: 1, offset: 0 }
    const tl0 = previewTimeline(0, 1, 1, 5)
    expect(timelineToSeeks(0, w0, tl0)).toEqual({
      p: 0, aTime: 0, bTime: 0, aActive: true, bActive: true,
    })
    expect(timelineToSeeks(0.5, w0, tl0)).toEqual({
      p: 0.5, aTime: 0.5, bTime: 0.5, aActive: true, bActive: true,
    })
  })

  it('ends exactly at p=1 when tail is zero', () => {
    const wz = { duration: 1, offset: 9 }
    const tlz = previewTimeline(9, 1, 10, 1)
    expect(tlz).toEqual({ lead: 1, tail: 0, total: 2 })
    expect(timelineToSeeks(2, wz, tlz)).toEqual({
      p: 1, aTime: 10, bTime: 1, aActive: false, bActive: true,
    })
  })

  it('covers tiny clips where the whole timeline is the transition', () => {
    const wt = effectiveTransitionWindow(0.05, 0.05, 3, 0)
    const tlt = previewTimeline(wt.offset, wt.duration, 0.05, 0.05)
    expect(tlt).toEqual({ lead: 0, tail: 0, total: 0.1 })
    const s = timelineToSeeks(0.05, wt, tlt)
    expect(s.p).toBeCloseTo(0.5, 10)
    expect(s.aActive).toBe(true)
    expect(s.bActive).toBe(true)
  })
})

describe('transitionModeIndex', () => {
  it('covers all 58 backend transitions with stable indices', () => {
    expect(XFADE_TRANSITIONS).toHaveLength(58)
    expect(transitionModeIndex('fade')).toBe(0)
    expect(transitionModeIndex('hblur')).toBe(57)
    for (const [i, name] of XFADE_TRANSITIONS.entries()) {
      expect(transitionModeIndex(name)).toBe(i)
    }
  })

  it('falls back to fade for unknown names', () => {
    expect(transitionModeIndex('nope')).toBe(0)
  })
})

interface FixtureCase {
  mode: string
  p: number
  aIndex: number
  bIndex: number
  expected: number[]
}

const { width: W, height: H, cases } = fixture as {
  width: number
  height: number
  cases: FixtureCase[]
}

function frameA(n: number): Uint8Array {
  const out = new Uint8Array(W * H * 3)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3
      out[i] = (x * 5 + y * 3 + n * 7) % 256
      out[i + 1] = (x * 11 + n * 5) % 256
      out[i + 2] = (y * 13 + n * 11) % 256
    }
  }
  return out
}

function frameB(n: number): Uint8Array {
  const out = new Uint8Array(W * H * 3)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3
      out[i] = 255 - ((x * 7 + y * 5 + n * 5) % 256)
      out[i + 1] = (y * 9 + n * 13) % 256
      out[i + 2] = (x * 3 + y * 2 + n * 7) % 256
    }
  }
  return out
}

const TOLERANCE = 2
const OUTLIER_CAP: Record<ReferenceMode, number> = {
  fade: 0,
  wipeleft: 0.002,
  circleopen: 0.002,
  dissolve: 0.02,
  pixelize: 0.01,
  slideright: 0.002,
  radial: 0.002,
  fadeblack: 0,
}

describe('renderTransitionReference vs PyAV xfade fixtures', () => {
  it('has 3 fixture progress values for each of the 8 reference modes', () => {
    const byMode = new Map<string, number>()
    for (const c of cases) byMode.set(c.mode, (byMode.get(c.mode) ?? 0) + 1)
    expect([...byMode.keys()].sort()).toEqual([...REFERENCE_MODES].sort())
    for (const n of byMode.values()) expect(n).toBe(3)
  })

  for (const c of cases) {
    it(`${c.mode} @ p=${c.p} matches ffmpeg within tolerance`, () => {
      const out = renderTransitionReference(
        c.mode as ReferenceMode, frameA(c.aIndex), frameB(c.bIndex), W, H, c.p,
      )
      expect(out).toHaveLength(c.expected.length)
      let outliers = 0
      let maxErr = 0
      for (let i = 0; i < out.length; i++) {
        const err = Math.abs(out[i] - c.expected[i])
        maxErr = Math.max(maxErr, err)
        if (err > TOLERANCE) outliers++
      }
      const frac = outliers / out.length
      expect(frac).toBeLessThanOrEqual(OUTLIER_CAP[c.mode as ReferenceMode])
      if (outliers === 0) expect(maxErr).toBeLessThanOrEqual(TOLERANCE)
    })
  }
})
