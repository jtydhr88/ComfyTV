import { describe, it, expect } from 'vitest'
import type { ResolvedInput } from '@/stores/stageStore'
import { slotColor } from './imageSlotMentions'
import { videoClipsFromInputs } from './videoClipInputs'

function input(slot: string, source = 'upstream', content: string | null = '/v.mp4'): ResolvedInput {
  return { slot, type: 'COMFYTV_VIDEO', source, content } as ResolvedInput
}

describe('videoClipsFromInputs', () => {
  it('maps matching upstream inputs to clips with key/url/color', () => {
    const clips = videoClipsFromInputs([
      input('videos.video0', 'upstream', '/a.mp4'),
      input('videos.video2', 'upstream', '/b.mp4'),
    ])
    expect(clips).toEqual([
      { key: 'video0', url: '/a.mp4', color: slotColor(0) },
      { key: 'video2', url: '/b.mp4', color: slotColor(2) },
    ])
  })

  it('ignores non-video slots', () => {
    expect(videoClipsFromInputs([input('image'), input('videos.clip1')])).toEqual([])
  })

  it('ignores non-upstream sources and empty content', () => {
    expect(videoClipsFromInputs([
      input('videos.video0', 'empty', null),
      input('videos.video1', 'widget', '/w.mp4'),
      input('videos.video2', 'upstream', null),
    ])).toEqual([])
  })

  it('preserves input order', () => {
    const clips = videoClipsFromInputs([
      input('videos.video3'),
      input('videos.video1'),
    ])
    expect(clips.map(c => c.key)).toEqual(['video3', 'video1'])
  })
})
