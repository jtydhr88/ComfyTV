import { describe, it, expect } from 'vitest'
import fixtures from './videoSelectiveColorMath.fixtures.json'
import {
  applySelectiveColor,
  type Rgb8,
  type SelectiveColorParams,
} from './videoSelectiveColorMath'

const INPUT = fixtures.input as Rgb8[]

describe('applySelectiveColor matches avfilter selectivecolor', () => {
  fixtures.cases.forEach((c, ci) => {
    it(`case ${ci}: ${c.method} ${JSON.stringify(c.zones)}`, () => {
      const params: SelectiveColorParams = {
        scMethod: c.method,
        zones: c.zones as SelectiveColorParams['zones'],
      }
      let offByOne = 0
      for (let i = 0; i < INPUT.length; i++) {
        const got = applySelectiveColor(INPUT[i], params)
        const want = (c.expected as Rgb8[])[i]
        for (let ch = 0; ch < 3; ch++) {
          const d = Math.abs(got[ch] - want[ch])
          if (d === 1) offByOne++
          else if (d > 1) {
            throw new Error(
              `pixel ${i} [${INPUT[i]}] ch${ch}: got ${got[ch]} want ${want[ch]}`)
          }
        }
      }
      expect(offByOne / (INPUT.length * 3)).toBeLessThan(0.005)
    })
  })
})
