import { computed, ref, watch } from 'vue'

import type { SceneLightEntry, Vec3 } from '@/widgets/three/scene3d/types'

export const LIGHT_AXES = ['x', 'y', 'z'] as const
export type LightAxis = (typeof LIGHT_AXES)[number]

export const LIGHT_VECTOR_FIELDS = ['position', 'target'] as const
export type LightVectorField = (typeof LIGHT_VECTOR_FIELDS)[number]

export type LightNumberField =
  | 'intensity'
  | 'range'
  | 'innerConeAngle'
  | 'outerConeAngle'

export function useScene3dLightPanel(
  getLight: () => SceneLightEntry,
  emitUpdate: (patch: Partial<SceneLightEntry>) => void
) {
  const activeVector = ref<LightVectorField>('position')

  watch(
    () => getLight().target,
    (target) => {
      if (!target) activeVector.value = 'position'
    }
  )

  const activeValues = computed(
    (): Vec3 =>
      (activeVector.value === 'position'
        ? getLight().position
        : getLight().target) ?? {
        x: 0,
        y: 0,
        z: 0
      }
  )

  function round(value: number): number {
    return Math.round(value * 1000) / 1000
  }

  function onColorInput(event: Event): void {
    emitUpdate({ color: (event.target as HTMLInputElement).value })
  }

  function onNumber(field: LightNumberField, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value)
    if (!Number.isFinite(value)) return
    emitUpdate({ [field]: value })
  }

  function onVectorInput(
    field: LightVectorField,
    axis: LightAxis,
    event: Event
  ): void {
    const value = Number((event.target as HTMLInputElement).value)
    if (!Number.isFinite(value)) return
    const source =
      field === 'position' ? getLight().position : getLight().target
    const vector = { ...(source ?? { x: 0, y: 0, z: 0 }), [axis]: value }
    emitUpdate({ [field]: vector })
  }

  return {
    activeVector,
    activeValues,
    round,
    onColorInput,
    onNumber,
    onVectorInput
  }
}
