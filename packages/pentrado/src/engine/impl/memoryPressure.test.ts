import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  __setPressureForTests,
  idleMs,
  noteActivity,
  pressureLevel,
  pressureScale,
  startPressureSampler,
} from './memoryPressure'

afterEach(() => {
  __setPressureForTests(0, 0)
  vi.useRealTimers()
})

describe('memory pressure', () => {
  it('scales budgets by level', () => {
    expect(pressureScale()).toBe(1)
    __setPressureForTests(1)
    expect(pressureScale()).toBe(0.5)
    __setPressureForTests(2)
    expect(pressureScale()).toBe(0.25)
  })

  it('tracks idle time from the last activity', () => {
    __setPressureForTests(0, 5000)
    expect(idleMs()).toBeGreaterThanOrEqual(5000)
    noteActivity()
    expect(idleMs()).toBeLessThan(100)
  })

  it('the sampler maps bytes to levels and only fires onChange on transitions', async () => {
    vi.useFakeTimers()
    const readings = [1e9, 2e9, 2e9, 3e9, 1e9]
    const sample = vi.fn(async () => readings.shift() ?? 1e9)
    const changes: number[] = []
    const stop = startPressureSampler({ sample, intervalMs: 100, moderateBytes: 1.5e9, criticalBytes: 2.5e9, onChange: (l) => changes.push(l) })
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(100)
    }
    expect(sample.mock.calls.length).toBeGreaterThanOrEqual(5)
    expect(changes).toEqual([1, 2, 0])
    expect(pressureLevel()).toBe(0)
    stop()
  })

  it('a null sample (API unavailable) leaves the level untouched', async () => {
    vi.useFakeTimers()
    __setPressureForTests(1)
    const stop = startPressureSampler({ sample: async () => null, intervalMs: 50 })
    await vi.advanceTimersByTimeAsync(120)
    expect(pressureLevel()).toBe(1)
    stop()
    expect(pressureLevel()).toBe(0)
  })
})
