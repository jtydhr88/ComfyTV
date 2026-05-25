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
  it('every preset wires video', () => {
    for (const p of VIDEO_CHANGE_PRESETS) expect(p.inputSocket).toBe('video')
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
