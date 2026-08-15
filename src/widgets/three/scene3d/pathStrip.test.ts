import { describe, expect, it } from 'vitest'

import {
  buildPathActionJson,
  parsePathStrip,
  pathStripDuration,
  samplePathStrip
} from './pathStrip'

const LINE = buildPathActionJson(
  [
    [0, 0, 0],
    [10, 0, 0]
  ],
  undefined,
  true
)

describe('parsePathStrip', () => {
  it('parses a built action and rejects garbage', () => {
    const parsed = parsePathStrip(LINE)
    expect(parsed).not.toBeNull()
    expect(parsed!.table!.totalLen).toBeCloseTo(10, 1)
    expect(parsePathStrip({ nonsense: true })).toBeNull()
    expect(parsePathStrip('text')).toBeNull()
  })
})

describe('samplePathStrip (smoothstep)', () => {
  const parsed = parsePathStrip(LINE)!

  it('clamps to the endpoints outside the duration', () => {
    const before = samplePathStrip(parsed, -1, 4)
    expect(before.x).toBeCloseTo(0, 3)
    expect(before.active).toBe(false)
    const after = samplePathStrip(parsed, 99, 4)
    expect(after.x).toBeCloseTo(10, 1)
    expect(after.active).toBe(false)
  })

  it('reaches the halfway point mid-duration and faces the tangent', () => {
    const mid = samplePathStrip(parsed, 2, 4)
    expect(mid.x).toBeCloseTo(5, 0)
    expect(mid.active).toBe(true)
    expect(mid.speed).toBeGreaterThan(0)
    expect(mid.yaw).toBeCloseTo(Math.PI / 2, 1)
  })
})

describe('samplePathStrip (speed curve)', () => {
  const timed = parsePathStrip(
    buildPathActionJson(
      [
        [0, 0, 0],
        [10, 0, 0]
      ],
      [0, 2],
      true
    )
  )!

  it('follows waypoint arrival times instead of smoothstep', () => {
    expect(samplePathStrip(timed, 0, 99).s).toBeCloseTo(0, 1)
    expect(samplePathStrip(timed, 2, 99).s).toBeCloseTo(10, 1)
    expect(samplePathStrip(timed, 5, 99).s).toBeCloseTo(10, 1)
    const mid = samplePathStrip(timed, 1, 99)
    expect(mid.active).toBe(true)
    expect(mid.s).toBeGreaterThan(0)
    expect(mid.s).toBeLessThan(10)
  })
})

describe('pathStripDuration', () => {
  const parsed = parsePathStrip(LINE)!

  it('prefers the frame range', () => {
    expect(
      pathStripDuration({ action: LINE, range: { start: 24, end: 72 } }, parsed, 24)
    ).toBeCloseTo(2)
  })

  it('falls back to the speed-curve extent, then a default', () => {
    const timed = parsePathStrip(
      buildPathActionJson(
        [
          [0, 0, 0],
          [10, 0, 0]
        ],
        [0, 3]
      )
    )!
    expect(pathStripDuration({ action: LINE }, timed, 24)).toBeCloseTo(3)
    expect(pathStripDuration({ action: LINE }, parsed, 24)).toBe(5)
  })
})
