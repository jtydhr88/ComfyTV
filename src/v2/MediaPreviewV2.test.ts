import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { app } from '@/lib/comfyApp'

import MediaPreviewV2 from './MediaPreviewV2.vue'

describe('MediaPreviewV2', () => {
  it('plays video previews with sound', () => {
    ;(app as any).api.apiURL = (p: string) => p
    const wrapper = mount(MediaPreviewV2, {
      props: { kind: 'video', url: '/view?filename=clip.mp4&type=output', hint: '' },
      global: { stubs: { ProxiedVideo: { template: '<video v-bind="$attrs" />' } } },
    })
    const video = wrapper.find('video').element as HTMLVideoElement
    expect(video.controls).toBe(true)
    expect(video.muted).toBe(false)
  })
})
