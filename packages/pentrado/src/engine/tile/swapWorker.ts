

/* eslint-disable @typescript-eslint/no-explicit-any */

const SLOT_BYTES = 256 * 256 * 4

interface SyncHandle {
  read(buffer: Uint8Array, opts: { at: number }): number
  write(buffer: Uint8Array, opts: { at: number }): number
  truncate(size: number): void
  flush(): void
  close(): void
}

let handle: SyncHandle | null = null
let fileName = ''
const freeSlots: number[] = []
let topSlot = 0

async function cleanupOrphans(dir: any, keep: string): Promise<void> {
  try {
    const names: string[] = []
    for await (const name of dir.keys()) {
      if (typeof name === 'string' && name.startsWith('pentrado-swap-') && name !== keep) names.push(name)
    }
    for (const name of names) {
      try {
        const fh = await dir.getFileHandle(name)

        const h = await fh.createSyncAccessHandle()
        h.close()
        await dir.removeEntry(name)
      } catch {

      }
    }
  } catch {

  }
}

async function init(): Promise<boolean> {
  try {
    const storage = (self.navigator as any)?.storage
    if (!storage?.getDirectory) return false
    const dir = await storage.getDirectory()
    fileName = `pentrado-swap-${Math.random().toString(36).slice(2)}.bin`
    const fh = await dir.getFileHandle(fileName, { create: true })
    handle = (await fh.createSyncAccessHandle()) as SyncHandle
    handle.truncate(0)
    void cleanupOrphans(dir, fileName)
    return true
  } catch {
    return false
  }
}

async function dispose(): Promise<void> {
  try {
    handle?.close()
    handle = null
    const dir = await (self.navigator as any).storage.getDirectory()
    await dir.removeEntry(fileName)
  } catch {
    /* ignore */
  }
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data
  if (msg.op === 'init') {
    const ok = await init()
    ;(self as any).postMessage({ reqId: msg.reqId, ok })
    return
  }
  if (msg.op === 'dispose') {
    await dispose()
    ;(self as any).postMessage({ reqId: msg.reqId, ok: true })
    return
  }
  if (!handle) {
    ;(self as any).postMessage({ reqId: msg.reqId, error: 'no handle' })
    return
  }
  try {
    if (msg.op === 'write') {
      const bytes = new Uint8Array(msg.bytes as ArrayBuffer)
      if (bytes.byteLength !== SLOT_BYTES) throw new Error(`bad slot size ${bytes.byteLength}`)
      const slot = freeSlots.pop() ?? topSlot++
      handle.write(bytes, { at: slot * SLOT_BYTES })
      ;(self as any).postMessage({ reqId: msg.reqId, slot })
    } else if (msg.op === 'read') {
      const out = new Uint8Array(SLOT_BYTES)
      handle.read(out, { at: (msg.slot as number) * SLOT_BYTES })
      ;(self as any).postMessage({ reqId: msg.reqId, bytes: out.buffer }, [out.buffer] as any)
    } else if (msg.op === 'free') {
      freeSlots.push(msg.slot as number)
    }
  } catch (err) {
    ;(self as any).postMessage({ reqId: msg.reqId, error: String(err) })
  }
}
