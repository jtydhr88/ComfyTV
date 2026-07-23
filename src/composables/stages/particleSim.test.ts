import { describe, it, expect } from 'vitest'
import fixtures from './particleSim.fixtures.json'
import { ParticleSimTs, permTable, type ParticleParams } from './particleSim'

describe('particle sim parity with backend', () => {
  it('perm table matches backend splitmix shuffle', () => {
    const perm = permTable(7)
    const expected = fixtures.perm7 as number[]
    for (let i = 0; i < 256; i++) {
      expect(perm[i]).toBe(expected[i])
    }
  })

  fixtures.cases.forEach((c) => {
    it(`case ${c.name}: positions match within 1e-4`, () => {
      const sim = new ParticleSimTs(c.params as ParticleParams,
        c.w, c.h, c.fps)
      const frames = Math.round(c.t * c.fps)
      for (let f = 0; f <= frames; f++) sim.advanceTo(f / c.fps)
      expect(sim.parts.length).toBe(c.count)
      expect(sim.nextId).toBe(c.next_id)
      const snap = sim.snapshot()
      const xs = c.x as number[]
      const ys = c.y as number[]
      const vxs = c.vx as number[]
      const hx1 = c.hx1 as number[]
      const hy3 = c.hy3 as number[]
      const kinds = c.kind as number[]
      const sizes = c.sizes as number[]
      const opac = c.opac as number[]
      let maxD = 0
      for (let i = 0; i < c.count; i++) {
        maxD = Math.max(maxD,
          Math.abs(snap[i].x - xs[i]),
          Math.abs(snap[i].y - ys[i]),
          Math.abs(snap[i].vx - vxs[i]),
          Math.abs(snap[i].hx[0] - hx1[i]),
          Math.abs(snap[i].hy[2] - hy3[i]))
        expect(Math.round(snap[i].kind)).toBe(kinds[i])
        expect(Math.abs(snap[i].size - sizes[i])).toBeLessThan(1e-4)
        expect(Math.abs(snap[i].opacity - opac[i])).toBeLessThan(1e-4)
      }
      expect(maxD).toBeLessThan(1e-4)
    })
  })
})
