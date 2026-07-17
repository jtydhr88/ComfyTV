import { describe, expect, it } from 'vitest'
import {
  EQ_GMAX,
  EQ_H,
  EQ_W,
  bandDb,
  freqToX,
  gainToY,
  peakDb,
  xToFreq,
  yToGain,
  type EqBand,
} from './eqMath'

function peak(f: number, g: number, q = 1): EqBand {
  return { type: 'peak', f, g, q }
}

describe('frequency/gain axis transforms', () => {
  it('maps the audible band edges onto the canvas edges', () => {
    expect(freqToX(20)).toBeCloseTo(0)
    expect(freqToX(20000)).toBeCloseTo(EQ_W)
  })

  it('places decades logarithmically', () => {
    expect(freqToX(200)).toBeCloseTo(freqToX(2000) - freqToX(200), 1)
  })

  it('xToFreq inverts freqToX', () => {
    for (const f of [20, 100, 440, 1000, 12000, 20000]) {
      expect(xToFreq(freqToX(f))).toBeCloseTo(f, 6)
    }
  })

  it('maps 0 dB to the vertical center and +/-GMAX near the edges', () => {
    expect(gainToY(0)).toBe(EQ_H / 2)
    expect(gainToY(EQ_GMAX)).toBe(8)
    expect(gainToY(-EQ_GMAX)).toBe(EQ_H - 8)
  })

  it('yToGain inverts gainToY', () => {
    for (const g of [-24, -6, 0, 3, 12, 24]) {
      expect(yToGain(gainToY(g))).toBeCloseTo(g, 6)
    }
  })
})

describe('peakDb', () => {
  it('reaches the full gain at the center frequency', () => {
    expect(peakDb(peak(1000, 6), 1000)).toBeCloseTo(6, 3)
    expect(peakDb(peak(1000, -12), 1000)).toBeCloseTo(-12, 3)
  })

  it('decays toward 0 dB far from the center', () => {
    const b = peak(1000, 6)
    expect(Math.abs(peakDb(b, 20))).toBeLessThan(0.5)
    expect(Math.abs(peakDb(b, 20000))).toBeLessThan(0.5)
  })

  it('narrows with higher q', () => {
    const wide = peak(1000, 6, 0.5)
    const narrow = peak(1000, 6, 8)
    expect(peakDb(narrow, 500)).toBeLessThan(peakDb(wide, 500))
  })

  it('is flat at 0 gain', () => {
    expect(peakDb(peak(1000, 0), 500)).toBeCloseTo(0, 6)
  })
})

describe('bandDb', () => {
  it('highpass passes above cutoff and rolls off 12 dB/octave below', () => {
    const b: EqBand = { type: 'highpass', f: 1000, g: 0, q: 1 }
    expect(bandDb(b, 1000)).toBe(0)
    expect(bandDb(b, 5000)).toBe(0)
    expect(bandDb(b, 500)).toBeCloseTo(-12)
    expect(bandDb(b, 250)).toBeCloseTo(-24)
    expect(bandDb(b, 20)).toBe(-40)
  })

  it('lowpass mirrors highpass', () => {
    const b: EqBand = { type: 'lowpass', f: 1000, g: 0, q: 1 }
    expect(bandDb(b, 1000)).toBe(0)
    expect(bandDb(b, 100)).toBe(0)
    expect(bandDb(b, 2000)).toBeCloseTo(-12)
    expect(bandDb(b, 20000)).toBe(-40)
  })

  it('lowshelf approaches g below the corner and 0 above', () => {
    const b: EqBand = { type: 'lowshelf', f: 1000, g: 6, q: 1 }
    expect(bandDb(b, 20)).toBeCloseTo(6, 1)
    expect(bandDb(b, 1000)).toBeCloseTo(3)
    expect(bandDb(b, 20000)).toBeCloseTo(0, 1)
  })

  it('highshelf approaches g above the corner and 0 below', () => {
    const b: EqBand = { type: 'highshelf', f: 1000, g: -6, q: 1 }
    expect(bandDb(b, 20000)).toBeCloseTo(-6, 1)
    expect(bandDb(b, 1000)).toBeCloseTo(-3)
    expect(bandDb(b, 20)).toBeCloseTo(0, 1)
  })

  it('peak type delegates to peakDb', () => {
    const b = peak(1000, 6)
    expect(bandDb(b, 1000)).toBeCloseTo(peakDb(b, 1000))
  })
})
