import { describe, it, expect } from 'vitest'
import { VIDEO_CHANGE_PRESETS } from './videoChangePresets'

describe('VIDEO_CHANGE_PRESETS', () => {
  it('unique ids', () => {
    const ids = VIDEO_CHANGE_PRESETS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('category is videoChange', () => {
    for (const p of VIDEO_CHANGE_PRESETS) expect(p.category).toBe('videoChange')
  })
  it('every preset wires a video input', () => {
    // multi-input stages expose their primary clip under a named slot
    const namedSlots: Record<string, string> = {
      transition: 'video_a',
      composite: 'background',
      'key-mix': 'video_a',
    }
    for (const p of VIDEO_CHANGE_PRESETS) {
      if (p.inputAutogrowGroup) expect(p.inputAutogrowGroup).toBe('videos')
      else expect(p.inputSocket).toBe(namedSlots[p.id] ?? 'video')
    }
  })
  it('demux uses multiTargetClasses', () => {
    const demux = VIDEO_CHANGE_PRESETS.find(p => p.id === 'demux')
    expect(demux?.multiTargetClasses?.length).toBe(2)
    expect(demux?.targetClass).toBeUndefined()
  })
  it('non-demux presets have targetClass', () => {
    for (const p of VIDEO_CHANGE_PRESETS) {
      if (p.id !== 'demux') expect(p.targetClass).toBeTruthy()
    }
  })
})
