import { describe, expect, it } from 'vitest'

import { hydrateGateStats, withHydrateGate } from './hydrateGate'

describe('withHydrateGate', () => {
  it('runs at most three loads at once and drains the queue in order', async () => {
    const order: string[] = []
    let release: Array<() => void> = []
    const make = (name: string) => withHydrateGate(() => new Promise<string>((res) => {
      order.push('start:' + name)
      release.push(() => res(name))
    }))
    const all = ['a', 'b', 'c', 'd', 'e'].map(make)
    await Promise.resolve()
    expect(order).toEqual(['start:a', 'start:b', 'start:c'])
    expect(hydrateGateStats()).toEqual({ active: 3, queued: 2 })
    release[0]()
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(order).toContain('start:d')
    release.slice(1).forEach((r) => r())
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    release.slice(4).forEach((r) => r())
    expect(await Promise.all(all)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(hydrateGateStats()).toEqual({ active: 0, queued: 0 })
  })

  it('releases the slot when a load rejects', async () => {
    await expect(withHydrateGate(() => Promise.reject(new Error('x')))).rejects.toThrow('x')
    expect(hydrateGateStats()).toEqual({ active: 0, queued: 0 })
  })
})
