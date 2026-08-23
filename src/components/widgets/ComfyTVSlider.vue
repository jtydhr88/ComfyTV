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
    <input
      v-if="!hideValue"
      type="number"
      class="ctv-slider-num"
      :min="min"
      :max="max"
      :step="step ?? 1"
      :value="display"
      :disabled="disabled"
      @change="onNumChange"
      @pointerdown.stop
    />
    <span v-if="unit" class="ctv-slider-unit">{{ unit }}</span>
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
  unit?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [v: number]; commit: [v: number] }>()

const clamped = computed(() => {
  const v = props.modelValue ?? props.min
  return Math.max(props.min, Math.min(props.max, v))
})

const display = computed(() => {
  const v = clamped.value
  if (props.precision !== undefined) return String(Number(v.toFixed(props.precision)))
  return String(v)
})

function onChange(arr: number[] | undefined) {
  const v = arr?.[0]
  if (typeof v === 'number' && Number.isFinite(v)) emit('update:modelValue', v)
}

function onNumChange(e: Event) {
  const el = e.target as HTMLInputElement
  const raw = Number(el.value)
  if (el.value.trim() !== '' && Number.isFinite(raw)) {
    let v = props.precision !== undefined ? Number(raw.toFixed(props.precision)) : raw
    v = Math.max(props.min, Math.min(props.max, v))
    emit('update:modelValue', v)
    emit('commit', v)
  }
  el.value = display.value
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
.ctv-slider-num {
  flex-shrink: 0;
  width: 44px;
  padding: 2px 4px;
  text-align: right;
  font-size: 11px;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  color: var(--base-foreground, #ddd);
  background: transparent;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
  border-radius: 6px;
  outline: none;
  appearance: textfield;
  -moz-appearance: textfield;
  box-sizing: border-box;
}
.ctv-slider-num::-webkit-inner-spin-button,
.ctv-slider-num::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.ctv-slider-num:focus { border-color: var(--primary-background, #4a8cff); }
.ctv-slider-num:disabled { opacity: 0.5; pointer-events: none; }
.ctv-slider-unit {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--muted-foreground, #888);
}
</style>
