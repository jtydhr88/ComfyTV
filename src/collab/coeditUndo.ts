import type { DocRecords, EditOp, NodeRec } from '@/collab/coedit'
import { parseLinkKey } from '@/collab/coedit'

const MAX_UNDO = 50
const DRAG_COALESCE_MS = 1000

export function invertOps(prev: DocRecords, ops: EditOp[]): EditOp[] {
  const inverse: EditOp[] = []
  for (const op of ops) {
    if (op.kind === 'node') {
      const old = prev.nodes[op.id]
      if (op.op === 'patch') {
        if (!old) continue
        const fields: Partial<NodeRec> = {}
        for (const key of Object.keys(op.fields) as (keyof NodeRec)[]) {
          ;(fields as any)[key] = JSON.parse(JSON.stringify(old[key]))
        }
        inverse.push({ kind: 'node', op: 'patch', id: op.id, fields })
      } else if (op.op === 'put') {
        if (old) inverse.push({ kind: 'node', op: 'put', id: op.id, data: JSON.parse(JSON.stringify(old)) })
        else inverse.push({ kind: 'node', op: 'remove', id: op.id })
      } else if (old) {
        inverse.push({ kind: 'node', op: 'put', id: op.id, data: JSON.parse(JSON.stringify(old)) })
      }
    } else if (op.op === 'put') {
      inverse.push({ kind: 'link', op: 'remove', id: op.id })
    } else {
      const rec = prev.links[op.id] ?? parseLinkKey(op.id)
      if (rec) inverse.push({ kind: 'link', op: 'put', id: op.id, data: { ...rec } })
    }
  }
  // reverse order so composites (remove node + links) restore cleanly
  return inverse.reverse()
}

interface UndoEntry {
  keys: string
  posOnly: boolean
  at: number
  inverse: EditOp[]
  forward: EditOp[]
}

function entryMeta(ops: EditOp[]): { keys: string; posOnly: boolean } {
  const keys = ops.map((o) => `${o.kind}:${o.id}`).sort().join('|')
  const posOnly = ops.every((o) =>
    o.kind === 'node' && o.op === 'patch'
    && Object.keys(o.fields).every((f) => f === 'pos' || f === 'size'))
  return { keys, posOnly }
}

export interface UndoStack {
  record(prev: DocRecords, forward: EditOp[]): void
  undo(): { inverse: EditOp[] } | null
  redo(): { forward: EditOp[] } | null
  clear(): void
  depth(): number
}

export function createUndoStack(now: () => number = () => Date.now()): UndoStack {
  const undoStack: UndoEntry[] = []
  let redoStack: UndoEntry[] = []

  return {
    record(prev, forward) {
      const inverse = invertOps(prev, forward)
      if (!inverse.length) return
      redoStack = []
      const meta = entryMeta(forward)
      const top = undoStack[undoStack.length - 1]
      // coalesce a drag stream into one entry keeping the drag-start inverse
      if (top && meta.posOnly && top.posOnly && top.keys === meta.keys
          && now() - top.at < DRAG_COALESCE_MS) {
        top.at = now()
        top.forward = forward
        return
      }
      undoStack.push({ ...meta, at: now(), inverse, forward })
      if (undoStack.length > MAX_UNDO) undoStack.shift()
    },
    undo() {
      const entry = undoStack.pop()
      if (!entry) return null
      redoStack.push(entry)
      return { inverse: entry.inverse }
    },
    redo() {
      const entry = redoStack.pop()
      if (!entry) return null
      undoStack.push(entry)
      return { forward: entry.forward }
    },
    clear() {
      undoStack.length = 0
      redoStack = []
    },
    depth: () => undoStack.length,
  }
}
