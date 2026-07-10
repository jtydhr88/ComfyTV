import { describe, expect, it } from 'vitest'

import { eulerDegreesToQuat, quatToEulerDegrees } from './transformMath'

describe('transformMath', () => {
  it('round-trips euler degrees through a quaternion', () => {
    const cases = [
      { x: 0, y: 0, z: 0 },
      { x: 90, y: 0, z: 0 },
      { x: 10, y: -45, z: 30 },
      { x: -170, y: 80, z: 5 }
    ]
    for (const degrees of cases) {
      const back = quatToEulerDegrees(eulerDegreesToQuat(degrees))
      expect(back.x).toBeCloseTo(degrees.x, 4)
      expect(back.y).toBeCloseTo(degrees.y, 4)
      expect(back.z).toBeCloseTo(degrees.z, 4)
    }
  })

  it('maps identity rotation to zero euler angles', () => {
    const degrees = quatToEulerDegrees({ x: 0, y: 0, z: 0, w: 1 })
    expect(degrees.x).toBeCloseTo(0)
    expect(degrees.y).toBeCloseTo(0)
    expect(degrees.z).toBeCloseTo(0)
  })

  it('produces a unit quaternion', () => {
    const q = eulerDegreesToQuat({ x: 33, y: 120, z: -60 })
    expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1, 6)
  })
})
