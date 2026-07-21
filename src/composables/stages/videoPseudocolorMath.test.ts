import { describe, it, expect } from 'vitest'
import fixtures from './videoPseudocolorMath.fixtures.json'
import luts from './pseudocolorLuts.json'
import {
  applyPseudocolor,
  pseudocolorIndex,
  type Rgb8,
} from './videoPseudocolorMath'

const INPUT = fixtures.input as Rgb8[]
const LUTS = luts as Record<string, number[][]>

function candidates(rgb: Rgb8, lut: number[][], opacity: number): Rgb8[] {
  const idx = pseudocolorIndex(rgb)
  const out: Rgb8[] = []
  for (const i of [idx - 1, idx, idx + 1]) {
    if (i < 0 || i > 255) continue
    const pal = lut[i]
    out.push([0, 1, 2].map((ch) =>
      Math.max(0, Math.min(255,
        Math.round(rgb[ch] + (pal[ch] - rgb[ch]) * opacity)))) as Rgb8)
  }
  return out
}

describe('applyPseudocolor matches avfilter pseudocolor', () => {
  fixtures.cases.forEach((c) => {
    it(`${c.preset} opacity=${c.opacity}`, () => {
      const lut = LUTS[c.preset]
      expect(lut).toBeDefined()
      let sum = 0
      let misses = 0
      for (let i = 0; i < INPUT.length; i++) {
        const want = (c.expected as Rgb8[])[i]
        const got = applyPseudocolor(INPUT[i], lut, c.opacity)
        sum += Math.abs(got[0] - want[0]) + Math.abs(got[1] - want[1])
          + Math.abs(got[2] - want[2])
        const tol = 2 + (1 - c.opacity) * 5
        const ok = candidates(INPUT[i], lut, c.opacity).some((cand) =>
          cand.every((v, ch) => Math.abs(v - want[ch]) <= tol))
        if (!ok) misses++
      }
      expect(sum / (INPUT.length * 3)).toBeLessThan(2)
      expect(misses / INPUT.length).toBeLessThan(0.01)
    })
  })
})
