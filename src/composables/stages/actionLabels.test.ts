import { describe, it, expect } from 'vitest'
import {
  actionNamespace,
  actionLabelKey,
  actionTooltipKey,
  presetLabelKey,
  presetTooltipKey,
} from './actionLabels'

describe('actionLabels', () => {
  it('actionNamespace maps image-picker → image', () => {
    expect(actionNamespace('image-picker')).toBe('image')
  })
  it('actionNamespace passes through other kinds', () => {
    expect(actionNamespace('image')).toBe('image')
    expect(actionNamespace('video')).toBe('video')
    expect(actionNamespace('audio')).toBe('audio')
  })
  it('actionLabelKey builds key from kind + id', () => {
    expect(actionLabelKey('image', 'refine')).toBe('actions.image.refine.label')
    expect(actionLabelKey('image-picker', 'send')).toBe('actions.image.send.label')
  })
  it('actionTooltipKey builds key from kind + id', () => {
    expect(actionTooltipKey('video', 'clip')).toBe('actions.video.clip.tooltip')
  })
  it('presetLabelKey builds key from category + id', () => {
    expect(presetLabelKey('imageVariant', 'face-3view'))
      .toBe('presets.imageVariant.face-3view.label')
  })
  it('presetTooltipKey builds key from category + id', () => {
    expect(presetTooltipKey('imageEdit', 'denoise'))
      .toBe('presets.imageEdit.denoise.tooltip')
  })
})
