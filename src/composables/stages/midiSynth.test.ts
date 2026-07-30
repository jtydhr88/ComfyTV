import { describe, it, expect, vi } from 'vitest'
import { makeNoiseBuffer, playDrum, playTone } from './midiSynth'

function mockNode() {
  return {
    frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    type: '' as string,
    buffer: null as unknown,
    connect: vi.fn(function (this: unknown, d: unknown) { return d }),
    start: vi.fn(),
    stop: vi.fn(),
  }
}

function mockCtx() {
  const created: Record<string, any[]> = { osc: [], gain: [], src: [], filter: [] }
  return {
    ctx: {
      sampleRate: 8,
      createBuffer: (_c: number, len: number) => ({
        _data: new Float32Array(len),
        getChannelData(this: { _data: Float32Array }) { return this._data },
      }),
      createOscillator: () => { const n = mockNode(); created.osc.push(n); return n },
      createGain: () => { const n = mockNode(); created.gain.push(n); return n },
      createBufferSource: () => { const n = mockNode(); created.src.push(n); return n },
      createBiquadFilter: () => { const n = { ...mockNode(), frequency: { value: 0 } }; created.filter.push(n); return n },
    } as unknown as AudioContext,
    created,
  }
}

describe('makeNoiseBuffer', () => {
  it('fills a 1-second buffer with values in [-1, 1)', () => {
    const { ctx } = mockCtx()
    const buf = makeNoiseBuffer(ctx) as unknown as { _data: Float32Array }
    expect(buf._data).toHaveLength(8)
    for (const v of buf._data) expect(v).toBeGreaterThanOrEqual(-1)
  })
})

describe('playDrum', () => {
  it('kick (36) synthesises a pitched oscillator, no noise source', () => {
    const { ctx, created } = mockCtx()
    playDrum(ctx, {} as AudioNode, 36, 1, 1, {} as AudioBuffer)
    expect(created.osc).toHaveLength(1)
    expect(created.src).toHaveLength(0)
    expect(created.osc[0].start).toHaveBeenCalledWith(1)
    expect(created.osc[0].stop).toHaveBeenCalledWith(1.16)
  })

  it('snare (38) uses a filtered noise source at 1200 Hz highpass', () => {
    const { ctx, created } = mockCtx()
    const noise = {} as AudioBuffer
    playDrum(ctx, {} as AudioNode, 38, 0, 1, noise)
    expect(created.src).toHaveLength(1)
    expect(created.src[0].buffer).toBe(noise)
    expect(created.filter[0].type).toBe('highpass')
    expect(created.filter[0].frequency.value).toBe(1200)
  })

  it('closed hat (42) uses a short 4000 Hz noise burst', () => {
    const { ctx, created } = mockCtx()
    playDrum(ctx, {} as AudioNode, 42, 0, 1, {} as AudioBuffer)
    expect(created.filter[0].frequency.value).toBe(4000)
    expect(created.src[0].stop).toHaveBeenCalledWith(0.05 + 0.02)
  })
})

describe('playTone', () => {
  it('plays an oscillator at the equal-tempered frequency for the midi note', () => {
    const { ctx, created } = mockCtx()
    playTone(ctx, {} as AudioNode, 69, 0, 1, 0.1, 'square')
    expect(created.osc[0].type).toBe('square')
    expect(created.osc[0].frequency.value).toBeCloseTo(440, 5)
    expect(created.osc[0].start).toHaveBeenCalledWith(0)
    expect(created.osc[0].stop).toHaveBeenCalledWith(1.02)
  })
})
