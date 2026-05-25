import { describe, it, expect } from 'vitest'
import { IMAGE_VARIANT_PRESETS } from './imagePresets'

describe('IMAGE_VARIANT_PRESETS', () => {
  it('all have unique ids', () => {
    const ids = IMAGE_VARIANT_PRESETS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all carry icon and category', () => {
    for (const p of IMAGE_VARIANT_PRESETS) {
      expect(p.icon).toBeTruthy()
      expect(p.category).toBe('imageVariant')
    }
  })

  it('every preset has a target class', () => {
    for (const p of IMAGE_VARIANT_PRESETS) {
      expect(p.targetClass).toBeTruthy()
    }
  })

  it('every preset has an input socket or autogrow group', () => {
    for (const p of IMAGE_VARIANT_PRESETS) {
      expect(p.inputSocket || p.inputAutogrowGroup).toBeTruthy()
    }
  })

  it('multi-view presets pick variant_count widget', () => {
    for (const p of IMAGE_VARIANT_PRESETS) {
      if (p.targetClass === 'ComfyTV.ImageVariationsStage') {
        expect(p.widgets?.workflow).toBeTruthy()
        expect(typeof p.widgets?.variant_count).toBe('number')
      }
    }
  })

  it('relight preset seeds main_prompt + brightness', () => {
    const relight = IMAGE_VARIANT_PRESETS.find(p => p.targetClass === 'ComfyTV.RelightStage')
    expect(relight).toBeTruthy()
    expect(relight!.widgets?.main_prompt).toBeTruthy()
    expect(relight!.widgets?.brightness).toBeDefined()
  })

  it('frame-N presets target ImageEditStage', () => {
    const frames = IMAGE_VARIANT_PRESETS.filter(p => p.id.startsWith('frame-'))
    expect(frames.length).toBeGreaterThan(0)
    for (const f of frames) {
      expect(f.targetClass).toBe('ComfyTV.ImageEditStage')
    }
  })
})
