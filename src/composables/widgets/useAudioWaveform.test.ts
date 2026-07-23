import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import {
  decodeSamples, drawWaveform, useAudioWaveform,
} from './useAudioWaveform'

const closeSpy = vi.fn(() => Promise.resolve())

function stubAudio(opts: {
  channels?: Float32Array[]
  decodeError?: boolean
  fetchError?: boolean
} = {}) {
  const channels = opts.channels ?? [new Float32Array(8).fill(0.5)]

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
        sampleRate: 1000,
        length: channels[0].length,
        numberOfChannels: channels.length,
        getChannelData: (c: number) => channels[c],
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

describe('decodeSamples', () => {
  it('returns a copy of a mono channel', async () => {
    const mono = new Float32Array([0.1, -0.2, 0.3])
    stubAudio({ channels: [mono] })
    const out = await decodeSamples('/a.wav')
    expect(Array.from(out!)).toEqual(Array.from(mono))
    expect(out).not.toBe(mono)
  })

  it('mixes stereo down to mono', async () => {
    stubAudio({
      channels: [
        new Float32Array([1.0, 0.0]),
        new Float32Array([0.0, 0.5]),
      ],
    })
    const out = await decodeSamples('/a.wav')
    expect(out![0]).toBeCloseTo(0.5)
    expect(out![1]).toBeCloseTo(0.25)
  })

  it('closes the AudioContext and survives decode errors', async () => {
    stubAudio({ decodeError: true })
    expect(await decodeSamples('/bad.wav')).toBeNull()
    expect(closeSpy).toHaveBeenCalledTimes(1)
  })

  it('returns null on fetch failure', async () => {
    stubAudio({ fetchError: true })
    expect(await decodeSamples('/missing.wav')).toBeNull()
  })
})

describe('drawWaveform', () => {
  it('fills one column per peak pair around the midline', () => {
    const calls: number[][] = []
    const ctx = {
      clearRect: vi.fn(),
      fillRect: (...args: number[]) => calls.push(args),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D
    drawWaveform(ctx, new Float32Array([-1, 1, 0, 0.5]), 2, 100, '#fff')
    expect(calls.length).toBe(2)
    expect(calls[0]).toEqual([0, 0, 1, 100])
    expect(calls[1][1]).toBeCloseTo(25)
    expect(calls[1][3]).toBeCloseTo(25)
  })
})

function harness(url = '/a.wav', enabled = true) {
  const urlRef = ref<string | null>(url)
  const enabledRef = ref(enabled)
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  let api: ReturnType<typeof useAudioWaveform> | null = null
  const Comp = defineComponent({
    setup() {
      api = useAudioWaveform({
        url: urlRef, enabled: enabledRef, canvas: canvasRef,
      })
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  return { wrapper, api: api!, urlRef, enabledRef, canvasRef }
}

describe('useAudioWaveform', () => {
  it('does not fetch while disabled', async () => {
    const { fetchMock } = stubAudio()
    const { api } = harness('/a.wav', false)
    await api.reload()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(api.ready.value).toBe(false)
  })

  it('loads and flips ready when enabled', async () => {
    const { fetchMock } = stubAudio()
    const { api } = harness('/a.wav', true)
    await api.reload()
    expect(fetchMock).toHaveBeenCalledWith('/a.wav')
    expect(api.ready.value).toBe(true)
  })

  it('clears ready when the url goes away', async () => {
    stubAudio()
    const { api, urlRef } = harness('/a.wav', true)
    await api.reload()
    expect(api.ready.value).toBe(true)
    urlRef.value = null
    await api.reload()
    expect(api.ready.value).toBe(false)
  })

  it('stays not-ready on decode failure', async () => {
    stubAudio({ decodeError: true })
    const { api } = harness('/a.wav', true)
    await api.reload()
    expect(api.ready.value).toBe(false)
  })
})
