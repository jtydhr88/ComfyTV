import { describe, expect, it } from 'vitest'

import {
  acquireUniform,
  deriveGrid,
  gatherPixels,
  gridDims,
  isBlankGrid,
  releaseGrid,
  residentTileBytes,
  TILE_SIZE,
  tileifyPixels,
  tilesInRect,
  uniformGrid,
  type UniformPool,
} from './tileBuffer'

function solid(w: number, h: number, rgba: [number, number, number, number]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < out.length; i += 4) {
    out[i] = rgba[0]
    out[i + 1] = rgba[1]
    out[i + 2] = rgba[2]
    out[i + 3] = rgba[3]
  }
  return out
}

function px(data: Uint8ClampedArray, w: number, x: number, y: number): [number, number, number, number] {
  const o = (y * w + x) * 4
  return [data[o], data[o + 1], data[o + 2], data[o + 3]]
}

describe('tileifyPixels / gatherPixels', () => {
  it('round-trips arbitrary pixels exactly, including non-tile-aligned edges', () => {
    const w = TILE_SIZE + 37
    const h = TILE_SIZE + 5
    const data = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < data.length; i++) data[i] = (i * 7919) & 0xff
    const pool: UniformPool = new Map()
    const grid = tileifyPixels(data, w, h, pool)
    expect(gridDims(w, h)).toEqual({ cols: 2, rows: 2 })
    expect(gatherPixels(grid)).toEqual(data)
  })

  it('collapses solid fills into pooled uniform tiles with no pixel buffers', () => {
    const w = TILE_SIZE * 2
    const h = TILE_SIZE * 2
    const pool: UniformPool = new Map()
    const grid = tileifyPixels(solid(w, h, [51, 102, 153, 255]), w, h, pool)
    expect(grid.tiles.every((t) => t.uniform != null && t.bytes == null)).toBe(true)
    expect(new Set(grid.tiles).size).toBe(1)
    expect(residentTileBytes([grid])).toBe(0)
    const out = gatherPixels(grid)
    expect(px(out, w, 0, 0)).toEqual([51, 102, 153, 255])
    expect(px(out, w, w - 1, h - 1)).toEqual([51, 102, 153, 255])
  })

  it('two identical fills share the same pooled tile across grids', () => {
    const pool: UniformPool = new Map()
    const a = uniformGrid(TILE_SIZE, TILE_SIZE, pool, 9, 9, 9, 255)
    const b = uniformGrid(TILE_SIZE, TILE_SIZE, pool, 9, 9, 9, 255)
    expect(a.tiles[0]).toBe(b.tiles[0])
    expect(a.tiles[0].refs).toBe(2)
  })

  it('blank grids are recognized and cost nothing', () => {
    const pool: UniformPool = new Map()
    const g = uniformGrid(1000, 700, pool)
    expect(isBlankGrid(g)).toBe(true)
    expect(residentTileBytes([g])).toBe(0)
    const out = gatherPixels(g)
    expect(out.every((v) => v === 0)).toBe(true)
  })
})

describe('deriveGrid (copy-on-write)', () => {
  it('shares untouched tiles and rebuilds only tiles under the edit', () => {
    const w = TILE_SIZE * 3
    const h = TILE_SIZE * 3
    const pool: UniformPool = new Map()
    const data = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < data.length; i++) data[i] = (i * 31) & 0xff
    const base = tileifyPixels(data, w, h, pool)

    const edit = { x: 10, y: 10, w: 40, h: 40, pixels: solid(40, 40, [255, 0, 0, 255]) }
    const next = deriveGrid(base, [edit], pool)

    let shared = 0
    for (let i = 0; i < base.tiles.length; i++) if (base.tiles[i] === next.tiles[i]) shared++
    expect(shared).toBe(8)
    expect(base.tiles[0]).not.toBe(next.tiles[0])

    const out = gatherPixels(next)
    expect(px(out, w, 10, 10)).toEqual([255, 0, 0, 255])
    expect(px(out, w, 49, 49)).toEqual([255, 0, 0, 255])
    expect(px(out, w, 50, 50)).toEqual(px(data, w, 50, 50))
    expect(px(out, w, TILE_SIZE + 5, 5)).toEqual(px(data, w, TILE_SIZE + 5, 5))

    expect(gatherPixels(base)).toEqual(data)
  })

  it('an edit spanning tile boundaries lands in every touched tile', () => {
    const w = TILE_SIZE * 2
    const pool: UniformPool = new Map()
    const base = uniformGrid(w, TILE_SIZE, pool)
    const ex = TILE_SIZE - 20
    const edit = { x: ex, y: 8, w: 40, h: 16, pixels: solid(40, 16, [0, 255, 0, 255]) }
    const next = deriveGrid(base, [edit], pool)
    expect(tilesInRect(base, ex, 8, 40, 16)).toEqual([0, 1])
    const out = gatherPixels(next)
    expect(px(out, w, ex, 8)).toEqual([0, 255, 0, 255])
    expect(px(out, w, ex + 39, 23)).toEqual([0, 255, 0, 255])
    expect(px(out, w, ex - 1, 8)).toEqual([0, 0, 0, 0])
    expect(px(out, w, ex + 40, 8)).toEqual([0, 0, 0, 0])
  })

  it('painting a whole tile back to one color re-collapses it to a uniform tile', () => {
    const pool: UniformPool = new Map()
    const base = uniformGrid(TILE_SIZE, TILE_SIZE, pool, 1, 2, 3, 255)
    const full = { x: 0, y: 0, w: TILE_SIZE, h: TILE_SIZE, pixels: solid(TILE_SIZE, TILE_SIZE, [7, 8, 9, 255]) }
    const next = deriveGrid(base, [full], pool)
    expect(next.tiles[0].uniform).toEqual(new Uint8Array([7, 8, 9, 255]))
    expect(residentTileBytes([base, next])).toBe(0)
  })

  it('uniform-seeded partial edits keep the base color outside the edit', () => {
    const pool: UniformPool = new Map()
    const base = uniformGrid(TILE_SIZE, TILE_SIZE, pool, 10, 20, 30, 255)
    const edit = { x: 4, y: 4, w: 8, h: 8, pixels: solid(8, 8, [200, 0, 0, 255]) }
    const out = gatherPixels(deriveGrid(base, [edit], pool))
    expect(px(out, TILE_SIZE, 4, 4)).toEqual([200, 0, 0, 255])
    expect(px(out, TILE_SIZE, 3, 3)).toEqual([10, 20, 30, 255])
    expect(px(out, TILE_SIZE, 100, 100)).toEqual([10, 20, 30, 255])
  })
})

describe('refcounts and release', () => {
  it('release drops shared tiles only when the last grid lets go', () => {
    const w = TILE_SIZE * 2
    const pool: UniformPool = new Map()
    const data = new Uint8ClampedArray(w * TILE_SIZE * 4)
    for (let i = 0; i < data.length; i++) data[i] = (i * 13) & 0xff
    const base = tileifyPixels(data, w, TILE_SIZE, pool)
    const next = deriveGrid(base, [{ x: 0, y: 0, w: 4, h: 4, pixels: solid(4, 4, [1, 1, 1, 255]) }], pool)

    expect(releaseGrid(base, pool)).toHaveLength(1)

    expect(next.tiles[1].refs).toBe(1)
    const dead = releaseGrid(next, pool)
    expect(dead).toHaveLength(2)
  })

  it('pooled uniform tiles leave the pool when fully released', () => {
    const pool: UniformPool = new Map()
    const g = uniformGrid(TILE_SIZE, TILE_SIZE, pool, 5, 5, 5, 128)
    expect(pool.size).toBe(1)
    releaseGrid(g, pool)
    expect(pool.size).toBe(0)
  })

  it('acquireUniform reuses the pooled instance', () => {
    const pool: UniformPool = new Map()
    const a = acquireUniform(pool, 1, 2, 3, 4)
    const b = acquireUniform(pool, 1, 2, 3, 4)
    expect(a).toBe(b)
    expect(a.refs).toBe(2)
  })
})
