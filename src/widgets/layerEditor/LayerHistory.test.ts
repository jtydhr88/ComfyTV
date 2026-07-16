import { describe, expect, it, vi } from 'vitest'

import { LayerHistory, type LayerHistorySnapshot } from './LayerHistory'

function snap(json: string, selectedId: string | null = null): LayerHistorySnapshot {
  return { json, selectedId }
}

function makeClock(start = 1000) {
  let t = start
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms
    },
  }
}

describe('LayerHistory', () => {
  it('starts empty', () => {
    const h = new LayerHistory()
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(false)
    expect(h.undo(snap('cur'))).toBeNull()
    expect(h.redo(snap('cur'))).toBeNull()
    expect(h.allJson()).toEqual([])
  })

  it('record + undo returns the recorded snapshot and pushes current onto redo', () => {
    const h = new LayerHistory()
    h.record(snap('a', 'l1'))
    expect(h.canUndo()).toBe(true)

    const undone = h.undo(snap('b', 'l2'))
    expect(undone).toEqual({ json: 'a', selectedId: 'l1' })
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(true)

    const redone = h.redo(snap('a', 'l1'))
    expect(redone).toEqual({ json: 'b', selectedId: 'l2' })
    expect(h.canUndo()).toBe(true)
    expect(h.canRedo()).toBe(false)
  })

  it('works with the default Date.now clock', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(50_000)
      const h = new LayerHistory({ mergeWindowMs: 500 })
      h.record(snap('a'), 'drag')
      vi.setSystemTime(50_100)
      h.record(snap('b'), 'drag')
      expect(h.allJson()).toEqual(['a']) // merged within window
    } finally {
      vi.useRealTimers()
    }
  })

  describe('merge behaviour', () => {
    it('merges consecutive records sharing a mergeKey inside the window', () => {
      const clock = makeClock()
      const h = new LayerHistory({ mergeWindowMs: 500, now: clock.now })
      h.record(snap('a'), 'opacity')
      clock.advance(100)
      h.record(snap('b'), 'opacity')
      // merged: only the first "before" is kept
      expect(h.allJson()).toEqual(['a'])
      expect(h.undo(snap('c'))).toEqual({ json: 'a', selectedId: null })
    })

    it('merge refreshes the timestamp so a chain of small edits keeps merging', () => {
      const clock = makeClock()
      const h = new LayerHistory({ mergeWindowMs: 500, now: clock.now })
      h.record(snap('a'), 'drag')
      clock.advance(400)
      h.record(snap('b'), 'drag') // merged, time refreshed
      clock.advance(400)
      h.record(snap('c'), 'drag') // 800ms after first record, but only 400ms after refresh
      expect(h.allJson()).toEqual(['a'])
    })

    it('does not merge when the window has elapsed', () => {
      const clock = makeClock()
      const h = new LayerHistory({ mergeWindowMs: 500, now: clock.now })
      h.record(snap('a'), 'drag')
      clock.advance(500) // time - last.time === window is NOT < window
      h.record(snap('b'), 'drag')
      expect(h.allJson()).toEqual(['a', 'b'])
    })

    it('does not merge records with different mergeKeys', () => {
      const clock = makeClock()
      const h = new LayerHistory({ now: clock.now })
      h.record(snap('a'), 'drag')
      h.record(snap('b'), 'rotate')
      expect(h.allJson()).toEqual(['a', 'b'])
    })

    it('does not merge when mergeKey is undefined', () => {
      const clock = makeClock()
      const h = new LayerHistory({ now: clock.now })
      h.record(snap('a'))
      h.record(snap('b'))
      expect(h.allJson()).toEqual(['a', 'b'])
    })

    it('does not merge into an entry that has no mergeKey', () => {
      const clock = makeClock()
      const h = new LayerHistory({ now: clock.now })
      h.record(snap('a'))
      h.record(snap('b'), 'drag')
      expect(h.allJson()).toEqual(['a', 'b'])
    })
  })

  it('drops the oldest entry when the limit is exceeded', () => {
    const clock = makeClock()
    const h = new LayerHistory({ limit: 3, now: clock.now })
    for (const j of ['a', 'b', 'c', 'd']) h.record(snap(j))
    expect(h.allJson()).toEqual(['b', 'c', 'd'])
  })

  it('clears the redo stack on record', () => {
    const clock = makeClock()
    const h = new LayerHistory({ now: clock.now })
    h.record(snap('a'))
    h.undo(snap('b'))
    expect(h.canRedo()).toBe(true)
    h.record(snap('c'))
    expect(h.canRedo()).toBe(false)
  })

  it('allJson lists undo entries then redo entries', () => {
    const clock = makeClock()
    const h = new LayerHistory({ now: clock.now })
    h.record(snap('a'))
    h.record(snap('b'))
    h.undo(snap('cur'))
    expect(h.allJson()).toEqual(['a', 'cur'])
  })

  describe('dropOldest', () => {
    it('removes up to count entries from the front and returns how many', () => {
      const clock = makeClock()
      const h = new LayerHistory({ now: clock.now })
      for (const j of ['a', 'b', 'c']) h.record(snap(j))
      expect(h.dropOldest(2)).toBe(2)
      expect(h.allJson()).toEqual(['c'])
    })

    it('clamps to the stack size', () => {
      const clock = makeClock()
      const h = new LayerHistory({ now: clock.now })
      h.record(snap('a'))
      expect(h.dropOldest(10)).toBe(1)
      expect(h.canUndo()).toBe(false)
    })

    it('returns 0 when there is nothing to drop', () => {
      const h = new LayerHistory()
      expect(h.dropOldest(5)).toBe(0)
      expect(h.dropOldest(0)).toBe(0)
    })

    it('does not touch the redo stack', () => {
      const clock = makeClock()
      const h = new LayerHistory({ now: clock.now })
      h.record(snap('a'))
      h.undo(snap('b'))
      expect(h.dropOldest(5)).toBe(0)
      expect(h.canRedo()).toBe(true)
    })
  })

  it('clear empties both stacks', () => {
    const clock = makeClock()
    const h = new LayerHistory({ now: clock.now })
    h.record(snap('a'))
    h.record(snap('b'))
    h.undo(snap('c'))
    h.clear()
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(false)
    expect(h.allJson()).toEqual([])
  })

  it('supports multi-step undo/redo round trips', () => {
    const clock = makeClock()
    const h = new LayerHistory({ now: clock.now })
    h.record(snap('s0'))
    h.record(snap('s1'))
    // current doc is s2
    expect(h.undo(snap('s2'))).toEqual(snap('s1'))
    expect(h.undo(snap('s1'))).toEqual(snap('s0'))
    expect(h.redo(snap('s0'))).toEqual(snap('s1'))
    expect(h.redo(snap('s1'))).toEqual(snap('s2'))
    expect(h.canRedo()).toBe(false)
    expect(h.canUndo()).toBe(true)
  })
})
