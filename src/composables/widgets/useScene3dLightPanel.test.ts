import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { SceneLightEntry } from '@/widgets/three/scene3d/types'
import { useScene3dLightPanel } from './useScene3dLightPanel'

function makeLight(overrides: Partial<SceneLightEntry> = {}): SceneLightEntry {
  return {
    id: 'light_1',
    type: 'spot',
    color: '#ffffff',
    intensity: 5,
    position: { x: 1, y: 2, z: 3 },
    target: { x: 0, y: 0, z: -1 },
    ...overrides
  }
}

function setup(overrides: Partial<SceneLightEntry> = {}) {
  const light = ref(makeLight(overrides))
  const emitUpdate = vi.fn()
  const api = useScene3dLightPanel(() => light.value, emitUpdate)
  return { light, emitUpdate, api }
}

function inputEvent(value: string) {
  return { target: { value } } as unknown as Event
}

describe('useScene3dLightPanel', () => {
  it('exposes position values by default and target on demand', () => {
    const { api } = setup()
    expect(api.activeVector.value).toBe('position')
    expect(api.activeValues.value).toEqual({ x: 1, y: 2, z: 3 })
    api.activeVector.value = 'target'
    expect(api.activeValues.value).toEqual({ x: 0, y: 0, z: -1 })
  })

  it('falls back to zero when the target vector is missing', () => {
    const { api } = setup({ target: undefined })
    api.activeVector.value = 'target'
    expect(api.activeValues.value).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('resets to position when the light loses its target', async () => {
    const { api, light } = setup()
    api.activeVector.value = 'target'
    light.value = makeLight({ type: 'point', target: undefined })
    await nextTick()
    expect(api.activeVector.value).toBe('position')
  })

  it('rounds display values to 3 decimals', () => {
    const { api } = setup()
    expect(api.round(1.23456)).toBe(1.235)
    expect(api.round(-0.0004)).toBe(-0)
  })

  it('emits color patches', () => {
    const { api, emitUpdate } = setup()
    api.onColorInput(inputEvent('#ff0000'))
    expect(emitUpdate).toHaveBeenCalledWith({ color: '#ff0000' })
  })

  it('emits numeric patches and rejects junk', () => {
    const { api, emitUpdate } = setup()
    api.onNumber('intensity', inputEvent('7.5'))
    expect(emitUpdate).toHaveBeenCalledWith({ intensity: 7.5 })
    api.onNumber('outerConeAngle', inputEvent('45'))
    expect(emitUpdate).toHaveBeenCalledWith({ outerConeAngle: 45 })
    api.onNumber('range', inputEvent('junk'))
    expect(emitUpdate).toHaveBeenCalledTimes(2)
  })

  it('patches one axis of the chosen vector', () => {
    const { api, emitUpdate } = setup()
    api.onVectorInput('position', 'y', inputEvent('9'))
    expect(emitUpdate).toHaveBeenCalledWith({ position: { x: 1, y: 9, z: 3 } })
    api.onVectorInput('target', 'z', inputEvent('-4'))
    expect(emitUpdate).toHaveBeenCalledWith({ target: { x: 0, y: 0, z: -4 } })
    api.onVectorInput('position', 'x', inputEvent('junk'))
    expect(emitUpdate).toHaveBeenCalledTimes(2)
  })

  it('builds a target vector from zeros when missing', () => {
    const { api, emitUpdate } = setup({ target: undefined })
    api.onVectorInput('target', 'x', inputEvent('2'))
    expect(emitUpdate).toHaveBeenCalledWith({ target: { x: 2, y: 0, z: 0 } })
  })
})
