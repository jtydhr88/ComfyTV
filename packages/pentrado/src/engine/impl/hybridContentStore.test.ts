import { describe, expect, it } from 'vitest'

import { HybridContentStore } from './hybridContentStore'
import { SetContentCommand, SetContentRegionCommand } from '../commands/setContent'
import type { SwapClient } from '../tile/swapClient'

function fakeSwap(): SwapClient & { slots: Map<number, Uint8Array> } {
  const slots = new Map<number, Uint8Array>()
  let next = 1
  return {
    slots,
    async write(bytes: Uint8Array): Promise<number> {
      const id = next++
      slots.set(id, bytes.slice())
      return id
    },
    async read(slot: number): Promise<Uint8Array> {
      const b = slots.get(slot)
      if (!b) throw new Error('missing slot')
      return b.slice()
    },
    free(slot: number): void {
      slots.delete(slot)
    },
    dispose(): void {},
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

function canvasStub(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function bigBlank(store: HybridContentStore, w = 4096, h = 4096): string {
  return store.register(canvasStub(w, h), { uniform: [0, 0, 0, 0] })
}

describe('HybridContentStore', () => {
  it('keeps small contents as plain canvases', () => {
    const store = new HybridContentStore()
    const c = canvasStub(512, 512)
    const id = store.register(c)
    expect(store.get(id)?.canvas).toBe(c)
    expect(store.get(id)?.isBlank).toBeUndefined()
    expect(store.stats().plain).toBe(1)
    expect(store.stats().tiled).toBe(0)
  })

  it('a large uniform registration becomes a tile grid costing no pixel memory', () => {
    const store = new HybridContentStore()
    const id = bigBlank(store)
    const entry = store.get(id)!
    expect(entry.width).toBe(4096)
    expect(entry.isBlank).toBe(true)
    expect(store.stats().tiled).toBe(1)
    expect(store.stats().tileBytes).toBe(0)
    expect(store.totalBytes()).toBe(0)
  })

  it('a solid fill registration is uniform but not blank', () => {
    const store = new HybridContentStore()
    const id = store.register(canvasStub(4096, 4096), { uniform: [10, 20, 30, 255] })
    expect(store.get(id)!.isBlank).toBe(false)
    expect(store.stats().tileBytes).toBe(0)
  })

  it('derive shares untouched tiles and only pays for edited ones', () => {
    const store = new HybridContentStore()
    const base = bigBlank(store)
    const pixels = new Uint8ClampedArray(64 * 64 * 4).fill(200)
    const next = store.derive(base, [{ x: 100, y: 100, w: 64, h: 64, pixels }])
    expect(next).toBeTruthy()
    expect(next).not.toBe(base)
    const entry = store.get(next!)!
    expect(entry.isBlank).toBe(false)

    expect(store.stats().tileBytes).toBe(256 * 256 * 4)
    expect(store.get(base)!.isBlank).toBe(true)
  })

  it('derive returns null for plain contents (caller falls back)', () => {
    const store = new HybridContentStore()
    const id = store.register(canvasStub(64, 64))
    expect(store.derive(id, [])).toBeNull()
  })

  it('SetContentRegionCommand round-trips through derive with correct ids per direction', () => {
    const store = new HybridContentStore()
    const base = bigBlank(store)
    const slot = { contentId: base, url: undefined as string | undefined }
    const before = new Uint8ClampedArray(16 * 16 * 4)
    const after = new Uint8ClampedArray(16 * 16 * 4).fill(255)
    const cmd = new SetContentRegionCommand('paint', slot, [{ rect: { x: 0, y: 0, w: 16, h: 16 }, before, after }], store)

    cmd.apply('redo')
    const redone = slot.contentId
    expect(redone).not.toBe(base)
    expect(store.get(redone)!.isBlank).toBe(false)

    cmd.apply('undo')
    expect(slot.contentId).not.toBe(redone)
    expect(store.get(slot.contentId)!.isBlank).toBe(true)
  })

  it('collectGarbage releases tiles and empties the uniform pool', () => {
    const store = new HybridContentStore()
    const base = bigBlank(store)
    const pixels = new Uint8ClampedArray(32 * 32 * 4).fill(7)
    const next = store.derive(base, [{ x: 0, y: 0, w: 32, h: 32, pixels }])!
    expect(store.stats().tileBytes).toBeGreaterThan(0)

    store.collectGarbage(new Set([next]))
    expect(store.has(base)).toBe(false)
    expect(store.stats().tileBytes).toBeGreaterThan(0)

    store.collectGarbage(new Set())
    expect(store.stats().tileBytes).toBe(0)
    expect(store.stats().poolSize).toBe(0)
    expect(store.totalBytes()).toBe(0)
  })

  it('markUploaded / dirtyIds work for tiled entries', () => {
    const store = new HybridContentStore()
    const id = bigBlank(store)
    expect(store.dirtyIds()).toContain(id)
    store.markUploaded(id, 'http://x/y.png')
    expect(store.dirtyIds()).not.toContain(id)
    expect(store.get(id)!.uploadedUrl).toBe('http://x/y.png')
  })

  it('trim swaps out cold unpinned tiles and restore brings them back', async () => {
    const store = new HybridContentStore()
    const swap = fakeSwap()
    let restored = 0
    store.configureSwap({ swap, onRestored: () => restored++, tileBudgetBytes: 0, schedule: (fn) => fn() })

    const base = bigBlank(store)
    const pixels = new Uint8ClampedArray(32 * 32 * 4).fill(9)
    const next = store.derive(base, [{ x: 0, y: 0, w: 32, h: 32, pixels }])!
    expect(store.stats().tileBytes).toBe(256 * 256 * 4)

    store.trim(new Set())
    store.trim(new Set())
    await tick()
    expect(store.stats().tileBytes).toBe(0)
    expect(swap.slots.size).toBe(1)

    void store.get(next)!.canvas
    await tick()
    expect(restored).toBe(1)
    expect(store.stats().tileBytes).toBe(256 * 256 * 4)
    expect(swap.slots.size).toBe(0)
  })

  it('the first trim never swaps freshly-touched tiles (ping-pong valve)', async () => {
    const store = new HybridContentStore()
    const swap = fakeSwap()
    store.configureSwap({ swap, tileBudgetBytes: 0, schedule: (fn) => fn() })
    const base = bigBlank(store)
    const pixels = new Uint8ClampedArray(32 * 32 * 4).fill(9)
    store.derive(base, [{ x: 0, y: 0, w: 32, h: 32, pixels }])!

    store.trim(new Set())
    await tick()
    expect(store.stats().tileBytes).toBe(256 * 256 * 4)
    expect(swap.slots.size).toBe(0)
  })

  it('tiles the renderer keeps touching stay resident across trims', async () => {
    const store = new HybridContentStore()
    const swap = fakeSwap()
    store.configureSwap({ swap, tileBudgetBytes: 0, schedule: (fn) => fn() })
    const base = bigBlank(store)
    const pixels = new Uint8ClampedArray(32 * 32 * 4).fill(9)
    const next = store.derive(base, [{ x: 0, y: 0, w: 32, h: 32, pixels }])!

    store.trim(new Set())
    store.tileGridOf(next)
    store.trim(new Set())
    await tick()
    expect(store.stats().tileBytes).toBe(256 * 256 * 4)

    store.trim(new Set())
    await tick()
    expect(store.stats().tileBytes).toBe(0)
    expect(swap.slots.size).toBe(1)
  })

  it('pinned contents are never swapped out', async () => {
    const store = new HybridContentStore()
    const swap = fakeSwap()
    store.configureSwap({ swap, tileBudgetBytes: 0, schedule: (fn) => fn() })
    const base = bigBlank(store)
    const pixels = new Uint8ClampedArray(32 * 32 * 4).fill(9)
    const next = store.derive(base, [{ x: 0, y: 0, w: 32, h: 32, pixels }])!

    store.trim(new Set([next]))
    store.trim(new Set([next]))
    await tick()
    expect(store.stats().tileBytes).toBe(256 * 256 * 4)
    expect(swap.slots.size).toBe(0)
  })

  it('garbage-collected swapped tiles free their slots', async () => {
    const store = new HybridContentStore()
    const swap = fakeSwap()
    store.configureSwap({ swap, tileBudgetBytes: 0, schedule: (fn) => fn() })
    const base = bigBlank(store)
    const pixels = new Uint8ClampedArray(32 * 32 * 4).fill(9)
    const next = store.derive(base, [{ x: 0, y: 0, w: 32, h: 32, pixels }])!
    store.trim(new Set())
    store.trim(new Set())
    await tick()
    expect(swap.slots.size).toBe(1)

    store.collectGarbage(new Set([base]))
    expect(store.has(next)).toBe(false)
    expect(swap.slots.size).toBe(0)
  })

  it('swap I/O is capped in flight and drains through a queue', async () => {
    const store = new HybridContentStore()
    const swap = fakeSwap()
    store.configureSwap({ swap, tileBudgetBytes: 0, schedule: (fn) => fn() })

    const w = 4096
    const h = 2048
    const base = store.register(canvasStub(w, h), { uniform: [0, 0, 0, 0] })
    const pixels = new Uint8ClampedArray(w * h * 4)
    for (let ty = 0; ty < h / 256; ty++) {
      for (let tx = 0; tx < w / 256; tx++) {
        const off = (ty * 256 * w + tx * 256) * 4
        pixels[off] = (tx + ty * 16) % 255 || 1
        pixels[off + 3] = 255
      }
    }
    const next = store.derive(base, [{ x: 0, y: 0, w, h, pixels }])!
    expect(store.stats().tileBytes).toBe(128 * 256 * 256 * 4)

    store.trim(new Set())
    store.trim(new Set())
    expect(store.stats().inflightWrites).toBe(64)
    expect(store.stats().queuedWrites).toBe(64)
    while (store.stats().inflightWrites + store.stats().queuedWrites > 0) await tick()
    expect(store.stats().tileBytes).toBe(0)
    expect(swap.slots.size).toBe(128)

    void store.get(next)!.canvas
    expect(store.stats().inflightReads).toBe(64)
    expect(store.stats().queuedReads).toBe(64)
    while (store.stats().inflightReads + store.stats().queuedReads > 0) await tick()
    expect(store.stats().tileBytes).toBe(128 * 256 * 256 * 4)
    expect(swap.slots.size).toBe(0)
  })

  it('a restore batch notifies the host once, not once per tile', async () => {
    const store = new HybridContentStore()
    const swap = fakeSwap()
    let restored = 0
    const flushes: Array<() => void> = []
    store.configureSwap({
      swap,
      onRestored: () => restored++,
      tileBudgetBytes: 0,
      schedule: (fn) => flushes.push(fn),
    })

    const base = bigBlank(store)
    const mk = (i: number) => {
      const p = new Uint8ClampedArray(32 * 32 * 4).fill(9)
      p[0] = i + 1
      return p
    }
    let id = base
    for (let i = 0; i < 3; i++) {
      id = store.derive(id, [{ x: i * 300, y: 0, w: 32, h: 32, pixels: mk(i) }])!
    }
    store.trim(new Set())
    store.trim(new Set())
    while (store.stats().inflightWrites + store.stats().queuedWrites > 0) await tick()
    expect(store.stats().swappedOut).toBe(3)

    void store.get(id)!.canvas
    while (store.stats().inflightReads + store.stats().queuedReads > 0) await tick()
    expect(restored).toBe(0)
    expect(flushes.length).toBe(1)
    flushes[0]()
    expect(restored).toBe(1)
    expect(store.stats().tileBytes).toBe(3 * 256 * 256 * 4)
  })

  it('SetContentCommand sizeBytes still works against tiled entries', () => {
    const store = new HybridContentStore()
    const a = bigBlank(store)
    const b = bigBlank(store)
    const slot = { contentId: a }
    const cmd = new SetContentCommand('swap', slot, a, b, store)
    expect(cmd.sizeBytes()).toBe(4096 * 4096 * 4 * 2)
    cmd.apply('redo')
    expect(slot.contentId).toBe(b)
  })
})
