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

import {
  TRANSFORM_AXES as AXES,
  useScene3dTransformFields
} from '@/composables/widgets/useScene3dTransformFields'
import type { CharacterTransform } from '@/widgets/three/scene3d/types'

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

const { fields, activeField, activeRow, round, onTransformInput } =
  useScene3dTransformFields(
    () => transform,
    () => hideScale,
    (next) => emit('updateTransform', next)
  )
</script>
