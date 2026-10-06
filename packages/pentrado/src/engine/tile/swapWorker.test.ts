import { afterEach, describe, expect, it, vi } from 'vitest'

class DedicatedWorkerGlobalScope {}

async function loadScope(scope: object) {
  vi.resetModules()
  vi.stubGlobal('DedicatedWorkerGlobalScope', DedicatedWorkerGlobalScope)
  vi.stubGlobal('self', scope)
  await import('./swapWorker')
}

async function loadWorker(storage?: object) {
  const scope = Object.assign(new DedicatedWorkerGlobalScope(), {
    navigator: { storage },
    postMessage: vi.fn(),
    onmessage: undefined as undefined | ((e: { data: unknown }) => Promise<void>)
  })
  await loadScope(scope)
  return { scope, send: (data: unknown) => scope.onmessage!({ data }) }
}

describe('swap worker isolation and protocol', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not replace a page message handler or post messages outside a worker', async () => {
    const onmessage = vi.fn()
    const page = { onmessage, postMessage: vi.fn() }
    await loadScope(page)
    expect(page.onmessage).toBe(onmessage)
    expect(page.postMessage).not.toHaveBeenCalled()
  })

  it('ignores unrelated messages and its own no-handle reply', async () => {
    const { scope, send } = await loadWorker()
    for (const data of [null, undefined, 'message', {}, { type: 'loaded' }, { reqId: 1, error: 'no handle' }]) {
      await send(data)
    }
    expect(scope.postMessage).not.toHaveBeenCalled()
    await send({ op: 'read', slot: 0, reqId: 1 })
    expect(scope.postMessage).toHaveBeenCalledExactlyOnceWith({ reqId: 1, error: 'no handle' })
    await send(scope.postMessage.mock.calls[0][0])
    expect(scope.postMessage).toHaveBeenCalledTimes(1)
  })

  it('reports unavailable OPFS once without a message loop', async () => {
    const { scope, send } = await loadWorker()
    await send({ op: 'init', reqId: 1 })
    expect(scope.postMessage).toHaveBeenCalledExactlyOnceWith({ reqId: 1, ok: false })
    await send(scope.postMessage.mock.calls[0][0])
    expect(scope.postMessage).toHaveBeenCalledTimes(1)
  })

  it('initializes, round-trips a tile, reuses a freed slot, and disposes', async () => {
    const slots = new Map<number, Uint8Array>()
    const handle = {
      truncate: vi.fn(), close: vi.fn(),
      write: (bytes: Uint8Array, { at }: { at: number }) => { slots.set(at, bytes.slice()); return bytes.length },
      read: (bytes: Uint8Array, { at }: { at: number }) => { bytes.set(slots.get(at)!); return bytes.length }
    }
    const directory = {
      getFileHandle: vi.fn(async () => ({ createSyncAccessHandle: async () => handle })),
      keys: async function* () {},
      removeEntry: vi.fn(async () => {})
    }
    const { scope, send } = await loadWorker({ getDirectory: async () => directory })
    await send({ op: 'init', reqId: 1 })
    expect(scope.postMessage).toHaveBeenLastCalledWith({ reqId: 1, ok: true })
    const tile = new Uint8Array(256 * 256 * 4).fill(137)
    await send({ op: 'write', reqId: 2, bytes: tile.buffer })
    expect(scope.postMessage).toHaveBeenLastCalledWith({ reqId: 2, slot: 0 })
    await send({ op: 'read', reqId: 3, slot: 0 })
    const [reply, transfer] = scope.postMessage.mock.calls.at(-1)!
    expect(reply.reqId).toBe(3)
    expect(Array.from(new Uint8Array(reply.bytes))).toEqual(Array.from(tile))
    expect(transfer).toEqual([reply.bytes])
    await send({ op: 'free', slot: 0 })
    await send({ op: 'write', reqId: 4, bytes: tile.buffer })
    expect(scope.postMessage).toHaveBeenLastCalledWith({ reqId: 4, slot: 0 })
    await send({ op: 'dispose', reqId: 5 })
    expect(handle.close).toHaveBeenCalledOnce()
    expect(directory.removeEntry).toHaveBeenCalledOnce()
    expect(scope.postMessage).toHaveBeenLastCalledWith({ reqId: 5, ok: true })
  })
})
