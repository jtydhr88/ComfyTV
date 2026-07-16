import { describe, expect, it } from 'vitest'

import { BLEND_MODES } from './types'

describe('BLEND_MODES', () => {
  it('lists the 12 supported canvas composite modes', () => {
    expect(BLEND_MODES).toHaveLength(12)
    expect(BLEND_MODES[0]).toBe('source-over')
    expect(BLEND_MODES).toContain('multiply')
    expect(BLEND_MODES).toContain('exclusion')
  })

  it('contains no duplicates', () => {
    expect(new Set(BLEND_MODES).size).toBe(BLEND_MODES.length)
  })
})
