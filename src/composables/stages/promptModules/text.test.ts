import { describe, expect, it } from 'vitest'

import { hasToken, promptSegments, toggleToken } from './text'

describe('promptSegments', () => {
  it('splits on commas, trims, drops blanks', () => {
    expect(promptSegments('a,  b ,, c')).toEqual(['a', 'b', 'c'])
    expect(promptSegments('   ')).toEqual([])
  })
})

describe('hasToken', () => {
  it('matches a single segment case-insensitively', () => {
    expect(hasToken('a cat, Cinematic Lighting, blue', 'cinematic lighting')).toBe(true)
    expect(hasToken('a cat, blue', 'cinematic lighting')).toBe(false)
  })

  it('does not partial-match within a segment', () => {
    expect(hasToken('artistic, blue', 'art')).toBe(false)
  })

  it('matches a multi-segment token as a contiguous run', () => {
    expect(hasToken('hi, soft light, studio lighting, pro', 'soft light, studio lighting')).toBe(true)
    expect(hasToken('hi, soft light, pro, studio lighting', 'soft light, studio lighting')).toBe(false)
  })
})

describe('toggleToken', () => {
  it('appends a token to an empty prompt', () => {
    expect(toggleToken('', '8K resolution')).toBe('8K resolution')
  })

  it('appends with a comma separator when absent', () => {
    expect(toggleToken('a cat', '8K resolution')).toBe('a cat, 8K resolution')
  })

  it('removes a token when already present', () => {
    expect(toggleToken('a cat, 8K resolution, blue', '8K resolution')).toBe('a cat, blue')
  })

  it('round-trips: toggle twice returns to the original segments', () => {
    const start = 'a cat, blue'
    const once = toggleToken(start, 'neon glow')
    expect(once).toBe('a cat, blue, neon glow')
    expect(toggleToken(once, 'neon glow')).toBe('a cat, blue')
  })

  it('toggles a multi-segment quick prompt in and out', () => {
    const q = 'soft studio lighting, 85mm lens'
    const added = toggleToken('a hero', q)
    expect(added).toBe('a hero, soft studio lighting, 85mm lens')
    expect(toggleToken(added, q)).toBe('a hero')
  })
})
