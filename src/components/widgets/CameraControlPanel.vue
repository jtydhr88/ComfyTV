<template>
  <div class="control-panel">
    <div class="info-row">
      <div class="control">
        <span class="dropdown-label azimuth">{{ $t('camera.horizontal') }}</span>
        <select
          class="dropdown azimuth"
          :value="closestAzimuth"
          @change="onAzimuthSelect"
        >
          <option
            v-for="opt in azimuthOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ $t(`camera.azimuth.${opt.key}`) }}
          </option>
        </select>
      </div>
      <div class="control">
        <span class="dropdown-label elevation">{{ $t('camera.vertical') }}</span>
        <select
          class="dropdown elevation"
          :value="closestElevation"
          @change="onElevationSelect"
        >
          <option
            v-for="opt in elevationOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ $t(`camera.elevation.${opt.key}`) }}
          </option>
        </select>
      </div>
      <div class="control">
        <span class="dropdown-label distance">{{ $t('camera.zoom') }}</span>
        <select
          class="dropdown distance"
          :value="closestDistance"
          @change="onDistanceSelect"
        >
          <option
            v-for="opt in distanceOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ $t(`camera.distance.${opt.key}`) }}
          </option>
        </select>
      </div>
    </div>
    <div class="info-row">
      <div class="param">
        <div class="param-value azimuth">{{ Math.round(azimuth) }}&deg;</div>
      </div>
      <div class="param">
        <div class="param-value elevation">{{ Math.round(elevation) }}&deg;</div>
      </div>
      <div class="param">
        <div class="param-value distance">{{ distance.toFixed(1) }}</div>
      </div>
      <button
        class="reset-btn"
        :title="$t('camera.resetToDefaults')"
        @click="$emit('reset')"
      >
        &#8634;
      </button>
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
</script>

<style scoped>
.control-panel {
  position: absolute;
  bottom: 8px;
  left: 8px;
  right: 8px;
  background: rgba(10, 10, 15, 0.9);
  border: 1px solid rgba(233, 61, 130, 0.3);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 11px;
  color: #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  backdrop-filter: blur(4px);
  z-index: 10;
}

.info-row {
  display: flex;
  justify-content: space-around;
  align-items: center;
}

.control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.param {
  text-align: center;
}

.param-value {
  font-weight: 600;
  font-size: 13px;
}

.param-value.azimuth {
  color: #E93D82;
}

.param-value.elevation {
  color: #00FFD0;
}

.param-value.distance {
  color: #FFB800;
}

.dropdown-label {
  font-size: 9px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.dropdown-label.azimuth {
  color: #E93D82;
}

.dropdown-label.elevation {
  color: #00FFD0;
}

.dropdown-label.distance {
  color: #FFB800;
}

.dropdown {
  background: rgba(10, 10, 15, 0.9);
  border: 1px solid rgba(100, 100, 120, 0.4);
  border-radius: 4px;
  padding: 2px 4px;
  font-size: 9px;
  color: #e0e0e0;
  cursor: pointer;
  outline: none;
  min-width: 0;
  max-width: 90px;
  backdrop-filter: blur(4px);
}

.dropdown:hover {
  border-color: rgba(150, 150, 170, 0.6);
}

.dropdown:focus {
  border-color: #E93D82;
}

.dropdown.azimuth:focus {
  border-color: #E93D82;
}

.dropdown.elevation:focus {
  border-color: #00FFD0;
}

.dropdown.distance:focus {
  border-color: #FFB800;
}

.dropdown option {
  background: #1a1a2e;
  color: #e0e0e0;
}

.reset-btn {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid rgba(233, 61, 130, 0.4);
  background: rgba(10, 10, 15, 0.8);
  color: #E93D82;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.reset-btn:hover {
  background: rgba(233, 61, 130, 0.2);
  border-color: #E93D82;
}

.reset-btn:active {
  transform: scale(0.95);
}
</style>
