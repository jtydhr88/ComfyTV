import { describe, expect, it } from 'vitest'
import {
  compressorTransferDb, envelopeDb, kneeWidthDb, resampleEnvelope,
  transferCurvePoints, waveformPeaks,
} from './audioViz'

describe('waveformPeaks', () => {
  it('emits min/max pairs per column', () => {
    const samples = new Float32Array([0.5, -0.5, 0.2, 0.1, -0.9, 0.9])
    const peaks = waveformPeaks(samples, 2)
    expect(Array.from(peaks.slice(0, 2))).toEqual([-0.5, 0.5])
    expect(peaks[2]).toBeCloseTo(-0.9)
    expect(peaks[3]).toBeCloseTo(0.9)
  })

  it('spreads few samples across many columns without gaps', () => {
    const peaks = waveformPeaks(new Float32Array([0.4, -0.4]), 4)
    expect(peaks.length).toBe(8)
    for (let x = 0; x < 4; x++) {
      expect(peaks[x * 2]).toBeLessThanOrEqual(peaks[x * 2 + 1])
    }
  })

  it('clamps out-of-range samples to [-1, 1]', () => {
    const peaks = waveformPeaks(new Float32Array([2.0, -3.0]), 1)
    expect(peaks[0]).toBe(-1)
    expect(peaks[1]).toBe(1)
  })

  it('returns zeros for empty input or zero columns', () => {
    expect(waveformPeaks(new Float32Array(0), 4).every((v) => v === 0))
      .toBe(true)
    expect(waveformPeaks(new Float32Array([0.5]), 0).length).toBe(0)
  })
})

describe('kneeWidthDb', () => {
  it('factor 1 gives hard knee', () => {
    expect(kneeWidthDb(1)).toBe(0)
  })
  it('factor 8 gives ~18dB width', () => {
    expect(kneeWidthDb(8)).toBeCloseTo(18.06, 1)
  })
})

describe('compressorTransferDb', () => {
  const p = { thresholdDb: -20, ratio: 4, kneeFactor: 1 }

  it('is identity below threshold', () => {
    expect(compressorTransferDb(-40, p)).toBeCloseTo(-40)
  })
  it('compresses above threshold at 1/ratio slope', () => {
    expect(compressorTransferDb(-10, p)).toBeCloseTo(-20 + 10 / 4)
    expect(compressorTransferDb(0, p)).toBeCloseTo(-20 + 20 / 4)
  })
  it('soft knee is continuous at both edges', () => {
    const soft = { thresholdDb: -20, ratio: 4, kneeFactor: 4 }
    const w = kneeWidthDb(4)
    const lo = -20 - w / 2
    const hi = -20 + w / 2
    expect(compressorTransferDb(lo, soft)).toBeCloseTo(lo, 4)
    expect(compressorTransferDb(hi, soft))
      .toBeCloseTo(hi + (1 / 4 - 1) * (hi - -20), 4)
  })
  it('knee output stays between identity and hard curve', () => {
    const soft = { thresholdDb: -20, ratio: 4, kneeFactor: 4 }
    const y = compressorTransferDb(-20, soft)
    expect(y).toBeLessThan(-20)
    expect(y).toBeGreaterThan(-20 + (1 / 4 - 1) * kneeWidthDb(4) / 2)
  })
  it('applies makeup', () => {
    expect(compressorTransferDb(-40, { ...p, makeupDb: 6 })).toBeCloseTo(-34)
  })
})

describe('transferCurvePoints', () => {
  it('spans the requested range monotonically in x', () => {
    const pts = transferCurvePoints({ thresholdDb: -20, ratio: 4, kneeFactor: 2 })
    expect(pts[0].x).toBe(-60)
    expect(pts[pts.length - 1].x).toBe(0)
    expect(pts.length).toBe(121)
  })
})

describe('envelopeDb', () => {
  it('measures a constant signal', () => {
    const x = new Float32Array(4410).fill(0.5)
    const env = envelopeDb(x, 44100, 10)
    expect(env.length).toBe(10)
    expect(env[0]).toBeCloseTo(20 * Math.log10(0.5), 1)
  })
  it('floors silence at -90', () => {
    const env = envelopeDb(new Float32Array(441), 44100, 10)
    expect(env[0]).toBe(-90)
  })
})

describe('resampleEnvelope', () => {
  it('max-pools to the target width', () => {
    const env = new Float32Array([-40, -10, -40, -40])
    const out = resampleEnvelope(env, 2)
    expect(out[0]).toBe(-10)
    expect(out[1]).toBe(-40)
  })
})
