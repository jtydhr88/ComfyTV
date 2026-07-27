import { describe, expect, it } from 'vitest'

import { ARTBOARD_MAX, ARTBOARD_MIN } from '@/composables/widgets/useLayerListPanel'

import { CANVAS_PRESET_GROUPS, findCanvasPreset } from './canvasPresets'

const allPresets = CANVAS_PRESET_GROUPS.flatMap((g) => g.presets)

describe('CANVAS_PRESET_GROUPS', () => {
  it('has unique ids across all groups', () => {
    const ids = allPresets.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps every preset inside the artboard limits', () => {
    for (const p of allPresets) {
      expect(p.width, `${p.id} width`).toBeGreaterThanOrEqual(ARTBOARD_MIN)
      expect(p.width, `${p.id} width`).toBeLessThanOrEqual(ARTBOARD_MAX)
      expect(p.height, `${p.id} height`).toBeGreaterThanOrEqual(ARTBOARD_MIN)
      expect(p.height, `${p.id} height`).toBeLessThanOrEqual(ARTBOARD_MAX)
    }
  })

  it('matches gimp template dimensions for key entries', () => {
    expect(findCanvasPreset('a4')).toMatchObject({ width: 2480, height: 3508 })
    expect(findCanvasPreset('us-letter')).toMatchObject({ width: 2550, height: 3300 })
    expect(findCanvasPreset('full-hd')).toMatchObject({ width: 1920, height: 1080 })
    expect(findCanvasPreset('dci-4k')).toMatchObject({ width: 4096, height: 2160 })
    expect(findCanvasPreset('phone-20-9')).toMatchObject({ width: 1440, height: 3200 })
    expect(findCanvasPreset('toilet-paper')).toMatchObject({ width: 1350, height: 1350 })
  })

  it('returns null for unknown ids', () => {
    expect(findCanvasPreset('a0')).toBeNull()
    expect(findCanvasPreset('')).toBeNull()
  })
})
