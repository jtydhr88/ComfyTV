import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { quatToEulerDegrees } from '@/widgets/three/scene3d/transformMath'
import type { CharacterTransform } from '@/widgets/three/scene3d/types'
import {
  TRANSFORM_FIELDS,
  useScene3dTransformFields
} from './useScene3dTransformFields'

function makeTransform(): CharacterTransform {
  return {
    position: { x: 1, y: 2, z: 3 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 }
  }
}

function setup(hideScale = false) {
  const transform = ref(makeTransform())
  const emitUpdate = vi.fn()
  const api = useScene3dTransformFields(
    () => transform.value,
    () => hideScale,
    emitUpdate
  )
  return { transform, emitUpdate, api }
}

function inputEvent(value: string) {
  return { target: { value } } as unknown as Event
}

describe('useScene3dTransformFields', () => {
  it('lists all fields, dropping scale when hidden', () => {
    expect(setup().api.fields.value).toEqual([...TRANSFORM_FIELDS])
    expect(setup(true).api.fields.value).toEqual(['position', 'rotation'])
  })

  it('exposes the active row values and step per field', () => {
    const { api } = setup()
    expect(api.activeRow.value).toEqual({ values: { x: 1, y: 2, z: 3 }, step: 0.1 })

    api.activeField.value = 'rotation'
    expect(api.activeRow.value.step).toBe(1)
    expect(api.activeRow.value.values.x).toBeCloseTo(0)

    api.activeField.value = 'scale'
    expect(api.activeRow.value).toEqual({ values: { x: 1, y: 1, z: 1 }, step: 0.1 })
  })

  it('rounds display values to 3 decimals', () => {
    const { api } = setup()
    expect(api.round(0.12345)).toBe(0.123)
  })

  it('emits a cloned transform with one position axis changed', () => {
    const { api, emitUpdate, transform } = setup()
    api.onTransformInput('position', 'y', inputEvent('7'))
    expect(emitUpdate).toHaveBeenCalledTimes(1)
    const next = emitUpdate.mock.calls[0][0] as CharacterTransform
    expect(next.position).toEqual({ x: 1, y: 7, z: 3 })
    expect(next).not.toBe(transform.value)
    expect(transform.value.position.y).toBe(2)
  })

  it('emits scale changes', () => {
    const { api, emitUpdate } = setup()
    api.onTransformInput('scale', 'z', inputEvent('2.5'))
    const next = emitUpdate.mock.calls[0][0] as CharacterTransform
    expect(next.scale).toEqual({ x: 1, y: 1, z: 2.5 })
  })

  it('converts rotation edits from degrees back to a quaternion', () => {
    const { api, emitUpdate } = setup()
    api.onTransformInput('rotation', 'y', inputEvent('90'))
    const next = emitUpdate.mock.calls[0][0] as CharacterTransform
    const degrees = quatToEulerDegrees(next.quaternion)
    expect(degrees.y).toBeCloseTo(90)
    expect(degrees.x).toBeCloseTo(0)
    expect(degrees.z).toBeCloseTo(0)
  })

  it('ignores non-numeric input', () => {
    const { api, emitUpdate } = setup()
    api.onTransformInput('position', 'x', inputEvent('junk'))
    expect(emitUpdate).not.toHaveBeenCalled()
  })
})
