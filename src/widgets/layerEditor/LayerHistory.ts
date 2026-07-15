
export interface LayerHistorySnapshot {
  json: string
  selectedId: string | null
}

interface HistoryEntry extends LayerHistorySnapshot {
  mergeKey?: string
  time: number
}

export interface LayerHistoryOptions {
  limit?: number
  mergeWindowMs?: number
  now?: () => number
}

export class LayerHistory {
  private undos: HistoryEntry[] = []
  private redos: HistoryEntry[] = []
  private readonly limit: number
  private readonly mergeWindowMs: number
  private readonly now: () => number

  constructor(options: LayerHistoryOptions = {}) {
    this.limit = options.limit ?? 50
    this.mergeWindowMs = options.mergeWindowMs ?? 500
    this.now = options.now ?? (() => Date.now())
  }

  record(before: LayerHistorySnapshot, mergeKey?: string): void {
    const time = this.now()
    const last = this.undos[this.undos.length - 1]
    if (
      last !== undefined &&
      mergeKey !== undefined &&
      last.mergeKey === mergeKey &&
      time - last.time < this.mergeWindowMs
    ) {
      last.time = time
    } else {
      this.undos.push({ json: before.json, selectedId: before.selectedId, mergeKey, time })
      if (this.undos.length > this.limit) this.undos.shift()
    }
    this.redos = []
  }

  undo(current: LayerHistorySnapshot): LayerHistorySnapshot | null {
    const entry = this.undos.pop()
    if (!entry) return null
    this.redos.push({ json: current.json, selectedId: current.selectedId, time: this.now() })
    return { json: entry.json, selectedId: entry.selectedId }
  }

  redo(current: LayerHistorySnapshot): LayerHistorySnapshot | null {
    const entry = this.redos.pop()
    if (!entry) return null
    this.undos.push({ json: current.json, selectedId: current.selectedId, time: this.now() })
    return { json: entry.json, selectedId: entry.selectedId }
  }

  canUndo(): boolean {
    return this.undos.length > 0
  }

  canRedo(): boolean {
    return this.redos.length > 0
  }
  allJson(): string[] {
    const out: string[] = []
    for (const e of this.undos) out.push(e.json)
    for (const e of this.redos) out.push(e.json)
    return out
  }
  dropOldest(count: number): number {
    const n = Math.min(count, this.undos.length)
    if (n > 0) this.undos.splice(0, n)
    return n
  }

  clear(): void {
    this.undos = []
    this.redos = []
  }
}
