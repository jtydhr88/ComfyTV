import { describe, it, expect } from 'vitest'
import {
  applyMat,
  invertAffine,
  matMul,
  transformCanonical,
  transformInverse,
  type Mat3,
} from './videoTransformMath'

const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]

function expectClose(a: readonly number[], b: readonly number[]): void {
  for (let i = 0; i < a.length; i++) {
    expect(a[i]).toBeCloseTo(b[i], 6)
  }
}

describe('matMul', () => {
  it('identity is neutral', () => {
    const m: Mat3 = [2, 1, 3, 0, 4, -1, 0, 0, 1]
    expectClose(matMul(IDENTITY, m), m)
    expectClose(matMul(m, IDENTITY), m)
  })

  it('composes translations additively', () => {
    const a: Mat3 = [1, 0, 5, 0, 1, 2, 0, 0, 1]
    const b: Mat3 = [1, 0, -3, 0, 1, 7, 0, 0, 1]
    expectClose(matMul(a, b), [1, 0, 2, 0, 1, 9, 0, 0, 1])
  })
})

describe('applyMat', () => {
  it('applies affine coefficients to a point', () => {
    const m: Mat3 = [2, 0, 1, 0, 3, -2, 0, 0, 1]
    expect(applyMat(m, 4, 5)).toEqual([9, 13])
  })
})

describe('invertAffine', () => {
  it('inverts a mixed affine matrix', () => {
    const m = transformCanonical(12, -7, 1.5, 1.5, 0.3, 0, 0.4, 50, 40)
    const inv = invertAffine(m)
    expect(inv).not.toBeNull()
    const [x, y] = applyMat(m, 33, 21)
    expectClose(applyMat(inv as Mat3, x, y), [33, 21])
  })

  it('returns null for a singular matrix', () => {
    expect(invertAffine([0, 0, 1, 0, 0, 2, 0, 0, 1])).toBeNull()
  })
})

describe('transformCanonical', () => {
  it('identity args produce the identity matrix', () => {
    expectClose(transformCanonical(0, 0, 1, 1, 0, 0, 0, 50, 50), IDENTITY)
  })

  it('keeps the pivot fixed under scale and rotation', () => {
    const m = transformCanonical(0, 0, 2, 2, 0.2, 0.1, 1.1, 64, 36)
    expectClose(applyMat(m, 64, 36), [64, 36])
  })

  it('scales distances from the pivot', () => {
    const m = transformCanonical(0, 0, 2, 2, 0, 0, 0, 50, 50)
    expectClose(applyMat(m, 60, 50), [70, 50])
  })
})

describe('transformInverse', () => {
  it('identity params yield the identity inverse', () => {
    const inv = transformInverse({}, 100, 100)
    expect(inv).not.toBeNull()
    expectClose(inv as Mat3, IDENTITY)
  })

  it('undoes a positive posX by sampling to the left', () => {
    const inv = transformInverse({ posX: 10 }, 100, 100)
    expectClose(applyMat(inv as Mat3, 30, 40), [20, 40])
  })

  it('maps UI posY up to image-space down when inverted', () => {
    const inv = transformInverse({ posY: 5 }, 100, 100)
    expectClose(applyMat(inv as Mat3, 30, 40), [30, 45])
  })

  it('rotation 90 is counter-clockwise about the center', () => {
    const inv = transformInverse({ rotation: 90 }, 100, 100)
    expectClose(applyMat(inv as Mat3, 50, 40), [60, 50])
  })

  it('scale 2 samples halfway to the center', () => {
    const inv = transformInverse({ scale: 2 }, 100, 100)
    expectClose(applyMat(inv as Mat3, 70, 50), [60, 50])
  })

  it('round-trips against the forward canonical matrix', () => {
    const p = { posX: 17, posY: -9, scale: 1.3, rotation: 33, skewX: 0.25 }
    const fwd = transformCanonical(
      p.posX, -p.posY, p.scale, p.scale, -p.skewX, 0,
      -(p.rotation * Math.PI) / 180, 60, 40)
    const inv = transformInverse(p, 120, 80)
    expectClose(matMul(fwd, inv as Mat3), IDENTITY)
  })

  it('clamps zero scale instead of returning null', () => {
    expect(transformInverse({ scale: 0 }, 100, 100)).not.toBeNull()
  })
})
