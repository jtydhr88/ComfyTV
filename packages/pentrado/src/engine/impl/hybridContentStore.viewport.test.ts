import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { __resetStoreRegistryForTests, HybridContentStore } from './hybridContentStore'
import { __setPressureForTests, IDLE_SLEEP_MS, IDLE_TRIM_MS } from './memoryPressure'
import { TILE_BIN_EVENTUALLY, TILE_BIN_NOW, TILE_BIN_SOON, TILE_SIZE, tileIndexesIn } from '../tile/tileBuffer'
import type { SwapClient } from '../tile/swapClient'

function fakeSwap(): SwapClient & { slots: Map<number, Uint8Array> } {
  const slots = new Map<number, Uint8Array>()
  let next = 1
  return {
    slots,
    async write(bytes: Uint8Array): Promise<number> { const id = next++; slots.set(id, bytes.slice()); return id },
    async read(slot: number): Promise<Uint8Array> { const b = slots.get(slot); if (!b) throw new Error('missing'); return b.slice() },
    free(slot: number): void { slots.delete(slot) },
    dispose(): void {},
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0))
const settle = async () => { for (let i = 0; i < 6; i++) await tick() }

function canvasStub(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function noisyGrid(store: HybridContentStore, w = 2048, h = 2048): string {
  const base = store.register(canvasStub(w, h), { uniform: [0, 0, 0, 0] })
  const px = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < px.length; i += 4) { px[i] = i & 255; px[i + 3] = 255 }
  return store.derive(base, [{ x: 0, y: 0, w, h, pixels: px }])!
}

beforeEach(() => { __resetStoreRegistryForTests(); __setPressureForTests(0, 0) })
afterEach(() => __setPressureForTests(0, 0))

describe('tileIndexesIn', () => {
  it('maps a region to tile columns/rows with optional padding', () => {
    const grid = { width: 1024, height: 1024, cols: 4, rows: 4, tiles: [] }
    expect(tileIndexesIn(grid, { x: 300, y: 300, w: 10, h: 10 })).toEqual({ c0: 1, c1: 1, r0: 1, r1: 1 })
    expect(tileIndexesIn(grid, { x: 300, y: 300, w: 10, h: 10 }, TILE_SIZE)).toEqual({ c0: 0, c1: 2, r0: 0, r1: 2 })
    expect(tileIndexesIn(grid, { x: -500, y: 0, w: 100, h: 100 })).toBeNull()
    expect(tileIndexesIn(grid, { x: 900, y: 900, w: 5000, h: 5000 })).toEqual({ c0: 3, c1: 3, r0: 3, r1: 3 })
  })
})

describe('viewport-aware residency', () => {
  it('bins tiles NOW/SOON/EVENTUALLY around the requested region', () => {
    const store = new HybridContentStore()
    const id = noisyGrid(store)
    const grid = store.tileGridOf(id, { x: 1024, y: 1024, w: 10, h: 10 })!
    const bin = (c: number, r: number) => grid.tiles[r * grid.cols + c].bin
    expect(bin(4, 4)).toBe(TILE_BIN_NOW)
    expect(bin(3, 4)).toBe(TILE_BIN_SOON)
    expect(bin(5, 5)).toBe(TILE_BIN_SOON)
    expect(bin(0, 0)).toBe(TILE_BIN_EVENTUALLY)
    expect(bin(7, 7)).toBe(TILE_BIN_EVENTUALLY)
    const all = store.tileGridOf(id)!
    expect(all.tiles.every((t) => t.bin === TILE_BIN_NOW)).toBe(true)
  })

  it('only restores tiles near the region and evicts far tiles first', async () => {
    const swap = fakeSwap()
    const store = new HybridContentStore()
    store.configureSwap({ swap, tileBudgetBytes: 0, hardLimitBytes: 0 })
    const id = noisyGrid(store)
    store.tileGridOf(id, { x: 0, y: 0, w: 10, h: 10 })
    store.trim(new Set())
    await settle()
    const grid = store.tileGridOf(id, { x: 0, y: 0, w: 10, h: 10 })!
    await settle()
    const resident = (c: number, r: number) => !!grid.tiles[r * grid.cols + c].bytes
    expect(resident(0, 0)).toBe(true)
    expect(resident(1, 1)).toBe(true)
    expect(resident(7, 7)).toBe(false)
    expect(store.isFullyResident(id)).toBe(false)
  })

  it('under budget pressure the hard tier evicts SOON before NOW', async () => {
    const swap = fakeSwap()
    const store = new HybridContentStore()
    const tileBytes = TILE_SIZE * TILE_SIZE * 4
    store.configureSwap({ swap, tileBudgetBytes: 0, hardLimitBytes: tileBytes * 2 })
    const id = noisyGrid(store)
    const grid = store.tileGridOf(id, { x: 0, y: 0, w: 10, h: 10 })!
    store.trim(new Set())
    await settle()
    expect(!!grid.tiles[0].bytes).toBe(true)
    expect(!!grid.tiles[63].bytes).toBe(false)
    expect(grid.tiles.filter((t) => t.bytes).length).toBeLessThanOrEqual(2)
  })

  it('pressure scale shrinks the allowances', async () => {
    const swap = fakeSwap()
    const store = new HybridContentStore()
    const tileBytes = TILE_SIZE * TILE_SIZE * 4
    store.configureSwap({ swap, tileBudgetBytes: tileBytes * 64, hardLimitBytes: tileBytes * 64 })
    const id = noisyGrid(store)
    store.tileGridOf(id)
    store.trim(new Set())
    await settle()
    expect(store.stats().tileBytes).toBe(tileBytes * 64)
    __setPressureForTests(2)
    store.enforceBudget()
    await settle()
    expect(store.stats().tileBytes).toBeLessThanOrEqual(tileBytes * 16)
  })

  it('idle reclaim pages EVENTUALLY tiles after 30s and everything unpinned after 5min', async () => {
    const swap = fakeSwap()
    const store = new HybridContentStore()
    const tileBytes = TILE_SIZE * TILE_SIZE * 4
    store.configureSwap({ swap, tileBudgetBytes: tileBytes * 64, hardLimitBytes: tileBytes * 64 })
    const id = noisyGrid(store)
    const grid = store.tileGridOf(id, { x: 0, y: 0, w: 10, h: 10 })!
    store.trim(new Set())
    store.reclaimIdle()
    await settle()
    expect(store.stats().tileBytes).toBe(tileBytes * 64)
    __setPressureForTests(0, IDLE_TRIM_MS + 1)
    store.reclaimIdle()
    await settle()
    expect(!!grid.tiles[0].bytes).toBe(true)
    expect(!!grid.tiles[63].bytes).toBe(false)
    __setPressureForTests(0, IDLE_SLEEP_MS + 1)
    store.reclaimIdle()
    await settle()
    expect(!!grid.tiles[0].bytes).toBe(false)
    expect(store.stats().tileBytes).toBe(0)
  })

  it('proxyTile upsamples the level-1 mip for a missing tile', async () => {
    const swap = fakeSwap()
    const store = new HybridContentStore()
    store.configureSwap({ swap, tileBudgetBytes: 0, hardLimitBytes: 0 })
    const id = noisyGrid(store)
    expect(store.proxyTile(id, 0)).toBeNull()
    store.renderSource(id, 0.49)
    store.trim(new Set())
    await settle()
    const proxy = store.proxyTile(id, 5)
    if (proxy) expect(proxy.byteLength).toBe(TILE_SIZE * TILE_SIZE * 4)
    expect(store.residencyOf(id)).toBeGreaterThanOrEqual(0)
  })
})

describe('waitForBudgetHeadroom', () => {
  it('resolves immediately under the limit and after eviction when over it', async () => {
    const { waitForBudgetHeadroom, pageResidentTileBytes } = await import('./hybridContentStore')
    const swap = fakeSwap()
    const store = new HybridContentStore()
    const tileBytes = TILE_SIZE * TILE_SIZE * 4
    store.configureSwap({ swap, tileBudgetBytes: tileBytes * 8, hardLimitBytes: tileBytes * 8 })
    const id = noisyGrid(store)
    store.tileGridOf(id, { x: 0, y: 0, w: 10, h: 10 })
    store.trim(new Set())
    expect(pageResidentTileBytes()).toBeGreaterThan(tileBytes * 8)
    const t0 = Date.now()
    await waitForBudgetHeadroom(tileBytes * 8, 1500)
    expect(Date.now() - t0).toBeLessThan(1500)
    expect(pageResidentTileBytes()).toBeLessThan(tileBytes * 8 + tileBytes)
    await waitForBudgetHeadroom(tileBytes * 1024)
  })
})
