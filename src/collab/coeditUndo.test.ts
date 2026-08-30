import { describe, expect, it, vi } from 'vitest'

vi.mock('@/composables/dialog/useConfirmDialog', () => ({ askConfirm: vi.fn() }))
vi.mock('@/i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))

import type { DocRecords, EditOp } from './coedit'
import { applyOpsToRecords } from './coedit'
import { createUndoStack, invertOps } from './coeditUndo'

function doc(): DocRecords {
  return {
    nodes: {
      '5': { type: 'A', pos: [10, 20], size: [100, 50], title: 't', mode: 0, widgets: { seed: 1 } },
    },
    links: { '5:0>7:0': { origin: '5', oslot: 0, target: '7', tslot: 0 } },
  }
}

describe('invertOps', () => {
  it('patch inverse restores old field values', () => {
    const prev = doc()
    const ops: EditOp[] = [{ kind: 'node', op: 'patch', id: '5', fields: { pos: [99, 99], widgets: { seed: 2 } } }]
    const inv = invertOps(prev, ops)
    expect(inv).toEqual([{ kind: 'node', op: 'patch', id: '5', fields: { pos: [10, 20], widgets: { seed: 1 } } }])
  })

  it('put(add) inverse removes; remove inverse restores', () => {
    const prev = doc()
    const addOps: EditOp[] = [{ kind: 'node', op: 'put', id: '9', data: { type: 'B', pos: [0, 0], size: [1, 1], title: '', mode: 0, widgets: {} } }]
    expect(invertOps(prev, addOps)).toEqual([{ kind: 'node', op: 'remove', id: '9' }])
    const rmOps: EditOp[] = [{ kind: 'node', op: 'remove', id: '5' }]
    expect(invertOps(prev, rmOps)[0]).toMatchObject({ op: 'put', id: '5', data: { type: 'A' } })
  })

  it('link put/remove invert symmetrically', () => {
    const prev = doc()
    expect(invertOps(prev, [{ kind: 'link', op: 'remove', id: '5:0>7:0' }]))
      .toEqual([{ kind: 'link', op: 'put', id: '5:0>7:0', data: { origin: '5', oslot: 0, target: '7', tslot: 0 } }])
    expect(invertOps(prev, [{ kind: 'link', op: 'put', id: '1:0>2:0', data: { origin: '1', oslot: 0, target: '2', tslot: 0 } }]))
      .toEqual([{ kind: 'link', op: 'remove', id: '1:0>2:0' }])
  })

  it('round-trip: forward then inverse returns to the original doc', () => {
    const original = doc()
    const working = doc()
    const ops: EditOp[] = [
      { kind: 'node', op: 'patch', id: '5', fields: { pos: [50, 50] } },
      { kind: 'node', op: 'remove', id: '5' },
      { kind: 'link', op: 'remove', id: '5:0>7:0' },
    ]
    const inv = invertOps(original, ops)
    applyOpsToRecords(working, ops)
    applyOpsToRecords(working, inv)
    expect(working).toEqual(original)
  })
})

describe('createUndoStack', () => {
  it('undo pops inverse, redo replays forward, new record clears redo', () => {
    let t = 0
    const stack = createUndoStack(() => t)
    const prev = doc()
    stack.record(prev, [{ kind: 'node', op: 'patch', id: '5', fields: { title: 'x' } }])
    t += 5000
    stack.record(prev, [{ kind: 'node', op: 'patch', id: '5', fields: { mode: 2 } }])
    expect(stack.depth()).toBe(2)
    expect(stack.undo()!.inverse).toEqual([{ kind: 'node', op: 'patch', id: '5', fields: { mode: 0 } }])
    expect(stack.redo()!.forward).toEqual([{ kind: 'node', op: 'patch', id: '5', fields: { mode: 2 } }])
    stack.undo()
    stack.record(prev, [{ kind: 'node', op: 'patch', id: '5', fields: { title: 'y' } }])
    expect(stack.redo()).toBeNull()
  })

  it('coalesces a 30fps drag into one entry keeping the drag-start inverse', () => {
    let t = 0
    const stack = createUndoStack(() => t)
    const state = doc()
    for (let i = 1; i <= 10; i++) {
      const ops: EditOp[] = [{ kind: 'node', op: 'patch', id: '5', fields: { pos: [10 + i, 20] } }]
      stack.record(state, ops)
      applyOpsToRecords(state, ops)
      t += 33
    }
    expect(stack.depth()).toBe(1)
    const entry = stack.undo()!
    expect(entry.inverse).toEqual([{ kind: 'node', op: 'patch', id: '5', fields: { pos: [10, 20] } }])
    // redo goes straight to the drag end (absolute positions)
    expect(stack.redo()!.forward).toEqual([{ kind: 'node', op: 'patch', id: '5', fields: { pos: [20, 20] } }])
  })

  it('does not coalesce non-positional patches', () => {
    let t = 0
    const stack = createUndoStack(() => t)
    const prev = doc()
    stack.record(prev, [{ kind: 'node', op: 'patch', id: '5', fields: { pos: [11, 20] } }])
    t += 33
    stack.record(prev, [{ kind: 'node', op: 'patch', id: '5', fields: { widgets: { seed: 3 } } }])
    expect(stack.depth()).toBe(2)
  })
})
