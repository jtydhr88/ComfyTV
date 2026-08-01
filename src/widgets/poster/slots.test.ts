import { describe, expect, it } from 'vitest'
import { connectedImageCount, curSlot, defaultSlot } from './slots'

describe('defaultSlot', () => {
  it("uses the element's own slot when present", () => {
    expect(defaultSlot({ slot: 4 })).toBe(4)
  })
  it('parses bind=image:N', () => {
    expect(defaultSlot({ bind: 'image:2' })).toBe(2)
  })
  it('falls back to 0', () => {
    expect(defaultSlot({ bind: 'title' })).toBe(0)
    expect(defaultSlot({})).toBe(0)
  })
})

describe('curSlot', () => {
  it('override wins', () => {
    expect(curSlot({ slot: 1 }, { slot: 7 })).toBe(7)
  })
  it('falls back to default when no override', () => {
    expect(curSlot({ slot: 1 }, null)).toBe(1)
    expect(curSlot({ bind: 'image:3' })).toBe(3)
  })
  it('uses default when the override has no slot field', () => {
    expect(curSlot({ slot: 2 }, {})).toBe(2)
  })
})

describe('connectedImageCount', () => {
  it('counts wired autogrow inputs by highest index', () => {
    const inputs = [
      { name: 'images.image0', link: 9 },
      { name: 'images.image1', link: 10 },
      { name: 'images.image2', link: null },
    ]
    expect(connectedImageCount(inputs)).toBe(2)
  })
  it('ignores non-image inputs', () => {
    expect(connectedImageCount([{ name: 'mask', link: 1 }])).toBe(0)
  })
  it('handles empty', () => {
    expect(connectedImageCount([])).toBe(0)
  })
})
