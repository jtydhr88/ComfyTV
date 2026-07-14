import { describe, it, expect } from 'vitest'
import { evenDim, presetDims, resolveTarget } from './videoResizeMath'

describe('evenDim', () => {
  it('rounds to the nearest even integer', () => {
    expect(evenDim(719)).toBe(720)
    expect(evenDim(721.2)).toBe(722)
    expect(evenDim(720)).toBe(720)
  })
  it('floors at 2', () => {
    expect(evenDim(0)).toBe(2)
    expect(evenDim(-4)).toBe(2)
  })
})

describe('presetDims', () => {
  it('applies short side to height for landscape sources', () => {
    expect(presetDims(720, 1920, 1080)).toEqual({ width: 1280, height: 720 })
  })
  it('applies short side to width for portrait sources', () => {
    expect(presetDims(720, 1080, 1920)).toEqual({ width: 720, height: 1280 })
  })
  it('returns null without source dims', () => {
    expect(presetDims(720, 0, 1080)).toBeNull()
    expect(presetDims(720, 1920, 0)).toBeNull()
  })
  it('keeps dims even', () => {
    const d = presetDims(480, 1279, 721)!
    expect(d.width % 2).toBe(0)
    expect(d.height % 2).toBe(0)
  })
})

describe('resolveTarget', () => {
  it('passes explicit dims through', () => {
    expect(resolveTarget(1280, 720, 1920, 1080)).toEqual({ width: 1280, height: 720 })
  })
  it('derives -1 width from height and aspect', () => {
    expect(resolveTarget(-1, 720, 1920, 1080)).toEqual({ width: 1280, height: 720 })
  })
  it('derives -1 height from width and aspect', () => {
    expect(resolveTarget(1280, -1, 1920, 1080)).toEqual({ width: 1280, height: 720 })
  })
  it('returns null when underivable', () => {
    expect(resolveTarget(-1, -1, 1920, 1080)).toBeNull()
    expect(resolveTarget(-1, 720, 0, 0)).toBeNull()
  })
})
