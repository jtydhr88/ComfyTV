import { describe, expect, it } from 'vitest'

import { advanceAimSpring, initAimSpring } from './aimSpring'

const STATIC = () => ({ x: 4, y: 1.3, z: -2 })

describe('aimSpring', () => {
  it('converges to a static target without overshoot ringing', () => {
    const state = advanceAimSpring(initAimSpring({ x: 0, y: 0, z: 0 }), STATIC, 120, 24)
    expect(state.aim.x).toBeCloseTo(4, 1)
    expect(state.aim.y).toBeCloseTo(1.3, 1)
    expect(state.aim.z).toBeCloseTo(-2, 1)
  })

  it('is deterministic: incremental advance equals recompute from scratch', () => {
    const moving = (s: number) => ({ x: s * 2, y: 1, z: Math.sin(s) })
    const incremental = initAimSpring(moving(0.25))
    advanceAimSpring(incremental, moving, 30, 24)
    advanceAimSpring(incremental, moving, 75, 24)

    const fresh = advanceAimSpring(initAimSpring(moving(0.25)), moving, 75, 24)
    expect(incremental.aim).toEqual(fresh.aim)
    expect(incremental.vel).toEqual(fresh.vel)
  })

  it('lags a moving target while leading ahead of it', () => {
    const moving = (s: number) => ({ x: s * 2, y: 0, z: 0 })
    const state = advanceAimSpring(initAimSpring(moving(0.25)), moving, 48, 24)
    const targetNow = moving(2).x
    expect(state.aim.x).toBeGreaterThan(targetNow * 0.7)
    expect(state.aim.x).toBeLessThan(targetNow * 1.1)
  })

  it('ignores advance requests behind the current step', () => {
    const state = advanceAimSpring(initAimSpring(STATIC()), STATIC, 50, 24)
    const steps = state.steps
    advanceAimSpring(state, STATIC, 10, 24)
    expect(state.steps).toBe(steps)
  })
})
