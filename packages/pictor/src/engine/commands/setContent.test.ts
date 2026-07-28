import { describe, expect, it } from 'vitest'

import { DefaultContentStore } from '../impl/contentStore'
import { History } from '../history'
import { SetContentCommand } from './setContent'

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

describe('SetContentCommand', () => {
  it('swaps the slot content id on undo/redo', () => {
    const store = new DefaultContentStore()
    const before = store.register(canvas(8, 8))
    const after = store.register(canvas(8, 8))
    const slot = { contentId: after }
    const cmd = new SetContentCommand('Paint', slot, before, after, store)

    cmd.apply('undo')
    expect(slot.contentId).toBe(before)
    cmd.apply('redo')
    expect(slot.contentId).toBe(after)
  })

  it('reports the after-content byte size for the history budget', () => {
    const store = new DefaultContentStore()
    const after = store.register(canvas(10, 10))
    const cmd = new SetContentCommand('Paint', { contentId: after }, 'x', after, store)
    expect(cmd.sizeBytes()).toBe(400)
  })

  it('drives History undo/redo end-to-end', () => {
    const store = new DefaultContentStore()
    const a = store.register(canvas(4, 4))
    const b = store.register(canvas(4, 4))
    const slot = { contentId: b }
    const history = new History()
    history.push(new SetContentCommand('Paint', slot, a, b, store))

    expect(slot.contentId).toBe(b)
    history.undo()
    expect(slot.contentId).toBe(a)
    history.redo()
    expect(slot.contentId).toBe(b)
  })
})
