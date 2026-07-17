import { computed, ref } from 'vue'

import {
  eulerDegreesToQuat,
  quatToEulerDegrees
} from '@/widgets/three/scene3d/transformMath'
import type { CharacterTransform, Vec3 } from '@/widgets/three/scene3d/types'
import { cloneTransform } from '@/widgets/three/scene3d/types'

export const TRANSFORM_AXES = ['x', 'y', 'z'] as const
export type TransformAxis = (typeof TRANSFORM_AXES)[number]

export const TRANSFORM_FIELDS = ['position', 'rotation', 'scale'] as const
export type TransformField = (typeof TRANSFORM_FIELDS)[number]

export function useScene3dTransformFields(
  getTransform: () => CharacterTransform,
  getHideScale: () => boolean,
  emitUpdate: (transform: CharacterTransform) => void
) {
  const fields = computed(() =>
    getHideScale()
      ? TRANSFORM_FIELDS.filter((field) => field !== 'scale')
      : TRANSFORM_FIELDS
  )

  const activeField = ref<TransformField>('position')

  const activeRow = computed((): { values: Vec3; step: number } => {
    if (activeField.value === 'position') {
      return { values: getTransform().position, step: 0.1 }
    }
    if (activeField.value === 'rotation') {
      return { values: quatToEulerDegrees(getTransform().quaternion), step: 1 }
    }
    return { values: getTransform().scale, step: 0.1 }
  })

  function round(value: number): number {
    return Math.round(value * 1000) / 1000
  }

  function onTransformInput(
    field: TransformField,
    axis: TransformAxis,
    event: Event
  ): void {
    const value = Number((event.target as HTMLInputElement).value)
    if (!Number.isFinite(value)) return
    const next = cloneTransform(getTransform())
    if (field === 'position' || field === 'scale') {
      next[field][axis] = value
    } else {
      const degrees = quatToEulerDegrees(next.quaternion)
      degrees[axis] = value
      next.quaternion = eulerDegreesToQuat(degrees)
    }
    emitUpdate(next)
  }

  return { fields, activeField, activeRow, round, onTransformInput }
}
