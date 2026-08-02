

export interface SwapClient {
  write(bytes: Uint8Array): Promise<number>
  read(slot: number): Promise<Uint8Array>
  free(slot: number): void
  dispose(): void
}

export function createSwapClient(): SwapClient | null {
  if (typeof Worker === 'undefined' || typeof navigator === 'undefined') return null
  if (!('storage' in navigator) || typeof navigator.storage?.getDirectory !== 'function') return null
  let worker: Worker
  try {
    worker = new Worker(new URL('./swapWorker.ts', import.meta.url), { type: 'module' })
  } catch {
    return null
  }

  let nextReq = 1
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
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

  function call(msg: Record<string, unknown>, transfer?: Transferable[]): Promise<unknown> {
    const reqId = nextReq++
    return new Promise((resolve, reject) => {
      pending.set(reqId, { resolve, reject })
      worker.postMessage({ ...msg, reqId }, transfer ?? [])
    })
  }

  const ready = call({ op: 'init' }).then((r) => {
    if (!(r as { ok: boolean }).ok) throw new Error('OPFS unavailable')
  })

  ready.catch(() => {})

  return {
    async write(bytes: Uint8Array): Promise<number> {
      await ready
      const copy = bytes.slice()
      const r = (await call({ op: 'write', bytes: copy.buffer }, [copy.buffer])) as { slot: number }
      return r.slot
    },
    async read(slot: number): Promise<Uint8Array> {
      await ready
      const r = (await call({ op: 'read', slot })) as { bytes: ArrayBuffer }
      return new Uint8Array(r.bytes)
    },
    free(slot: number): void {
      void ready.then(() => worker.postMessage({ op: 'free', slot }))
    },
    dispose(): void {
      void call({ op: 'dispose' }).finally(() => worker.terminate())
    },
  }
}
