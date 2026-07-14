import { describe, it, expect } from 'vitest'
import { parseOrder, reconcileOrder } from './videoConcatOrder'

describe('parseOrder', () => {
  it('parses a JSON string array', () => {
    expect(parseOrder('["video2","video0"]')).toEqual(['video2', 'video0'])
  })
  it('coerces non-string entries to strings', () => {
    expect(parseOrder('[1, 2]')).toEqual(['1', '2'])
  })
  it('returns [] for invalid JSON', () => {
    expect(parseOrder('not json')).toEqual([])
    expect(parseOrder('')).toEqual([])
  })
  it('returns [] for non-array JSON', () => {
    expect(parseOrder('{"a":1}')).toEqual([])
    expect(parseOrder('"video0"')).toEqual([])
  })
})

describe('reconcileOrder', () => {
  it('keeps saved order for still-connected keys', () => {
    expect(reconcileOrder(['b', 'a'], ['a', 'b'])).toEqual(['b', 'a'])
  })
  it('drops disconnected keys', () => {
    expect(reconcileOrder(['b', 'gone', 'a'], ['a', 'b'])).toEqual(['b', 'a'])
  })
  it('appends newly connected keys at the end', () => {
    expect(reconcileOrder(['b', 'a'], ['a', 'b', 'c'])).toEqual(['b', 'a', 'c'])
  })
  it('handles empty saved order', () => {
    expect(reconcileOrder([], ['a', 'b'])).toEqual(['a', 'b'])
  })
  it('handles empty current keys', () => {
    expect(reconcileOrder(['a', 'b'], [])).toEqual([])
  })
})
