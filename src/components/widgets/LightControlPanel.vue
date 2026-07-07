<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1 ctv:text-xs ctv:text-white/85">
    <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:px-1">
      <button
        type="button"
        :class="actionClass(gizmosOn)"
        :title="gizmosOn ? $t('lightBall.hideGizmos') : $t('lightBall.showGizmos')"
        @click="$emit('toggle-gizmos')"
      >{{ gizmosOn ? $t('lightBall.hideGizmos') : $t('lightBall.showGizmos') }}</button>

      <div class="ctv:mx-1 ctv:h-4 ctv:w-px ctv:shrink-0 ctv:bg-white/15" />

      <button
        v-for="option in transformOptions"
        :key="option.value"
        type="button"
        :disabled="!option.enabled"
        :class="[actionClass(transformMode === option.value),
                 !option.enabled && 'ctv:cursor-not-allowed ctv:opacity-40']"
        :title="option.label"
        @click="$emit('set-transform-mode', option.value)"
      >{{ option.label }}</button>

      <div class="ctv:flex-1" />

      <button
        type="button"
        :class="actionClass(false)"
        :title="$t('lightBall.outputView')"
        @click="$emit('reset-view')"
      >&#8982;</button>
      <button
        type="button"
        :class="actionClass(cameraLocked)"
        :title="cameraLocked ? $t('lightBall.unlockCamera') : $t('lightBall.lockCamera')"
        @click="$emit('toggle-lock')"
      >{{ cameraLocked ? '&#128274;' : '&#128275;' }}</button>
    </div>

    <div class="ctv:flex ctv:h-8 ctv:items-center ctv:gap-1 ctv:overflow-x-auto ctv:px-1">
      <button
        v-for="(light, index) in lights"
        :key="index"
        type="button"
        :class="chipClass(index === selectedIndex)"
        :title="$t(`lightBall.${light.type}`)"
        @click="$emit('select', index)"
      >
        <span
          class="ctv:size-2.5 ctv:shrink-0 ctv:rounded-full"
          :style="{ backgroundColor: light.color }"
        />
        {{ String(index + 1).padStart(2, '0') }}
      </button>
      <button
        type="button"
        :class="actionClass(false)"
        :title="$t('lightBall.addLight')"
        @click="$emit('add', 'directional')"
      >+</button>
      <button
        v-if="selectedLight"
        type="button"
        :class="actionClass(false)"
        :title="$t('lightBall.removeLight')"
        @click="$emit('remove')"
      >&#215;</button>
    </div>

    <div
      v-if="selectedLight"
      class="ctv:flex ctv:flex-col ctv:gap-2 ctv:rounded-md ctv:bg-black/40 ctv:border ctv:border-white/10 ctv:p-2"
    >
      <div class="ctv:flex ctv:h-7 ctv:items-center ctv:gap-1 ctv:rounded ctv:bg-black/60 ctv:p-0.5">
        <button
          v-for="type in LIGHT_TYPES"
          :key="type"
          type="button"
          :class="segmentClass(selectedLight.type === type)"
          @click="$emit('set-type', type)"
        >{{ $t(`lightBall.${type}`) }}</button>
      </div>
      <div class="ctv:flex ctv:items-center ctv:gap-3">
        <label class="ctv:flex ctv:items-center ctv:gap-2">
          <span class="ctv:text-white/50">{{ $t('lightBall.color') }}</span>
          <input
            type="color"
            :value="selectedLight.color"
            class="ctv:h-6 ctv:w-8 ctv:cursor-pointer ctv:rounded ctv:border-0 ctv:bg-transparent ctv:p-0"
            @input="onColorInput"
          />
        </label>
        <label class="ctv:flex ctv:flex-1 ctv:items-center ctv:gap-2">
          <span class="ctv:text-white/50">{{ $t('lightBall.intensity') }}</span>
          <input
            type="number"
            min="0"
            step="0.1"
            :value="selectedLight.intensity"
            :class="numberClass"
            @change="onNumberInput('intensity', $event)"
          />
        </label>
      </div>
      <div
        v-if="selectedLight.type !== 'directional'"
        class="ctv:flex ctv:items-center ctv:gap-3"
      >
        <label class="ctv:flex ctv:flex-1 ctv:items-center ctv:gap-2">
          <span class="ctv:text-white/50">{{ $t('lightBall.range') }}</span>
          <input
            type="number"
            min="0"
            step="0.5"
            :value="selectedLight.range ?? 0"
            :class="numberClass"
            @change="onNumberInput('range', $event)"
          />
        </label>
        <template v-if="selectedLight.type === 'spot'">
          <label class="ctv:flex ctv:flex-1 ctv:items-center ctv:gap-2">
            <span class="ctv:text-white/50">{{ $t('lightBall.innerCone') }}</span>
            <input
              type="number"
              min="0"
              max="89"
              step="1"
              :value="selectedLight.innerConeAngle ?? 30"
              :class="numberClass"
              @change="onNumberInput('innerConeAngle', $event)"
            />
          </label>
          <label class="ctv:flex ctv:flex-1 ctv:items-center ctv:gap-2">
            <span class="ctv:text-white/50">{{ $t('lightBall.outerCone') }}</span>
            <input
              type="number"
              min="1"
              max="90"
              step="1"
              :value="selectedLight.outerConeAngle ?? 45"
              :class="numberClass"
              @change="onNumberInput('outerConeAngle', $event)"
            />
          </label>
        </template>
      </div>
    </div>
    <div v-else class="ctv:px-2 ctv:pb-1 ctv:text-white/40">
      {{ $t('lightBall.noLights') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  lightPositionApplies,
  targetApplies,
  type LightTransformGizmoMode
} from '@/widgets/three/light/LightBallWidget'
import {
  LIGHT_TYPES,
  type LightInfoEntry,
  type LightInfoType
} from '@/widgets/three/light/types'

const props = defineProps<{
  lights: LightInfoEntry[]
  selectedIndex: number
  gizmosOn: boolean
  transformMode: LightTransformGizmoMode
  cameraLocked: boolean
}>()

const emit = defineEmits<{
  'select': [index: number]
  'add': [type: LightInfoType]
  'remove': []
  'update': [patch: Partial<LightInfoEntry>]
  'set-type': [type: LightInfoType]
  'toggle-gizmos': []
  'set-transform-mode': [mode: LightTransformGizmoMode]
  'reset-view': []
  'toggle-lock': []
}>()

const { t } = useI18n()

const selectedLight = computed<LightInfoEntry | null>(
  () => props.lights[props.selectedIndex] ?? null
)

const transformOptions = computed(() => [
  {
    value: 'none' as const,
    label: t('lightBall.transformNone'),
    enabled: true
  },
  {
    value: 'light-position' as const,
    label: t('lightBall.transformPosition'),
    enabled:
      selectedLight.value !== null &&
      lightPositionApplies(selectedLight.value.type)
  },
  {
    value: 'target' as const,
    label: t('lightBall.transformTarget'),
    enabled:
      selectedLight.value !== null && targetApplies(selectedLight.value.type)
  }
])

function actionClass(active: boolean) {
  return [
    'ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-1 ctv:rounded ctv:px-2 ctv:py-1 ctv:text-xs',
    'ctv:cursor-pointer ctv:border ctv:transition-colors ctv:duration-150',
    active
      ? 'ctv:bg-[rgb(233_61_130/0.2)] ctv:border-[rgb(233_61_130/0.5)] ctv:text-[#E93D82]'
      : 'ctv:bg-black/60 ctv:border-white/15 ctv:text-white/70 ctv:hover:border-white/40 ctv:hover:text-white'
  ].join(' ')
}

function chipClass(active: boolean) {
  return [
    'ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-1.5 ctv:rounded ctv:px-2 ctv:py-1 ctv:font-mono ctv:text-xs',
    'ctv:cursor-pointer ctv:border ctv:transition-colors ctv:duration-150',
    active
      ? 'ctv:bg-[rgb(233_61_130/0.2)] ctv:border-[#E93D82] ctv:text-white'
      : 'ctv:bg-transparent ctv:border-white/15 ctv:text-white/50 ctv:hover:text-white ctv:hover:border-white/40'
  ].join(' ')
}

function segmentClass(active: boolean) {
  return [
    'ctv:flex-1 ctv:self-stretch ctv:rounded ctv:border-0 ctv:px-2 ctv:text-xs ctv:cursor-pointer ctv:transition-colors',
    active
      ? 'ctv:bg-[rgb(233_61_130/0.25)] ctv:text-[#E93D82]'
      : 'ctv:bg-transparent ctv:text-white/50 ctv:hover:text-white'
  ].join(' ')
}

const numberClass =
  'ctv:w-full ctv:min-w-0 ctv:flex-1 ctv:rounded ctv:border ctv:border-white/15 ctv:bg-black/60 ctv:px-2 ctv:py-1 ctv:text-xs ctv:text-white/85 ctv:outline-none ctv:focus:border-[#E93D82]'

function onColorInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  emit('update', { color: value })
}

function onNumberInput(
  field: 'intensity' | 'range' | 'innerConeAngle' | 'outerConeAngle',
  event: Event
) {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  emit('update', { [field]: value })
}
</script>
