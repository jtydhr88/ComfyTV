import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { rafTickerSubscriberCount, subscribeRafTick } from './sharedRafTicker'

describe('sharedRafTicker', () => {
  const rafCbs: FrameRequestCallback[] = []
  let caf: ReturnType<typeof vi.fn>

  beforeEach(() => {
    rafCbs.length = 0
    vi.stubGlobal('requestAnimationFrame',
      (cb: FrameRequestCallback) => { rafCbs.push(cb); return rafCbs.length })
    caf = vi.fn()
    vi.stubGlobal('cancelAnimationFrame', caf)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const tick = () => { const cb = rafCbs.shift(); cb?.(0) }

  it('drives all subscribers from a single raf', () => {
    const a = vi.fn()
    const b = vi.fn()
    const unsubA = subscribeRafTick(a)
    const unsubB = subscribeRafTick(b)
    expect(rafCbs.length).toBe(1)
    tick()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    expect(rafCbs.length).toBe(1)
    unsubA()
    unsubB()
  })

  it('stops the raf loop when the last subscriber leaves', () => {
    const unsub = subscribeRafTick(vi.fn())
    expect(rafTickerSubscriberCount()).toBe(1)
    unsub()
    expect(rafTickerSubscriberCount()).toBe(0)
    expect(caf).toHaveBeenCalled()
  })

  it('unsubscribe is idempotent and a throwing subscriber does not break others', () => {
    const bad = vi.fn(() => { throw new Error('boom') })
    const good = vi.fn()
    const unsubBad = subscribeRafTick(bad)
    const unsubGood = subscribeRafTick(good)
    tick()
    expect(good).toHaveBeenCalledTimes(1)
    unsubBad()
    unsubBad()
    expect(rafTickerSubscriberCount()).toBe(1)
    unsubGood()
  })
})
