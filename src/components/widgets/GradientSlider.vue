<template>
  <div class="ctv-gradient-row">
    <SliderRoot
      class="ctv-gradient-root"
      :model-value="[clamped]"
      :min="min"
      :max="max"
      :step="step ?? 1"
      :disabled="disabled"
      @update:model-value="onChange"
      @value-commit="onCommit"
    >
      <SliderTrack class="ctv-gradient-track" :style="{ background: gradient }" />
      <SliderThumb
        class="ctv-gradient-thumb"
        :style="{ backgroundColor: thumbColor }"
        :aria-label="ariaLabel"
      />
    </SliderRoot>
    <input
      type="number"
      class="ctv-gradient-num"
      :min="min"
      :max="max"
      :step="step ?? 1"
      :value="display"
      :disabled="disabled"
      @change="onNumChange"
      @pointerdown.stop
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
import {
  interpolateStops,
  stopsToGradient,
  type ColorStop,
} from '@/components/widgets/colorStops'

const props = defineProps<{
  modelValue: number | null
  stops: ColorStop[]
  min?: number
  max?: number
  step?: number
  precision?: number
  disabled?: boolean
  ariaLabel?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [v: number]; commit: [v: number] }>()

const min = computed(() => props.min ?? 0)
const max = computed(() => props.max ?? 100)

const clamped = computed(() => {
  const v = props.modelValue ?? min.value
  return Math.max(min.value, Math.min(max.value, v))
})

const display = computed(() => {
  const v = clamped.value
  if (props.precision !== undefined) return String(Number(v.toFixed(props.precision)))
  return String(v)
})

const gradient = computed(() => stopsToGradient(props.stops))
const thumbColor = computed(() => {
  const t = max.value === min.value ? 0 : (clamped.value - min.value) / (max.value - min.value)
  return interpolateStops(props.stops, t)
})

function onChange(arr: number[] | undefined) {
  const v = arr?.[0]
  if (typeof v === 'number' && Number.isFinite(v)) emit('update:modelValue', v)
}

function onCommit(arr: number[] | undefined) {
  const v = arr?.[0]
  if (typeof v === 'number' && Number.isFinite(v)) emit('commit', v)
}

function onNumChange(e: Event) {
  const el = e.target as HTMLInputElement
  const raw = Number(el.value)
  if (el.value.trim() !== '' && Number.isFinite(raw)) {
    let v = props.precision !== undefined ? Number(raw.toFixed(props.precision)) : raw
    v = Math.max(min.value, Math.min(max.value, v))
    emit('update:modelValue', v)
    emit('commit', v)
  }
  el.value = display.value
}
</script>

<style scoped>
.ctv-gradient-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}
.ctv-gradient-root {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  height: 18px;
  user-select: none;
  touch-action: none;
}
.ctv-gradient-track {
  position: relative;
  flex: 1;
  height: 10px;
  border-radius: 9999px;
  cursor: pointer;
}
.ctv-gradient-thumb {
  display: block;
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  outline: 1px solid rgba(0, 0, 0, 0.35);
  cursor: grab;
}
.ctv-gradient-thumb:active {
  cursor: grabbing;
}
.ctv-gradient-thumb[data-disabled] {
  opacity: 0.5;
  pointer-events: none;
}
.ctv-gradient-num {
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
.ctv-gradient-num::-webkit-inner-spin-button,
.ctv-gradient-num::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.ctv-gradient-num:focus { border-color: var(--primary-background, #4a8cff); }
.ctv-gradient-num:disabled { opacity: 0.5; pointer-events: none; }
</style>
