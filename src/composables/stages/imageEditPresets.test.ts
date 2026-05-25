import { describe, it, expect } from 'vitest'
import { IMAGE_EDIT_PRESETS } from './imageEditPresets'

describe('IMAGE_EDIT_PRESETS', () => {
  it('unique ids', () => {
    const ids = IMAGE_EDIT_PRESETS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('category is imageEdit', () => {
    for (const p of IMAGE_EDIT_PRESETS) {
      expect(p.category).toBe('imageEdit')
    }
  })
  it('all wire image input', () => {
    for (const p of IMAGE_EDIT_PRESETS) {
      expect(p.inputSocket).toBe('image')
    }
  })
  it('includes expected stages', () => {
    const ids = new Set(IMAGE_EDIT_PRESETS.map(p => p.id))
    for (const exp of ['hd', 'outpaint', 'inpaint', 'erase', 'cutout',
                       'crop', 'rotate', 'mirror', 'grid']) {
      expect(ids.has(exp)).toBe(true)
    }
  })
})
