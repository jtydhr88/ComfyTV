import { describe, expect, it } from 'vitest'

import { buildWarpGrid, sampleWarpMesh, sampleWarpSurface, warpMeshBounds } from './warpTool'

describe('warp grid math', () => {
  it('buildWarpGrid spans the bitmap with n×n points', () => {
    const pts = buildWarpGrid(4, 300, 150)
    expect(pts).toHaveLength(16)
    expect(pts[0]).toEqual({ x: 0, y: 0 })
    expect(pts[3]).toEqual({ x: 300, y: 0 })
    expect(pts[12]).toEqual({ x: 0, y: 150 })
    expect(pts[15]).toEqual({ x: 300, y: 150 })
  })

  it('an identity grid samples to the identity mapping', () => {
    const n = 4
    const pts = buildWarpGrid(n, 300, 150)
    for (const [u, v] of [[0, 0], [1.5, 0.75], [2.25, 1.5], [3, 3]] as const) {
      const p = sampleWarpSurface(pts, n, u, v)
      expect(p.x).toBeCloseTo((u / (n - 1)) * 300, 6)
      expect(p.y).toBeCloseTo((v / (n - 1)) * 150, 6)
    }
  })

  it('the surface passes through control points at integer params', () => {
    const n = 3
    const pts = buildWarpGrid(n, 100, 100)
    pts[4] = { x: 70, y: 30 }
    const p = sampleWarpSurface(pts, n, 1, 1)
    expect(p.x).toBeCloseTo(70, 6)
    expect(p.y).toBeCloseTo(30, 6)
  })

  it('moving one point only bends the surface locally around it', () => {
    const n = 4
    const pts = buildWarpGrid(n, 300, 300)
    pts[5] = { x: pts[5].x + 40, y: pts[5].y }
    const near = sampleWarpSurface(pts, n, 1, 1)
    const far = sampleWarpSurface(pts, n, 3, 3)
    expect(near.x).toBeCloseTo(140, 6)
    expect(far.x).toBeCloseTo(300, 6)
    expect(far.y).toBeCloseTo(300, 6)
  })

  it('sampleWarpMesh + warpMeshBounds cover the identity bitmap exactly', () => {
    const n = 3
    const { grid, side } = sampleWarpMesh(buildWarpGrid(n, 200, 100), n, 4)
    expect(side).toBe(9)
    expect(grid).toHaveLength(81)
    expect(warpMeshBounds(grid)).toEqual({ x: 0, y: 0, w: 200, h: 100 })
  })

  it('bounds expand when a corner is dragged outside', () => {
    const n = 3
    const pts = buildWarpGrid(n, 100, 100)
    pts[0] = { x: -50, y: -20 }
    const { grid } = sampleWarpMesh(pts, n, 4)
    const b = warpMeshBounds(grid)
    expect(b.x).toBeLessThanOrEqual(-50)
    expect(b.y).toBeLessThanOrEqual(-20)
    expect(b.x + b.w).toBeGreaterThanOrEqual(100)
  })
})
