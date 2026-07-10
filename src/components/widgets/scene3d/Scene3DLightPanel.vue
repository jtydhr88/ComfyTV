<template>

  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:rounded-lg ctv:bg-node-background ctv:p-1.5 ctv:text-xs">
    <div class="ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-x-3 ctv:gap-y-1.5">
      <span class="ctv:shrink-0 ctv:text-muted-foreground">
        {{ $t(`scene3d.${light.type}`) }}
      </span>
      <label class="ctv:flex ctv:items-center ctv:gap-1.5">
        <span class="ctv:text-muted-foreground">{{ $t('scene3d.color') }}</span>
        <input
          type="color"
          :value="light.color"
          class="ctv:h-6 ctv:w-8 ctv:cursor-pointer ctv:rounded-md ctv:border-0 ctv:bg-transparent ctv:p-0"
          @input="onColorInput"
        />
      </label>
      <label class="ctv:flex ctv:items-center ctv:gap-1.5">
        <span class="ctv:text-muted-foreground">{{ $t('scene3d.intensity') }}</span>
        <input
          type="number"
          min="0"
          step="0.5"
          :value="light.intensity"
          :class="narrowFieldClass"
          @change="onNumber('intensity', $event)"
        />
      </label>
      <label
        v-if="light.type !== 'directional'"
        class="ctv:flex ctv:items-center ctv:gap-1.5"
      >
        <span class="ctv:text-muted-foreground">{{ $t('scene3d.range') }}</span>
        <input
          type="number"
          min="0"
          step="0.5"
          :value="light.range ?? 0"
          :class="narrowFieldClass"
          @change="onNumber('range', $event)"
        />
      </label>
    </div>
    <div class="ctv:flex ctv:items-center ctv:gap-2">
      <div
        v-if="light.target"
        class="ctv:flex ctv:h-7 ctv:shrink-0 ctv:items-center ctv:gap-0.5 ctv:rounded-lg ctv:bg-secondary-background ctv:p-0.5"
      >
        <button
          v-for="field in VECTOR_FIELDS"
          :key="field"
          type="button"
          :aria-pressed="activeVector === field"
          :class="segmentClass(activeVector === field)"
          @click="activeVector = field"
        >
          {{ $t(`scene3d.${field}`) }}
        </button>
      </div>
      <span v-else class="ctv:w-14 ctv:shrink-0 ctv:text-muted-foreground">
        {{ $t('scene3d.position') }}
      </span>
      <label
        v-for="axis in AXES"
        :key="axis"
        class="ctv:flex ctv:flex-1 ctv:min-w-0 ctv:items-center ctv:gap-1"
      >
        <span class="ctv:text-2xs ctv:uppercase ctv:text-muted-foreground">{{ axis }}</span>
        <input
          type="number"
          step="0.1"
          :value="round(activeValues[axis])"
          :class="fieldClass"
          @change="onVectorInput(activeVector, axis, $event)"
        />
      </label>
    </div>
    <div v-if="light.type === 'spot'" class="ctv:flex ctv:items-center ctv:gap-2">
      <label class="ctv:flex ctv:flex-1 ctv:items-center ctv:gap-1.5">
        <span class="ctv:text-muted-foreground">{{ $t('scene3d.innerCone') }}</span>
        <input
          type="number"
          min="0"
          max="89"
          step="1"
          :value="light.innerConeAngle ?? 30"
          :class="fieldClass"
          @change="onNumber('innerConeAngle', $event)"
        />
      </label>
      <label class="ctv:flex ctv:flex-1 ctv:items-center ctv:gap-1.5">
        <span class="ctv:text-muted-foreground">{{ $t('scene3d.outerCone') }}</span>
        <input
          type="number"
          min="1"
          max="90"
          step="1"
          :value="light.outerConeAngle ?? 45"
          :class="fieldClass"
          @change="onNumber('outerConeAngle', $event)"
        />
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed, ref, watch } from 'vue'

import type { SceneLightEntry, Vec3 } from '@/widgets/three/scene3d/types'

const AXES = ['x', 'y', 'z'] as const
type Axis = (typeof AXES)[number]
const VECTOR_FIELDS = ['position', 'target'] as const
type VectorField = (typeof VECTOR_FIELDS)[number]

const fieldClass =
  'ctv:w-full ctv:min-w-0 ctv:flex-1 ctv:rounded-lg ctv:border-0 ctv:bg-secondary-background ' +
  'ctv:px-2 ctv:py-1 ctv:text-xs ctv:text-base-foreground ctv:outline-none ctv:[font-family:inherit]'

const narrowFieldClass =
  'ctv:w-14 ctv:flex-none ctv:rounded-lg ctv:border-0 ctv:bg-secondary-background ' +
  'ctv:px-2 ctv:py-1 ctv:text-xs ctv:text-base-foreground ctv:outline-none ctv:[font-family:inherit]'

function segmentClass(active: boolean) {
  return (
    'ctv:self-stretch ctv:rounded-md ctv:border-0 ctv:cursor-pointer ctv:px-1.5 ctv:text-2xs ' +
    'ctv:transition-colors ctv:outline-none ctv:[font-family:inherit] ' +
    (active
      ? 'ctv:bg-secondary-background-selected ctv:text-base-foreground'
      : 'ctv:bg-transparent ctv:text-muted-foreground ctv:hover:text-base-foreground')
  )
}

const { light } = defineProps<{
  light: SceneLightEntry
}>()

const emit = defineEmits<{
  updateLight: [patch: Partial<SceneLightEntry>]
}>()

const activeVector = ref<VectorField>('position')

watch(
  () => light.target,
  (target) => {
    if (!target) activeVector.value = 'position'
  }
)

const activeValues = computed(
  (): Vec3 =>
    (activeVector.value === 'position' ? light.position : light.target) ?? {
      x: 0,
      y: 0,
      z: 0
    }
)

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

function onColorInput(event: Event) {
  emit('updateLight', { color: (event.target as HTMLInputElement).value })
}

function onNumber(
  field: 'intensity' | 'range' | 'innerConeAngle' | 'outerConeAngle',
  event: Event
) {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  emit('updateLight', { [field]: value })
}

function onVectorInput(field: VectorField, axis: Axis, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  const source = field === 'position' ? light.position : light.target
  const vector = { ...(source ?? { x: 0, y: 0, z: 0 }), [axis]: value }
  emit('updateLight', { [field]: vector })
}
</script>
