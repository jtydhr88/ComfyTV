import { describe, expect, it } from 'vitest'

import { Scene3dHistory } from './Scene3dHistory'

function snap(json: string, selectedId: string | null = null) {
  return { json, selectedId }
}

function makeHistory(opts?: { limit?: number; mergeWindowMs?: number }) {
  let time = 0
  const history = new Scene3dHistory({ ...opts, now: () => time })
  return {
    history,
    tick: (ms: number) => {
      time += ms
    }
  }
}

describe('Scene3dHistory', () => {
  it('starts empty', () => {
    const { history } = makeHistory()
    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(false)
    expect(history.undo(snap('x'))).toBeNull()
    expect(history.redo(snap('x'))).toBeNull()
  })

  it('undoes to the recorded snapshot and redoes back', () => {
    const { history } = makeHistory()
    history.record(snap('a', 'obj-1'))

    const undone = history.undo(snap('b', 'obj-2'))
    expect(undone).toEqual({ json: 'a', selectedId: 'obj-1' })
    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(true)

    const redone = history.redo(snap('a', 'obj-1'))
    expect(redone).toEqual({ json: 'b', selectedId: 'obj-2' })
    expect(history.canUndo()).toBe(true)
    expect(history.canRedo()).toBe(false)
  })

  it('walks a multi-step chain in order', () => {
    const { history, tick } = makeHistory()
    history.record(snap('a'))
    tick(1000)
    history.record(snap('b'))
    tick(1000)
    history.record(snap('c'))

    expect(history.undo(snap('d'))?.json).toBe('c')
    expect(history.undo(snap('c'))?.json).toBe('b')
    expect(history.redo(snap('b'))?.json).toBe('c')
    expect(history.undo(snap('c'))?.json).toBe('b')
    expect(history.undo(snap('b'))?.json).toBe('a')
    expect(history.canUndo()).toBe(false)
  })

  it('merges consecutive records with the same mergeKey inside the window', () => {
    const { history, tick } = makeHistory()
    history.record(snap('a'), 'transform:obj-1')
    tick(100)
    history.record(snap('b'), 'transform:obj-1')
    tick(100)
    history.record(snap('c'), 'transform:obj-1')

    expect(history.undo(snap('d'))?.json).toBe('a')
    expect(history.canUndo()).toBe(false)
  })

  it('keeps merging while each step stays inside the window', () => {
    const { history, tick } = makeHistory({ mergeWindowMs: 500 })
    history.record(snap('a'), 'k')
    tick(400)
    history.record(snap('b'), 'k')
    tick(400)
    history.record(snap('c'), 'k')

    expect(history.undo(snap('d'))?.json).toBe('a')
    expect(history.canUndo()).toBe(false)
  })

  it('does not merge across the merge window', () => {
    const { history, tick } = makeHistory({ mergeWindowMs: 500 })
    history.record(snap('a'), 'k')
    tick(600)
    history.record(snap('b'), 'k')

    expect(history.undo(snap('c'))?.json).toBe('b')
    expect(history.undo(snap('b'))?.json).toBe('a')
  })

  it('does not merge different mergeKeys or missing mergeKeys', () => {
    const { history } = makeHistory()
    history.record(snap('a'), 'light:1')
    history.record(snap('b'), 'light:2')
    history.record(snap('c'))
    history.record(snap('d'))

    expect(history.undo(snap('e'))?.json).toBe('d')
    expect(history.undo(snap('d'))?.json).toBe('c')
    expect(history.undo(snap('c'))?.json).toBe('b')
    expect(history.undo(snap('b'))?.json).toBe('a')
  })

  it('does not merge a record into an entry re-pushed by redo', () => {
    const { history } = makeHistory()
    history.record(snap('a'), 'k')
    history.undo(snap('b'))
    history.redo(snap('a'))

    history.record(snap('b'), 'k')
    expect(history.undo(snap('c'))?.json).toBe('b')
    expect(history.undo(snap('b'))?.json).toBe('a')
  })

  it('clears the redo stack on a new record', () => {
    const { history, tick } = makeHistory()
    history.record(snap('a'))
    tick(1000)
    history.record(snap('b'))
    history.undo(snap('c'))
    expect(history.canRedo()).toBe(true)

    tick(1000)
    history.record(snap('b2'))
    expect(history.canRedo()).toBe(false)
  })

  it('drops the oldest entries beyond the limit', () => {
    const { history, tick } = makeHistory({ limit: 3 })
    for (const json of ['a', 'b', 'c', 'd']) {
      history.record(snap(json))
      tick(1000)
    }

    expect(history.undo(snap('e'))?.json).toBe('d')
    expect(history.undo(snap('d'))?.json).toBe('c')
    expect(history.undo(snap('c'))?.json).toBe('b')
    expect(history.canUndo()).toBe(false)
  })

  it('clear() empties both stacks', () => {
    const { history, tick } = makeHistory()
    history.record(snap('a'))
    tick(1000)
    history.record(snap('b'))
    history.undo(snap('c'))
    history.clear()

    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(false)
  })
})
