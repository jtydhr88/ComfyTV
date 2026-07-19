import { describe, it, expect } from 'vitest'
import {
  isNaturalOrder,
  moveDown,
  moveUp,
  normalizeOrder,
  parseOrder,
  serializeOrder,
} from './fxChainOrder'

describe('parseOrder', () => {
  it('parses a JSON array of 1-based ordinals', () => {
    expect(parseOrder('[2,1,3]', 3)).toEqual([2, 1, 3])
  })
  it('returns [] for empty, invalid JSON, or non-arrays', () => {
    expect(parseOrder('', 3)).toEqual([])
    expect(parseOrder('oops', 3)).toEqual([])
    expect(parseOrder('{"a":1}', 3)).toEqual([])
  })
  it('drops out-of-range, non-integer and duplicate ordinals', () => {
    expect(parseOrder('[0,1,2,9,1.5,2,"x"]', 3)).toEqual([1, 2])
  })
  it('accepts numeric strings', () => {
    expect(parseOrder('["2","1"]', 2)).toEqual([2, 1])
  })
})

describe('normalizeOrder', () => {
  it('appends missing naturals in ascending order', () => {
    expect(normalizeOrder([3], 3)).toEqual([3, 1, 2])
  })
  it('drops stale ordinals beyond the connected count', () => {
    expect(normalizeOrder([4, 2, 1], 2)).toEqual([2, 1])
  })
  it('dedupes while keeping first occurrence', () => {
    expect(normalizeOrder([2, 2, 1], 2)).toEqual([2, 1])
  })
  it('yields naturals for an empty saved order', () => {
    expect(normalizeOrder([], 3)).toEqual([1, 2, 3])
  })
  it('yields [] when nothing is connected', () => {
    expect(normalizeOrder([1, 2], 0)).toEqual([])
  })
})

describe('isNaturalOrder', () => {
  it('is true for [] and ascending naturals', () => {
    expect(isNaturalOrder([])).toBe(true)
    expect(isNaturalOrder([1, 2, 3])).toBe(true)
  })
  it('is false for any permutation', () => {
    expect(isNaturalOrder([2, 1])).toBe(false)
    expect(isNaturalOrder([1, 3, 2])).toBe(false)
  })
})

describe('moveUp / moveDown', () => {
  it('moveUp swaps with the previous position', () => {
    expect(moveUp([1, 2, 3], 1)).toEqual([2, 1, 3])
  })
  it('moveDown swaps with the next position', () => {
    expect(moveDown([1, 2, 3], 1)).toEqual([1, 3, 2])
  })
  it('returns an unchanged copy at the ends and out of range', () => {
    expect(moveUp([1, 2], 0)).toEqual([1, 2])
    expect(moveDown([1, 2], 1)).toEqual([1, 2])
    expect(moveDown([1, 2], 9)).toEqual([1, 2])
    const src = [1, 2]
    expect(moveUp(src, 0)).not.toBe(src)
  })
})

describe('serializeOrder', () => {
  it('returns "" for the natural order', () => {
    expect(serializeOrder([])).toBe('')
    expect(serializeOrder([1, 2, 3])).toBe('')
  })
  it('returns JSON for a custom order', () => {
    expect(serializeOrder([2, 1])).toBe('[2,1]')
  })
})
