import { describe, it, expect } from 'vitest'
import { TRANSITION_GROUPS, transitionGroupOf } from './transitionCatalog'
import { XFADE_TRANSITIONS } from './videoTransitionMath'

describe('transitionCatalog', () => {
  it('covers every xfade transition exactly once', () => {
    const all = TRANSITION_GROUPS.flatMap((g) => [...g.names])
    expect(new Set(all).size).toBe(all.length)
    expect([...all].sort()).toEqual([...XFADE_TRANSITIONS].sort())
  })

  it('maps names to their group', () => {
    expect(transitionGroupOf('wipetl')).toBe('wipe')
    expect(transitionGroupOf('smoothdown')).toBe('slide')
    expect(transitionGroupOf('hblur')).toBe('fx')
    expect(transitionGroupOf('unknown')).toBe('fade')
  })
})
