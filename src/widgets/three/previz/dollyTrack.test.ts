import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import {
  addTrackAnchor,
  anchorArcLengths,
  anchorCount,
  distributeSpeed,
  ensureSpeedCurve,
  fovToLens,
  inverseSmoothstep,
  isTrackStraight,
  lensToFov,
  makeTrackAction,
  removeTrackAnchor,
  reconcileSpeed,
  sampleAim,
  sampleFov,
  sampleTrack,
  scaleTrackTimes,
  setAimKey,
  setFovKey,
  setTrackStraight,
  setTrackTime,
  smoothstep,
  trackFromJson,
  trackPath,
  trackSpeed,
  trackTimes,
  trackToJson,
  PREVIZ_FPS
} from './dollyTrack'

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

function lineTrack(timesSec?: number[]) {
  return makeTrackAction([v3(0, 0, 0), v3(4, 0, 0)], { straight: true, timesSec })
}

describe('fov/lens', () => {
  it('round-trips through the 24mm sensor formula', () => {
    for (const fov of [10, 40, 90, 110]) {
      expect(lensToFov(fovToLens(fov))).toBeCloseTo(fov, 6)
    }
  })
})

describe('smoothstep', () => {
  it('inverts cleanly', () => {
    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      expect(smoothstep(inverseSmoothstep(u))).toBeCloseTo(u, 4)
    }
  })
})

describe('track construction & serialization', () => {
  it('builds a spline with one anchor per input point', () => {
    const action = makeTrackAction([v3(0, 0, 0), v3(2, 0, 0), v3(2, 0, 2)])
    expect(anchorCount(action)).toBe(3)
    expect(trackSpeed(action)).toBeNull()
  })

  it('keys the speed curve at the given arrival times', () => {
    const action = lineTrack([1, 3])
    const speed = trackSpeed(action)!
    expect(speed.bezt.map((k) => k.vec[1][0])).toEqual([PREVIZ_FPS, 3 * PREVIZ_FPS])
    expect(speed.bezt[1].vec[1][1]).toBeCloseTo(4, 3)
  })

  it('round-trips through JSON', () => {
    const action = lineTrack([0, 2])
    const json = trackToJson(action)
    const again = trackFromJson(json)
    expect(again).not.toBeNull()
    expect(trackToJson(again!)).toEqual(json)
  })

  it('rejects junk JSON', () => {
    expect(trackFromJson({ nope: true })).toBeNull()
    expect(trackFromJson(null)).toBeNull()
  })
})

describe('anchor arc lengths & timing', () => {
  it('reports monotone arc lengths per anchor', () => {
    const action = makeTrackAction([v3(0, 0, 0), v3(1, 0, 0), v3(3, 0, 0)], { straight: true })
    const arcs = anchorArcLengths(action)
    expect(arcs[0]).toBe(0)
    expect(arcs[1]).toBeCloseTo(1, 2)
    expect(arcs[2]).toBeCloseTo(3, 2)
  })

  it('trackTimes reads speed keys, or inverts smoothstep without them', () => {
    expect(trackTimes(lineTrack([1, 3]), 4)).toEqual([1, 3])
    const noSpeed = lineTrack()
    const times = trackTimes(noSpeed, 4)
    expect(times[0]).toBeCloseTo(0, 3)
    expect(times[1]).toBeCloseTo(4, 3)
  })

  it('setTrackTime keeps keys monotone', () => {
    const action = makeTrackAction([v3(0, 0, 0), v3(2, 0, 0), v3(4, 0, 0)], {
      straight: true,
      timesSec: [0, 1, 2]
    })
    setTrackTime(action, 1, 1.8, 2)
    let times = trackTimes(action, 2)
    expect(times[1]).toBeCloseTo(1.8, 2)
    setTrackTime(action, 1, 5, 2)
    times = trackTimes(action, 2)
    expect(times[1]).toBeLessThan(times[2])
    expect(times[1]).toBeGreaterThan(times[0])
  })

  it('ensureSpeedCurve materializes smoothstep arrivals', () => {
    const action = lineTrack()
    const fcu = ensureSpeedCurve(action, 4)
    expect(fcu.bezt).toHaveLength(2)
    expect(trackSpeed(action)).toBe(fcu)
  })
})

describe('anchor editing', () => {
  it('addTrackAnchor extends path and speed keys stay in step', () => {
    const action = lineTrack([0, 2])
    addTrackAnchor(action, v3(8, 0, 0), 4)
    expect(anchorCount(action)).toBe(3)
    expect(trackSpeed(action)!.bezt).toHaveLength(3)
  })

  it('removeTrackAnchor drops the anchor and re-syncs keys', () => {
    const action = makeTrackAction([v3(0, 0, 0), v3(2, 0, 0), v3(4, 0, 0)], {
      straight: true,
      timesSec: [0, 1, 2]
    })
    removeTrackAnchor(action, 1, 2)
    expect(anchorCount(action)).toBe(2)
    expect(trackSpeed(action)!.bezt).toHaveLength(2)
  })

  it('reconcileSpeed refreshes arc values after reshaping', () => {
    const action = lineTrack([0, 2])
    const path = trackPath(action)!
    path.points[1].co[0] = 8
    reconcileSpeed(action, 2)
    const speed = trackSpeed(action)!
    expect(speed.bezt[1].vec[1][1]).toBeCloseTo(8, 1)
  })

  it('distributeSpeed lays keys over the given span', () => {
    const action = lineTrack()
    distributeSpeed(action, 1, 5)
    expect(trackTimes(action, 99)).toEqual([1, 5])
  })
})

describe('straight/smooth toggle', () => {
  it('reports and switches handle modes', () => {
    const action = lineTrack()
    expect(isTrackStraight(action)).toBe(true)
    setTrackStraight(action, false)
    expect(isTrackStraight(action)).toBe(false)
  })
})

describe('sampleTrack', () => {
  it('smoothstep mode traverses the full arc over the duration', () => {
    const action = lineTrack()
    const mid = sampleTrack(action, 1, 'smoothstep', 2)!
    expect(mid.position.x).toBeCloseTo(2, 1)
    expect(mid.active).toBe(true)
    const end = sampleTrack(action, 2, 'smoothstep', 2)!
    expect(end.position.x).toBeCloseTo(4, 1)
    expect(end.active).toBe(false)
  })

  it('speed mode follows the speed curve keys', () => {
    const action = lineTrack([0, 2])
    const mid = sampleTrack(action, 1, 'speed', 2)!
    expect(mid.position.x).toBeCloseTo(2, 0)
    expect(mid.active).toBe(true)
    expect(mid.speed).toBeGreaterThan(0)
    const before = sampleTrack(action, -1, 'speed', 2)!
    expect(before.position.x).toBeCloseTo(0, 1)
    expect(before.active).toBe(false)
  })

  it('indexed mode aligns same-index anchors', () => {
    const action = makeTrackAction([v3(0, 0, 0), v3(1, 0, 0), v3(9, 0, 0)], { straight: true })
    const mid = sampleTrack(action, 1, 'indexed', 2)!
    expect(mid.position.x).toBeCloseTo(1, 1)
  })

  it('degrades to the single anchor for point paths', () => {
    const action = makeTrackAction([v3(6, 3, 6)])
    const sample = sampleTrack(action, 1, 'smoothstep', 2)!
    expect(sample.position.toArray()).toEqual([6, 3, 6])
    expect(sample.active).toBe(false)
  })
})

describe('aim / fov channels', () => {
  it('keys and samples focal length', () => {
    const action = lineTrack([0, 2])
    setFovKey(action, 0, 30)
    setFovKey(action, 2, 60)
    expect(sampleFov(action, 0, 40)).toBeCloseTo(30, 0)
    expect(sampleFov(action, 2, 40)).toBeCloseTo(60, 0)
    const mid = sampleFov(action, 1, 40)
    expect(mid).toBeGreaterThan(30)
    expect(mid).toBeLessThan(60)
  })

  it('falls back to the base fov without keys', () => {
    expect(sampleFov(lineTrack(), 1, 42)).toBe(42)
  })

  it('keys and samples manual aim in degrees', () => {
    const action = lineTrack([0, 2])
    setAimKey(action, 0, 90, 10)
    const aim = sampleAim(action, 0, { yawDeg: 0, pitchDeg: 0 })
    expect(aim.yawDeg).toBeCloseTo(90, 1)
    expect(aim.pitchDeg).toBeCloseTo(10, 1)
    expect(sampleAim(lineTrack(), 0, { yawDeg: 7, pitchDeg: 3 })).toEqual({
      yawDeg: 7,
      pitchDeg: 3
    })
  })

  it('clamps pitch keys to ±85°', () => {
    const action = lineTrack()
    setAimKey(action, 0, 0, 200)
    expect(sampleAim(action, 0, { yawDeg: 0, pitchDeg: 0 }).pitchDeg).toBeCloseTo(85, 1)
  })
})

describe('scaleTrackTimes', () => {
  it('scales speed and channel keys together', () => {
    const action = lineTrack([0, 2])
    setFovKey(action, 2, 60)
    scaleTrackTimes(action, 2)
    expect(trackTimes(action, 99)).toEqual([0, 4])
    expect(sampleFov(action, 4, 40)).toBeCloseTo(60, 0)
  })
})
