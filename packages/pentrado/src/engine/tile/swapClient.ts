/** Main-thread client for the OPFS swap worker. Null when the platform can't swap. */

export interface SwapClient {
  write(bytes: Uint8Array): Promise<number>
  read(slot: number): Promise<Uint8Array>
  free(slot: number): void
  dispose(): void
}

/**
 * The worker is spawned LAZILY on first use, not at construction — most editor
 * instances never page (small docs stay on the plain-canvas path), so eager
 * per-editor workers were pure overhead. dispose() terminates immediately and
 * unconditionally, so an unresponsive worker (hung OPFS handle) can never leak.
 */
export function createSwapClient(): SwapClient | null {
  if (typeof Worker === 'undefined' || typeof navigator === 'undefined') return null
  if (!('storage' in navigator) || typeof navigator.storage?.getDirectory !== 'function') return null

  let worker: Worker | null = null
  let ready: Promise<void> | null = null
  let disposed = false
  let nextReq = 1
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

  function ensureWorker(): Worker | null {
    if (disposed) return null
    if (worker) return worker
    try {
      worker = new Worker(new URL('./swapWorker.ts', import.meta.url), { type: 'module' })
    } catch {
      return null
    }
    worker.onmessage = (e: MessageEvent) => {
      const { reqId, error } = e.data
      const p = pending.get(reqId)
      if (!p) return
      pending.delete(reqId)
      if (error) p.reject(new Error(error))
      else p.resolve(e.data)
    }
    worker.onerror = () => {
      for (const p of pending.values()) p.reject(new Error('swap worker error'))
      pending.clear()
    }
    ready = call({ op: 'init' }).then((r) => {
      if (!(r as { ok: boolean }).ok) throw new Error('OPFS unavailable')
    })
    ready.catch(() => {})
    return worker
  }

  function call(msg: Record<string, unknown>, transfer?: Transferable[]): Promise<unknown> {
    const w = worker
    if (!w) return Promise.reject(new Error('swap worker gone'))
    const reqId = nextReq++
    return new Promise((resolve, reject) => {
      pending.set(reqId, { resolve, reject })
      w.postMessage({ ...msg, reqId }, transfer ?? [])
    })
  }

  return {
    async write(bytes: Uint8Array): Promise<number> {
      if (!ensureWorker()) throw new Error('swap unavailable')
      await ready
      const copy = bytes.slice()
      const r = (await call({ op: 'write', bytes: copy.buffer }, [copy.buffer])) as { slot: number }
      return r.slot
    },
    async read(slot: number): Promise<Uint8Array> {
      if (!ensureWorker()) throw new Error('swap unavailable')
      await ready
      const r = (await call({ op: 'read', slot })) as { bytes: ArrayBuffer }
      return new Uint8Array(r.bytes)
    },
    free(slot: number): void {
      if (!worker) return
      void ready?.then(() => worker?.postMessage({ op: 'free', slot }))
    },
    dispose(): void {
      disposed = true
      for (const p of pending.values()) p.reject(new Error('swap disposed'))
      pending.clear()
      if (worker) {
        // Fire-and-forget the cleanup, then terminate NOW — never wait for a
        // reply, or an unresponsive worker (hung OPFS) leaks forever.
        try { worker.postMessage({ op: 'dispose', reqId: -1 }) } catch { /* ignore */ }
        worker.terminate()
        worker = null
      }
    },
  }
}
