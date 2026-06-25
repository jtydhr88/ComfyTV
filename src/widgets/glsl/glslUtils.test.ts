import { describe, expect, it } from 'vitest'

import { detectPassCount } from './glslUtils'

describe('detectPassCount', () => {
  it('defaults to 1 when no pragma is present', () => {
    expect(detectPassCount('void main() {}')).toBe(1)
  })

  it('reads the pass count from a #pragma passes directive', () => {
    expect(detectPassCount('#pragma passes 3\nvoid main(){}')).toBe(3)
    expect(detectPassCount('#pragma   passes   5')).toBe(5)
  })

  it('clamps to a minimum of 1', () => {
    expect(detectPassCount('#pragma passes 0')).toBe(1)
  })
})
