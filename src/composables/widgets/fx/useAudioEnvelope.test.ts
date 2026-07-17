import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { decodeEnvelope, useAudioEnvelope } from './useAudioEnvelope'

const closeSpy = vi.fn(() => Promise.resolve())

function stubAudio(opts: {
  samples?: Float32Array
  sampleRate?: number
  decodeError?: boolean
  fetchError?: boolean
} = {}) {
  const samples = opts.samples ?? new Float32Array(30).fill(0.5)
  const sampleRate = opts.sampleRate ?? 1000

  const fetchMock = vi.fn((url: string) => {
    if (opts.fetchError) return Promise.reject(new Error('network'))
    return Promise.resolve({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      url,
    } as unknown as Response)
  })
  vi.stubGlobal('fetch', fetchMock)

  class FakeAudioContext {
    decodeAudioData(_buf: ArrayBuffer) {
      if (opts.decodeError) return Promise.reject(new Error('bad data'))
      return Promise.resolve({
        sampleRate,
        getChannelData: () => samples,
      } as unknown as AudioBuffer)
    }
    close = closeSpy
  }
  vi.stubGlobal('AudioContext', FakeAudioContext)

  return { fetchMock }
}

afterEach(() => {
  vi.unstubAllGlobals()
  closeSpy.mockClear()
})

describe('decodeEnvelope', () => {
  it('decodes audio into a dB RMS envelope with 10ms blocks', async () => {
    stubAudio({ samples: new Float32Array(30).fill(0.5), sampleRate: 1000 })
    const env = await decodeEnvelope('/audio.wav')
    expect(env).not.toBeNull()
    expect(env!.length).toBe(3)
    for (const db of env!) {
      expect(db).toBeCloseTo(20 * Math.log10(0.5), 4)
    }
  })

  it('floors silence at -90 dB', async () => {
    stubAudio({ samples: new Float32Array(20), sampleRate: 1000 })
    const env = await decodeEnvelope('/silence.wav')
    expect(Array.from(env!)).toEqual([-90, -90])
  })

  it('closes the AudioContext after decoding', async () => {
    stubAudio()
    await decodeEnvelope('/audio.wav')
    expect(closeSpy).toHaveBeenCalledTimes(1)
  })

  it('returns null when the fetch fails', async () => {
    stubAudio({ fetchError: true })
    expect(await decodeEnvelope('/missing.wav')).toBeNull()
  })

  it('returns null when decoding fails, still closing the context', async () => {
    stubAudio({ decodeError: true })
    expect(await decodeEnvelope('/corrupt.wav')).toBeNull()
    expect(closeSpy).toHaveBeenCalledTimes(1)
  })
})

describe('useAudioEnvelope', () => {
  it('returns null without fetching when either url is missing', async () => {
    const { fetchMock } = stubAudio()
    const inputUrl = ref<string | null>(null)
    const outputUrl = ref<string | null>('/out.wav')
    const { hasHistory, reload } = useAudioEnvelope({ inputUrl, outputUrl })
    expect(await reload()).toBeNull()
    expect(hasHistory.value).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('loads both envelopes and flips hasHistory', async () => {
    const { fetchMock } = stubAudio()
    const { hasHistory, reload } = useAudioEnvelope({
      inputUrl: ref('/in.wav'),
      outputUrl: ref('/out.wav'),
    })
    const pair = await reload()
    expect(pair).not.toBeNull()
    expect(pair!.input.length).toBe(3)
    expect(pair!.output.length).toBe(3)
    expect(hasHistory.value).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledWith('/in.wav')
    expect(fetchMock).toHaveBeenCalledWith('/out.wav')
  })

  it('clears hasHistory at the start of every reload', async () => {
    stubAudio()
    const inputUrl = ref<string | null>('/in.wav')
    const { hasHistory, reload } = useAudioEnvelope({
      inputUrl,
      outputUrl: ref('/out.wav'),
    })
    await reload()
    expect(hasHistory.value).toBe(true)
    inputUrl.value = null
    expect(await reload()).toBeNull()
    expect(hasHistory.value).toBe(false)
  })

  it('returns null when a decode fails', async () => {
    stubAudio({ decodeError: true })
    const { hasHistory, reload } = useAudioEnvelope({
      inputUrl: ref('/in.wav'),
      outputUrl: ref('/out.wav'),
    })
    expect(await reload()).toBeNull()
    expect(hasHistory.value).toBe(false)
  })
})
