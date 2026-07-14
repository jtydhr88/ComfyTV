import { describe, it, expect } from 'vitest'
import { MAX_MARKS, normalizeMarks, parseMarks, uniformMarks } from './videoFrameMarks'

describe('normalizeMarks', () => {
  it('sorts and dedupes at 10ms precision', () => {
    expect(normalizeMarks([2.0, 0.5, 2.001, 0.5])).toEqual([0.5, 2])
  })
  it('drops negatives and non-finite values', () => {
    expect(normalizeMarks([-1, NaN, Infinity, 1])).toEqual([1])
  })
  it('caps at MAX_MARKS', () => {
    const many = Array.from({ length: MAX_MARKS + 10 }, (_, i) => i)
    expect(normalizeMarks(many)).toHaveLength(MAX_MARKS)
  })
  it('keeps zero', () => {
    expect(normalizeMarks([0])).toEqual([0])
  })
})

describe('parseMarks', () => {
  it('parses and normalizes', () => {
    expect(parseMarks('[3, 1, 1]')).toEqual([1, 3])
  })
  it('returns [] for invalid JSON or non-arrays', () => {
    expect(parseMarks('oops')).toEqual([])
    expect(parseMarks('{"t":1}')).toEqual([])
    expect(parseMarks('')).toEqual([])
  })
  it('drops non-numeric entries', () => {
    expect(parseMarks('[1, "x", 2]')).toEqual([1, 2])
  })
})

describe('uniformMarks', () => {
  it('spreads n frame-centered marks over the duration', () => {
    expect(uniformMarks(2, 10)).toEqual([2.5, 7.5])
    expect(uniformMarks(4, 8)).toEqual([1, 3, 5, 7])
  })
  it('returns [] for zero duration or count', () => {
    expect(uniformMarks(3, 0)).toEqual([])
    expect(uniformMarks(0, 10)).toEqual([])
  })
})
