import { beforeEach, describe, expect, it } from 'vitest'

import { ContentStore } from './ContentStore'

function canvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}

describe('ContentStore', () => {
  let store: ContentStore

  beforeEach(() => {
    store = new ContentStore()
  })

  describe('register', () => {
    it('generates an id with the content prefix when none is given', () => {
      const id = store.register(canvas(4, 4))
      expect(id).toMatch(/^content-/)
      expect(store.has(id)).toBe(true)
    })

    it('uses the provided id and uploadedUrl', () => {
      const id = store.register(canvas(2, 3), { id: 'my-id', uploadedUrl: 'http://x/y.png' })
      expect(id).toBe('my-id')
      const entry = store.get('my-id')!
      expect(entry).toMatchObject({
        id: 'my-id',
        width: 2,
        height: 3,
        uploadedUrl: 'http://x/y.png',
      })
    })

    it('defaults uploadedUrl to null and snapshots canvas dimensions', () => {
      const c = canvas(10, 20)
      const id = store.register(c)
      const entry = store.get(id)!
      expect(entry.uploadedUrl).toBeNull()
      expect(entry.canvas).toBe(c)
      expect(entry.width).toBe(10)
      expect(entry.height).toBe(20)
    })

    it('generates distinct ids across registrations', () => {
      const a = store.register(canvas(1, 1))
      const b = store.register(canvas(1, 1))
      expect(a).not.toBe(b)
    })
  })

  describe('get / has', () => {
    it('returns undefined and false for unknown ids', () => {
      expect(store.get('missing')).toBeUndefined()
      expect(store.has('missing')).toBe(false)
    })
  })

  describe('markUploaded', () => {
    it('sets uploadedUrl on an existing entry', () => {
      const id = store.register(canvas(1, 1))
      store.markUploaded(id, 'http://server/a.png')
      expect(store.get(id)!.uploadedUrl).toBe('http://server/a.png')
    })

    it('is a no-op for unknown ids', () => {
      expect(() => store.markUploaded('nope', 'http://server/a.png')).not.toThrow()
      expect(store.has('nope')).toBe(false)
    })
  })

  describe('dirtyIds', () => {
    it('lists only entries without an uploadedUrl', () => {
      const dirty1 = store.register(canvas(1, 1))
      const clean = store.register(canvas(1, 1), { uploadedUrl: 'http://x' })
      const dirty2 = store.register(canvas(1, 1))
      store.markUploaded(dirty2, 'http://y')
      expect(store.dirtyIds()).toEqual([dirty1])
      expect(store.dirtyIds()).not.toContain(clean)
    })

    it('is empty for an empty store', () => {
      expect(store.dirtyIds()).toEqual([])
    })
  })

  describe('collectGarbage', () => {
    it('removes entries not in the live set and keeps the rest', () => {
      const keep = store.register(canvas(1, 1))
      const drop = store.register(canvas(1, 1))
      store.collectGarbage(new Set([keep]))
      expect(store.has(keep)).toBe(true)
      expect(store.has(drop)).toBe(false)
    })

    it('clears everything when the live set is empty', () => {
      store.register(canvas(1, 1))
      store.register(canvas(1, 1))
      store.collectGarbage(new Set())
      expect(store.dirtyIds()).toEqual([])
      expect(store.totalBytes()).toBe(0)
    })
  })

  describe('totalBytes', () => {
    it('sums width * height * 4 across entries', () => {
      store.register(canvas(10, 10))
      store.register(canvas(2, 5))
      expect(store.totalBytes()).toBe(10 * 10 * 4 + 2 * 5 * 4)
    })

    it('returns 0 when empty', () => {
      expect(store.totalBytes()).toBe(0)
    })
  })

  describe('clear', () => {
    it('drops all entries', () => {
      const id = store.register(canvas(1, 1))
      store.clear()
      expect(store.has(id)).toBe(false)
      expect(store.get(id)).toBeUndefined()
      expect(store.totalBytes()).toBe(0)
    })
  })
})
