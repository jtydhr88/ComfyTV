<template>
  <div class="ctv-slider-row">
    <SliderRoot
      class="ctv-slider-root"
      :model-value="[clamped]"
      :min="min"
      :max="max"
      :step="step ?? 1"
      :disabled="disabled"
      @update:model-value="onChange"
      @value-commit="onCommit"
    >
      <SliderTrack class="ctv-slider-track">
        <SliderRange class="ctv-slider-range" />
      </SliderTrack>
      <SliderThumb class="ctv-slider-thumb" />
    </SliderRoot>
    <span v-if="!hideValue" class="ctv-slider-value">{{ display }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from 'reka-ui'

const props = defineProps<{
  modelValue: number | null
  min: number
  max: number
  step?: number
  precision?: number
  disabled?: boolean
  hideValue?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [v: number]; commit: [v: number] }>()

const clamped = computed(() => {
  const v = props.modelValue ?? props.min
  return Math.max(props.min, Math.min(props.max, v))
})

const display = computed(() => {
  const v = clamped.value
  return props.precision === 0 ? String(Math.round(v)) : String(v)
})

function onChange(arr: number[] | undefined) {
  const v = arr?.[0]
  if (typeof v === 'number' && Number.isFinite(v)) emit('update:modelValue', v)
}

function onCommit(arr: number[] | undefined) {
  const v = arr?.[0]
  if (typeof v === 'number' && Number.isFinite(v)) emit('commit', v)
}
</script>

<style>
.ctv-slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}
.ctv-slider-root {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  height: 18px;
  user-select: none;
  touch-action: none;
}
.ctv-slider-track {
  position: relative;
  flex: 1;
  height: 4px;
  border-radius: 9999px;
  background: var(--secondary-background, rgba(255, 255, 255, 0.12));
}
.ctv-slider-range {
  position: absolute;
  height: 100%;
  border-radius: 9999px;
  background: var(--primary-background, #4a8cff);
}
.ctv-slider-thumb {
  display: block;
  width: 12px;
  height: 12px;
  border-radius: 9999px;
  background: var(--base-foreground, #eee);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.4);
  cursor: grab;
}
.ctv-slider-thumb:active { cursor: grabbing; }
.ctv-slider-thumb[data-disabled] { opacity: 0.5; pointer-events: none; }
.ctv-slider-value {
  flex-shrink: 0;
  min-width: 32px;
  text-align: right;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--base-foreground, #ddd);
}
</style>
