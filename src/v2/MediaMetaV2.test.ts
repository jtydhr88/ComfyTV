import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeI18n } from '@/__tests__/renderHelpers'
import { resetMediaInfoCache } from '@/composables/stages/useMediaInfo'

const fetchMediaInfo = vi.fn()
vi.mock('@/api', () => ({ fetchMediaInfo: (url: string) => fetchMediaInfo(url) }))

import MediaMetaV2 from './MediaMetaV2.vue'

function mountMeta(props: Record<string, unknown>) {
  return mount(MediaMetaV2, { props, global: { plugins: [makeI18n()] } })
}

describe('MediaMetaV2', () => {
  beforeEach(() => {
    resetMediaInfoCache()
    fetchMediaInfo.mockReset()
  })
  afterEach(() => { document.body.innerHTML = '' })

  it('renders nothing without a url or generation time', () => {
    const w = mountMeta({ url: null })
    expect(w.find('.v2-meta').exists()).toBe(false)
  })

  it('shows format badge and probed facts for the url', async () => {
    fetchMediaInfo.mockResolvedValue({
      kind: 'video', format: 'MP4', size_bytes: 3 * 1024 ** 2,
      width: 1280, height: 720, fps: 24, duration_s: 4.2, has_audio: true, codec: 'h264',
    })
    const w = mountMeta({ url: '/view?filename=clip.mp4&type=output' })
    await flushPromises()
    expect(fetchMediaInfo).toHaveBeenCalledWith('/view?filename=clip.mp4&type=output')
    expect(w.find('.v2-meta__fmt').text()).toBe('MP4')
    const toks = w.findAll('.v2-meta__tok').map(x => x.text())
    expect(toks).toEqual(['1280×720', '24 fps', '4.2 s', '3.0 MB'])
    expect(w.find('.v2-meta').attributes('title')).toBe('clip.mp4 · H264')
    expect(w.find('.v2-meta__gen').exists()).toBe(false)
  })

  it('shows generation time on the right and survives a failed probe', async () => {
    fetchMediaInfo.mockRejectedValue(new Error('404'))
    const w = mountMeta({ url: '/view?filename=x.png', durationMs: 12_400 })
    await flushPromises()
    expect(w.find('.v2-meta__fmt').exists()).toBe(false)
    expect(w.find('.v2-meta__gen').text()).toBe('12.4s')
    expect(w.find('.v2-meta__gen').attributes('title')).toBe('Generated in 12.4s')
  })

  it('caches probes per url and refetches when the url changes', async () => {
    fetchMediaInfo.mockResolvedValue({ kind: 'image', format: 'PNG', size_bytes: 10, width: 4, height: 4 })
    const w = mountMeta({ url: '/view?filename=a.png' })
    await flushPromises()
    await w.setProps({ url: '/view?filename=b.png' })
    await flushPromises()
    await w.setProps({ url: '/view?filename=a.png' })
    await flushPromises()
    expect(fetchMediaInfo).toHaveBeenCalledTimes(2)
    expect(w.findAll('.v2-meta__tok').map(x => x.text())).toEqual(['4×4', '10 B'])
  })
})
