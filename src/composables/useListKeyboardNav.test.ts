import { describe, expect, it, vi } from 'vitest'

import { useListKeyboardNav, wrapIndex } from './useListKeyboardNav'

const key = (k: string) => ({ key: k } as KeyboardEvent)

describe('wrapIndex', () => {
  it('moves forward and wraps past the end', () => {
    expect(wrapIndex(0, 3, 1)).toBe(1)
    expect(wrapIndex(2, 3, 1)).toBe(0)
  })

  it('moves backward and wraps past the start', () => {
    expect(wrapIndex(0, 3, -1)).toBe(2)
    expect(wrapIndex(1, 3, -1)).toBe(0)
  })

  it('returns 0 for an empty list', () => {
    expect(wrapIndex(0, 0, 1)).toBe(0)
    expect(wrapIndex(5, 0, -1)).toBe(0)
  })

  it('handles a single-row list', () => {
    expect(wrapIndex(0, 1, 1)).toBe(0)
    expect(wrapIndex(0, 1, -1)).toBe(0)
  })
})

describe('useListKeyboardNav', () => {
  it('starts at 0 and wraps with moveUp/moveDown over the live count', () => {
    let count = 3
    const nav = useListKeyboardNav(() => count)
    expect(nav.activeIndex.value).toBe(0)
    nav.moveUp()
    expect(nav.activeIndex.value).toBe(2)
    nav.moveDown()
    expect(nav.activeIndex.value).toBe(0)
    count = 2
    nav.moveUp()
    expect(nav.activeIndex.value).toBe(1)
  })

  it('reset returns to 0', () => {
    const nav = useListKeyboardNav(() => 4)
    nav.moveDown()
    nav.reset()
    expect(nav.activeIndex.value).toBe(0)
  })

  it('onKeyDown maps arrows to movement and reports handled', () => {
    const nav = useListKeyboardNav(() => 3)
    expect(nav.onKeyDown(key('ArrowDown'), vi.fn())).toBe(true)
    expect(nav.activeIndex.value).toBe(1)
    expect(nav.onKeyDown(key('ArrowUp'), vi.fn())).toBe(true)
    expect(nav.activeIndex.value).toBe(0)
  })

  it('onKeyDown selects the active index on Enter and Tab', () => {
    const nav = useListKeyboardNav(() => 3)
    nav.moveDown()
    const onSelect = vi.fn()
    expect(nav.onKeyDown(key('Enter'), onSelect)).toBe(true)
    expect(onSelect).toHaveBeenCalledWith(1)
    expect(nav.onKeyDown(key('Tab'), onSelect)).toBe(true)
    expect(onSelect).toHaveBeenCalledTimes(2)
  })

  it('onKeyDown reports Escape as handled without selecting, and ignores other keys', () => {
    const nav = useListKeyboardNav(() => 3)
    const onSelect = vi.fn()
    expect(nav.onKeyDown(key('Escape'), onSelect)).toBe(true)
    expect(onSelect).not.toHaveBeenCalled()
    expect(nav.onKeyDown(key('a'), onSelect)).toBe(false)
  })
})
