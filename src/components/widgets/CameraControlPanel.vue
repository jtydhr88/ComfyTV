<template>
  <div class="ctv:absolute ctv:bottom-2 ctv:left-2 ctv:right-2 ctv:z-10 ctv:flex ctv:flex-col ctv:gap-1 ctv:py-1.5 ctv:px-2.5
              ctv:text-[11px] ctv:text-white/85 ctv:rounded-md ctv:backdrop-blur-sm
              ctv:bg-black/90 ctv:border ctv:border-[rgb(233_61_130/0.3)]">
    <div class="ctv:flex ctv:justify-around ctv:items-center">
      <div class="ctv:flex ctv:items-center ctv:gap-1">
        <span class="ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:whitespace-nowrap ctv:text-[#E93D82]">{{ $t('camera.horizontal') }}</span>
        <select
          :class="dropdownClass('azimuth')"
          :value="closestAzimuth"
          @change="onAzimuthSelect"
        >
          <option v-for="opt in azimuthOptions" :key="opt.value" :value="opt.value">
            {{ $t(`camera.azimuth.${opt.key}`) }}
          </option>
        </select>
      </div>
      <div class="ctv:flex ctv:items-center ctv:gap-1">
        <span class="ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:whitespace-nowrap ctv:text-[#00FFD0]">{{ $t('camera.vertical') }}</span>
        <select
          :class="dropdownClass('elevation')"
          :value="closestElevation"
          @change="onElevationSelect"
        >
          <option v-for="opt in elevationOptions" :key="opt.value" :value="opt.value">
            {{ $t(`camera.elevation.${opt.key}`) }}
          </option>
        </select>
      </div>
      <div class="ctv:flex ctv:items-center ctv:gap-1">
        <span class="ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:whitespace-nowrap ctv:text-[#FFB800]">{{ $t('camera.zoom') }}</span>
        <select
          :class="dropdownClass('distance')"
          :value="closestDistance"
          @change="onDistanceSelect"
        >
          <option v-for="opt in distanceOptions" :key="opt.value" :value="opt.value">
            {{ $t(`camera.distance.${opt.key}`) }}
          </option>
        </select>
      </div>
    </div>
    <div class="ctv:flex ctv:justify-around ctv:items-center">
      <div class="ctv:text-center ctv:text-[13px] ctv:font-semibold ctv:text-[#E93D82]">{{ Math.round(azimuth) }}&deg;</div>
      <div class="ctv:text-center ctv:text-[13px] ctv:font-semibold ctv:text-[#00FFD0]">{{ Math.round(elevation) }}&deg;</div>
      <div class="ctv:text-center ctv:text-[13px] ctv:font-semibold ctv:text-[#FFB800]">{{ distance.toFixed(1) }}</div>
      <button
        class="ctv:shrink-0 ctv:size-6 ctv:flex ctv:items-center ctv:justify-center ctv:text-sm ctv:cursor-pointer ctv:rounded
               ctv:bg-black/80 ctv:text-[#E93D82] ctv:border ctv:border-[rgb(233_61_130/0.4)]
               ctv:transition-all ctv:duration-200 ctv:hover:bg-[rgb(233_61_130/0.2)] ctv:hover:border-[#E93D82]
               ctv:active:scale-95"
        :title="$t('camera.resetToDefaults')"
        @click="$emit('reset')"
      >&#8634;</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import {
  AZIMUTH_OPTIONS,
  DISTANCE_OPTIONS,
  ELEVATION_OPTIONS,
  findClosestDistanceOption,
  findClosestOption,
} from '@/composables/widgets/cameraViewOptions'

const props = defineProps<{
  azimuth: number
  elevation: number
  distance: number
}>()

const emit = defineEmits<{
  'update:azimuth': [value: number]
  'update:elevation': [value: number]
  'update:distance': [value: number]
  'reset': []
}>()

const azimuthOptions = AZIMUTH_OPTIONS
const elevationOptions = ELEVATION_OPTIONS
const distanceOptions = DISTANCE_OPTIONS

const closestAzimuth = computed(() => findClosestOption(props.azimuth, azimuthOptions, true))
const closestElevation = computed(() => findClosestOption(props.elevation, elevationOptions))
const closestDistance = computed(() => findClosestDistanceOption(props.distance))

function onAzimuthSelect(e: Event) {
  emit('update:azimuth', parseInt((e.target as HTMLSelectElement).value, 10))
}

function onElevationSelect(e: Event) {
  emit('update:elevation', parseInt((e.target as HTMLSelectElement).value, 10))
}

function onDistanceSelect(e: Event) {
  emit('update:distance', parseInt((e.target as HTMLSelectElement).value, 10))
}

const DROPDOWN_BASE = 'ctv-camera-dropdown ctv:min-w-0 ctv:max-w-[90px] ctv:py-0.5 ctv:px-1 ctv:text-3xs ctv:cursor-pointer ctv:rounded ctv:outline-none ctv:backdrop-blur-sm'
  + ' ctv:bg-black/90 ctv:text-white/85 ctv:border ctv:border-white/20 ctv:hover:border-white/40'
const DROPDOWN_FOCUS = {
  azimuth:   'ctv:focus:border-[#E93D82]',
  elevation: 'ctv:focus:border-[#00FFD0]',
  distance:  'ctv:focus:border-[#FFB800]',
} as const
function dropdownClass(channel: keyof typeof DROPDOWN_FOCUS) {
  return `${DROPDOWN_BASE} ${DROPDOWN_FOCUS[channel]}`
}
</script>

<style scoped>
.ctv-camera-dropdown option {
  background: var(--interface-menu-surface, #1a1a2e);
  color: var(--base-foreground, #e0e0e0);
}
</style>
