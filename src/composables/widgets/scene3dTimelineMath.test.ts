import { describe, expect, it } from 'vitest'

import {
  computeTotalFrames,
  resolveContainerHeight,
  zoomFromExp
} from './scene3dTimelineMath'

function camera(sourceFrames: number, speed: number) {
  return { id: 'cam', color: '#fff', sourceFrames, speed }
}

function character(offsetFrames: number, displayFrames: number) {
  return {
    id: 'char',
    color: '#fff',
    offsetFrames,
    displayFrames,
    sourceFrames: displayFrames,
    loop: false
  }
}

describe('computeTotalFrames', () => {
  it('is zero without data or tracks', () => {
    expect(computeTotalFrames(null)).toBe(0)
    expect(computeTotalFrames({ fps: 24, cameras: [], characters: [] })).toBe(0)
  })

  it('scales camera length by playback speed', () => {
    expect(
      computeTotalFrames({ fps: 24, cameras: [camera(100, 2)], characters: [] })
    ).toBe(50)
  })

  it('clamps camera speed to avoid division blowups', () => {
    expect(
      computeTotalFrames({ fps: 24, cameras: [camera(10, 0)], characters: [] })
    ).toBe(100)
  })

  it('takes the max of camera and character ends, rounded', () => {
    expect(
      computeTotalFrames({
        fps: 24,
        cameras: [camera(90, 1)],
        characters: [character(10, 85), character(0, 30)]
      })
    ).toBe(95)
    expect(
      computeTotalFrames({
        fps: 24,
        cameras: [camera(100, 3)],
        characters: []
      })
    ).toBe(33)
  })
})

describe('zoomFromExp', () => {
  it('maps the exponent slider to powers of two', () => {
    expect(zoomFromExp(0)).toBe(1)
    expect(zoomFromExp(1)).toBe(2)
    expect(zoomFromExp(-1)).toBe(0.5)
  })
})

describe('resolveContainerHeight', () => {
  it('uses the desired height when positive, else the default', () => {
    expect(resolveContainerHeight(120)).toBe(120)
    expect(resolveContainerHeight(0)).toBe(80)
    expect(resolveContainerHeight(-5)).toBe(80)
  })
})
