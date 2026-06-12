<template>
  <div class="absolute bottom-2 left-2 right-2 z-10 flex flex-col gap-1 py-1.5 px-2.5
              text-[11px] text-white/85 rounded-md backdrop-blur-sm
              bg-black/90 border border-[rgb(233_61_130/0.3)]">
    <div class="flex justify-around items-center">
      <div class="flex items-center gap-1">
        <span class="text-3xs uppercase tracking-wide whitespace-nowrap text-[#E93D82]">{{ $t('camera.horizontal') }}</span>
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
      <div class="flex items-center gap-1">
        <span class="text-3xs uppercase tracking-wide whitespace-nowrap text-[#00FFD0]">{{ $t('camera.vertical') }}</span>
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
      <div class="flex items-center gap-1">
        <span class="text-3xs uppercase tracking-wide whitespace-nowrap text-[#FFB800]">{{ $t('camera.zoom') }}</span>
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
    <div class="flex justify-around items-center">
      <div class="text-center text-[13px] font-semibold text-[#E93D82]">{{ Math.round(azimuth) }}&deg;</div>
      <div class="text-center text-[13px] font-semibold text-[#00FFD0]">{{ Math.round(elevation) }}&deg;</div>
      <div class="text-center text-[13px] font-semibold text-[#FFB800]">{{ distance.toFixed(1) }}</div>
      <button
        class="shrink-0 size-6 flex items-center justify-center text-sm cursor-pointer rounded
               bg-black/80 text-[#E93D82] border border-[rgb(233_61_130/0.4)]
               transition-all duration-200 hover:bg-[rgb(233_61_130/0.2)] hover:border-[#E93D82]
               active:scale-95"
        :title="$t('camera.resetToDefaults')"
        @click="$emit('reset')"
      >&#8634;</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface DropdownOption {
  key: string
  value: number
}

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

const azimuthOptions: DropdownOption[] = [
  { key: 'frontView', value: 0 },
  { key: 'frontRightQuarterView', value: 45 },
  { key: 'rightSideView', value: 90 },
  { key: 'backRightQuarterView', value: 135 },
  { key: 'backView', value: 180 },
  { key: 'backLeftQuarterView', value: 225 },
  { key: 'leftSideView', value: 270 },
  { key: 'frontLeftQuarterView', value: 315 }
]

const elevationOptions: DropdownOption[] = [
  { key: 'lowAngleShot', value: -30 },
  { key: 'eyeLevelShot', value: 0 },
  { key: 'elevatedShot', value: 30 },
  { key: 'highAngleShot', value: 60 }
]

const distanceOptions: DropdownOption[] = [
  { key: 'wideShot', value: 1 },
  { key: 'mediumShot', value: 4 },
  { key: 'closeUp', value: 8 }
]

function findClosestOption(value: number, options: DropdownOption[], isAzimuth = false): number {
  let closest = options[0].value
  let minDiff = Math.abs(value - options[0].value)
  for (const opt of options) {
    let diff = Math.abs(value - opt.value)
    if (isAzimuth) {
      diff = Math.min(diff, Math.abs(value - opt.value - 360), Math.abs(value - opt.value + 360))
    }
    if (diff < minDiff) {
      minDiff = diff
      closest = opt.value
    }
  }
  return closest
}

function findClosestDistanceOption(dist: number): number {
  if (dist < 2) return 1
  if (dist < 6) return 4
  return 8
}

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

const DROPDOWN_BASE = 'ctv-camera-dropdown min-w-0 max-w-[90px] py-0.5 px-1 text-3xs cursor-pointer rounded outline-none backdrop-blur-sm'
  + ' bg-black/90 text-white/85 border border-white/20 hover:border-white/40'
const DROPDOWN_FOCUS = {
  azimuth:   'focus:border-[#E93D82]',
  elevation: 'focus:border-[#00FFD0]',
  distance:  'focus:border-[#FFB800]',
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
