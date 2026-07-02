import { beforeEach, describe, expect, it } from 'vitest'

import { openLightbox, useLightbox, type LightboxItem } from './useLightbox'

function items(n: number): LightboxItem[] {
  return Array.from({ length: n }, (_, i) => ({
    url: `u${i}`,
    label: `l${i}`,
  }))
}

describe('useLightbox', () => {
  beforeEach(() => {
    useLightbox().close()
  })

  it('starts closed', () => {
    const lb = useLightbox()
    expect(lb.isOpen.value).toBe(false)
    expect(lb.current.value).toBeNull()
    expect(lb.count.value).toBe(0)
    expect(lb.index.value).toBe(-1)
    expect(lb.hasPrev.value).toBe(false)
    expect(lb.hasNext.value).toBe(false)
  })

  it('opens at the given index', () => {
    const lb = useLightbox()
    lb.open(items(3), 1)
    expect(lb.isOpen.value).toBe(true)
    expect(lb.count.value).toBe(3)
    expect(lb.index.value).toBe(1)
    expect(lb.current.value).toEqual({ url: 'u1', label: 'l1' })
  })

  it('defaults the start index to 0', () => {
    const lb = useLightbox()
    lb.open(items(3))
    expect(lb.index.value).toBe(0)
  })

  it('clamps the start index into range', () => {
    const lb = useLightbox()
    lb.open(items(3), 99)
    expect(lb.index.value).toBe(2)
    lb.open(items(3), -5)
    expect(lb.index.value).toBe(0)
  })

  it('drops empty / urlless items', () => {
    const lb = useLightbox()
    openLightbox([
      { url: 'a' },
      { url: '' },
      null as unknown as LightboxItem,
      { url: 'b' },
    ])
    expect(lb.count.value).toBe(2)
    expect(lb.current.value?.url).toBe('a')
  })

  it('ignores an all-empty list and stays closed', () => {
    const lb = useLightbox()
    openLightbox([{ url: '' }])
    expect(lb.isOpen.value).toBe(false)
    expect(lb.count.value).toBe(0)
  })

  it('navigates next/prev and stops at both ends (no wrap)', () => {
    const lb = useLightbox()
    lb.open(items(3), 0)
    expect(lb.hasPrev.value).toBe(false)
    expect(lb.hasNext.value).toBe(true)

    lb.prev()
    expect(lb.index.value).toBe(0)

    lb.next()
    expect(lb.index.value).toBe(1)
    expect(lb.hasPrev.value).toBe(true)
    expect(lb.hasNext.value).toBe(true)

    lb.next()
    expect(lb.index.value).toBe(2)
    expect(lb.hasNext.value).toBe(false)

    lb.next()
    expect(lb.index.value).toBe(2)

    lb.prev()
    expect(lb.index.value).toBe(1)
  })

  it('has no prev/next for a single item', () => {
    const lb = useLightbox()
    lb.open(items(1))
    expect(lb.hasPrev.value).toBe(false)
    expect(lb.hasNext.value).toBe(false)
  })

  it('close resets state', () => {
    const lb = useLightbox()
    lb.open(items(3), 2)
    lb.close()
    expect(lb.isOpen.value).toBe(false)
    expect(lb.count.value).toBe(0)
    expect(lb.index.value).toBe(-1)
    expect(lb.current.value).toBeNull()
  })
})
