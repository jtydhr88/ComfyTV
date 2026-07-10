<template>

  <div class="ctv:flex ctv:flex-col ctv:gap-1">
    <div class="ctv:flex ctv:h-7 ctv:items-center ctv:gap-0.5 ctv:rounded-lg ctv:bg-secondary-background ctv:p-0.5">
      <button
        v-for="field in fields"
        :key="field"
        type="button"
        :aria-pressed="activeField === field"
        :class="segmentClass(activeField === field)"
        @click="activeField = field"
      >
        {{ $t(`scene3d.${field}`) }}
      </button>
    </div>
    <div class="ctv:flex ctv:items-center ctv:gap-2">
      <label
        v-for="axis in AXES"
        :key="axis"
        class="ctv:flex ctv:flex-1 ctv:min-w-0 ctv:items-center ctv:gap-1"
      >
        <span class="ctv:text-2xs ctv:uppercase ctv:text-muted-foreground">{{ axis }}</span>
        <input
          type="number"
          :step="activeRow.step"
          :value="round(activeRow.values[axis])"
          :class="fieldClass"
          @change="onTransformInput(activeField, axis, $event)"
        />
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed, ref } from 'vue'

import {
  eulerDegreesToQuat,
  quatToEulerDegrees
} from '@/widgets/three/scene3d/transformMath'
import type { CharacterTransform, Vec3 } from '@/widgets/three/scene3d/types'
import { cloneTransform } from '@/widgets/three/scene3d/types'

const AXES = ['x', 'y', 'z'] as const
type Axis = (typeof AXES)[number]
const FIELDS = ['position', 'rotation', 'scale'] as const
type TransformField = (typeof FIELDS)[number]

const fieldClass =
  'ctv:w-full ctv:min-w-0 ctv:flex-1 ctv:rounded-lg ctv:border-0 ctv:bg-secondary-background ' +
  'ctv:px-2 ctv:py-1 ctv:text-xs ctv:text-base-foreground ctv:outline-none ctv:[font-family:inherit]'

function segmentClass(active: boolean) {
  return (
    'ctv:flex-1 ctv:self-stretch ctv:rounded-md ctv:border-0 ctv:cursor-pointer ctv:px-1.5 ctv:text-2xs ' +
    'ctv:transition-colors ctv:outline-none ctv:[font-family:inherit] ' +
    (active
      ? 'ctv:bg-secondary-background-selected ctv:text-base-foreground'
      : 'ctv:bg-transparent ctv:text-muted-foreground ctv:hover:text-base-foreground')
  )
}

const { transform, hideScale = false } = defineProps<{
  transform: CharacterTransform
  hideScale?: boolean
}>()

const emit = defineEmits<{
  updateTransform: [transform: CharacterTransform]
}>()

const fields = computed(() =>
  hideScale ? FIELDS.filter((field) => field !== 'scale') : FIELDS
)

const activeField = ref<TransformField>('position')

const activeRow = computed((): { values: Vec3; step: number } => {
  if (activeField.value === 'position') {
    return { values: transform.position, step: 0.1 }
  }
  if (activeField.value === 'rotation') {
    return { values: quatToEulerDegrees(transform.quaternion), step: 1 }
  }
  return { values: transform.scale, step: 0.1 }
})

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

function onTransformInput(field: TransformField, axis: Axis, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  const next = cloneTransform(transform)
  if (field === 'position' || field === 'scale') {
    next[field][axis] = value
  } else {
    const degrees = quatToEulerDegrees(next.quaternion)
    degrees[axis] = value
    next.quaternion = eulerDegreesToQuat(degrees)
  }
  emit('updateTransform', next)
}
</script>
