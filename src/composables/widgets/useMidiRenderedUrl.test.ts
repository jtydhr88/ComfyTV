import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'

const midiEnsure = vi.fn()
vi.mock('@/api', () => ({
  midiEnsure: (...a: unknown[]) => midiEnsure(...a),
}))

import {
  clearMidiRenderCache,
  isMidiUrl,
  useMidiRenderedUrl,
} from './useMidiRenderedUrl'

const MID = '/view?filename=song.mid&type=output&subfolder=midi'
const WAV = '/view?filename=mr_abc.wav&subfolder=comfytv%2Fmidi_render&type=output'

async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve()
}

describe('useMidiRenderedUrl', () => {
  let wrappers: VueWrapper[] = []

  beforeEach(() => {
    clearMidiRenderCache()
    midiEnsure.mockReset()
  })

  afterEach(() => {
    wrappers.forEach((w) => w.unmount())
    wrappers = []
  })

  function setup(initial: string | null) {
    const source = ref<string | null>(initial)
    let api!: ReturnType<typeof useMidiRenderedUrl>
    const wrapper = mount(defineComponent({
      setup() {
        api = useMidiRenderedUrl(source)
        return () => null
      },
    }))
    wrappers.push(wrapper)
    return { api, source, wrapper }
  }

  it('detects midi urls in path and filename query forms', () => {
    expect(isMidiUrl('/files/tune.mid')).toBe(true)
    expect(isMidiUrl('/files/tune.midi')).toBe(true)
    expect(isMidiUrl(MID)).toBe(true)
    expect(isMidiUrl('/view?filename=song.wav&type=output')).toBe(false)
    expect(isMidiUrl('/files/midifest.mp4')).toBe(false)
    expect(isMidiUrl(null)).toBe(false)
  })

  it('passes non-midi urls through untouched without calling ensure', async () => {
    const { api } = setup('/view?filename=a.wav&type=output')
    await flush()
    expect(api.url.value).toBe('/view?filename=a.wav&type=output')
    expect(midiEnsure).not.toHaveBeenCalled()
  })

  it('resolves midi to rendered wav and caches', async () => {
    midiEnsure.mockResolvedValue({ status: 'ready', url: WAV })
    const { api } = setup(MID)
    expect(api.url.value).toBeNull()
    expect(api.rendering.value).toBe(true)
    await flush()
    expect(api.url.value).toBe(WAV)
    expect(api.rendering.value).toBe(false)

    const second = setup(MID)
    await flush()
    expect(second.api.url.value).toBe(WAV)
    expect(midiEnsure).toHaveBeenCalledTimes(1)
  })

  it('falls back to the source url on ensure failure', async () => {
    midiEnsure.mockRejectedValue(new Error('boom'))
    const { api } = setup(MID)
    await flush()
    expect(api.url.value).toBe(MID)
    expect(api.rendering.value).toBe(false)
  })

  it('ignores a stale response after the source changed', async () => {
    let resolve1!: (v: unknown) => void
    midiEnsure.mockImplementationOnce(
      () => new Promise((r) => { resolve1 = r }),
    )
    const { api, source } = setup(MID)
    source.value = '/view?filename=b.wav&type=output'
    await flush()
    resolve1({ status: 'ready', url: WAV })
    await flush()
    expect(api.url.value).toBe('/view?filename=b.wav&type=output')
  })
})
