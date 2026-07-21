import { describe, it, expect } from 'vitest'
import fixtures from './videoChromaShiftMath.fixtures.json'
import {
  applyChromaShiftImage,
  type ChromaShiftParams,
} from './videoChromaShiftMath'

const W = fixtures.width
const H = fixtures.height
const INPUT = (fixtures.input as number[][][]).flat()

function parseArgs(args: string): ChromaShiftParams {
  const kv = Object.fromEntries(
    args.split(':').map((s) => s.split('=') as [string, string]))
  return {
    shiftRh: Number(kv.crh ?? 0),
    shiftRv: Number(kv.crv ?? 0),
    shiftBh: Number(kv.cbh ?? 0),
    shiftBv: Number(kv.cbv ?? 0),
    shiftEdge: kv.edge === '1' ? 'wrap' : 'smear',
  }
}

describe('applyChromaShiftImage matches avfilter chromashift', () => {
  fixtures.cases.forEach((c) => {
    it(`${c.name} (${c.args})`, () => {
      const got = applyChromaShiftImage(INPUT, W, H, parseArgs(c.args))
      const want = c.expected as number[][][]
      let sum = 0
      let n = 0
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const g = got[y * W + x]
          const w = want[y][x]
          for (let ch = 0; ch < 3; ch++) {
            sum += Math.abs(g[ch] - w[ch])
            n++
          }
        }
      }
      expect(sum / n).toBeLessThan(3.5)
    })
  })

  it('zero shifts are identity', () => {
    const got = applyChromaShiftImage(INPUT, W, H, {
      shiftRh: 0, shiftRv: 0, shiftBh: 0, shiftBv: 0, shiftEdge: 'smear',
    })
    let maxD = 0
    for (let i = 0; i < INPUT.length; i++) {
      for (let ch = 0; ch < 3; ch++) {
        maxD = Math.max(maxD, Math.abs(got[i][ch] - INPUT[i][ch]))
      }
    }
    expect(maxD).toBeLessThanOrEqual(1)
  })
})
