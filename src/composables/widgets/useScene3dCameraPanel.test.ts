import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('@/i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))

import type { SceneCameraEntry } from '@/widgets/three/scene3d/types'
import {
  FREE_PRESET_VALUE,
  useScene3dCameraPanel
} from './useScene3dCameraPanel'

function makeCamera(preset: SceneCameraEntry['preset'] = null): SceneCameraEntry {
  return {
    id: 'cam_1',
    fov: 50,
    transform: {
      position: { x: 1, y: 2, z: 3 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 }
    },
    preset
  }
}

function setup(preset: SceneCameraEntry['preset'] = null) {
  const camera = ref(makeCamera(preset))
  const emit = { bindPreset: vi.fn(), updateTuning: vi.fn() }
  const presets = [
    { id: 'p1', name: 'Pan', category: 'Basic', file: 'basic/pan.json' },
    { id: 'p2', name: 'Zoom', category: 'Move', file: 'move/zoom.json' }
  ]
  const api = useScene3dCameraPanel(() => camera.value, () => presets, emit)
  return { camera, emit, api }
}

function inputEvent(value: string) {
  return { target: { value } } as unknown as Event
}

describe('useScene3dCameraPanel: presets', () => {
  it('lists the free camera first, then categorized presets', () => {
    const { api } = setup()
    expect(api.presetOptions.value).toEqual([
      { value: FREE_PRESET_VALUE, label: 'scene3d.freeCamera' },
      { value: 'p1', label: 'Basic · Pan' },
      { value: 'p2', label: 'Move · Zoom' }
    ])
  })

  it('maps the free value to null and ignores non-strings', () => {
    const { api, emit } = setup()
    api.onPresetChange(FREE_PRESET_VALUE)
    expect(emit.bindPreset).toHaveBeenCalledWith(null)
    api.onPresetChange('p2')
    expect(emit.bindPreset).toHaveBeenCalledWith('p2')
    api.onPresetChange(3)
    expect(emit.bindPreset).toHaveBeenCalledTimes(2)
  })
})

describe('useScene3dCameraPanel: transform + tuning', () => {
  it('exposes the camera transform with unit scale', () => {
    const { api } = setup()
    expect(api.cameraTransform.value).toEqual({
      position: { x: 1, y: 2, z: 3 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    })
  })

  it('falls back to empty tuning without a preset', () => {
    const { api } = setup()
    expect(api.tuning.value).toEqual({})
    expect(api.offsetValue('x')).toBe(0)
  })

  it('rounds offsets to 3 decimals', () => {
    const { api } = setup({
      presetId: 'p1',
      file: 'f',
      tuning: { positionOffset: { x: 0.12345, y: 0, z: -2 } },
      speed: 1
    })
    expect(api.offsetValue('x')).toBe(0.123)
    expect(api.offsetValue('z')).toBe(-2)
  })

  it('merges a single axis into the offset patch', () => {
    const { api, emit } = setup({
      presetId: 'p1',
      file: 'f',
      tuning: { positionOffset: { x: 1, y: 2, z: 3 } },
      speed: 1
    })
    api.onOffsetInput('y', inputEvent('9'))
    expect(emit.updateTuning).toHaveBeenCalledWith({
      positionOffset: { x: 1, y: 9, z: 3 }
    })
    api.onOffsetInput('y', inputEvent('junk'))
    expect(emit.updateTuning).toHaveBeenCalledTimes(1)
  })

  it('starts a fresh offset from zero when unset', () => {
    const { api, emit } = setup({ presetId: 'p1', file: 'f', tuning: {}, speed: 1 })
    api.onOffsetInput('z', inputEvent('4'))
    expect(emit.updateTuning).toHaveBeenCalledWith({
      positionOffset: { x: 0, y: 0, z: 4 }
    })
  })
})

describe('useScene3dCameraPanel: sliders', () => {
  it('exposes tuned values with defaults and formatting', () => {
    const { api } = setup({
      presetId: 'p1',
      file: 'f',
      tuning: { fovScale: 1.5, yawDegrees: -30.4 },
      speed: 1
    })
    const byKey = Object.fromEntries(
      api.tuningSliders.value.map((s) => [s.key, s])
    )
    expect(byKey.fovScale.value).toBe(1.5)
    expect(byKey.fovScale.format(1.5)).toBe('1.50x')
    expect(byKey.pathScale.value).toBe(1)
    expect(byKey.yawDegrees.value).toBe(-30.4)
    expect(byKey.yawDegrees.format(-30.4)).toBe('-30°')
    expect(byKey.rollDegrees.value).toBe(0)
  })

  it('each slider update patches its own key', () => {
    const { api, emit } = setup({ presetId: 'p1', file: 'f', tuning: {}, speed: 1 })
    for (const slider of api.tuningSliders.value) slider.update(2)
    expect(emit.updateTuning).toHaveBeenCalledWith({ fovScale: 2 })
    expect(emit.updateTuning).toHaveBeenCalledWith({ pathScale: 2 })
    expect(emit.updateTuning).toHaveBeenCalledWith({ yawDegrees: 2 })
    expect(emit.updateTuning).toHaveBeenCalledWith({ rollDegrees: 2 })
  })

  it('resetTuning restores every default', () => {
    const { api, emit } = setup()
    api.resetTuning()
    expect(emit.updateTuning).toHaveBeenCalledWith({
      fovScale: 1,
      pathScale: 1,
      yawDegrees: 0,
      rollDegrees: 0,
      reverse: false,
      positionOffset: { x: 0, y: 0, z: 0 }
    })
  })
})
