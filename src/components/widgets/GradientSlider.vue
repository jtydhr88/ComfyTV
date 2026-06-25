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
    <span class="ctv-gradient-value">{{ display }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
import type { ColorStop } from '@/components/widgets/colorStops'

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

const display = computed(() =>
  props.precision === 0 ? String(Math.round(clamped.value)) : String(clamped.value)
)

function stopsToGradient(stops: ColorStop[]): string {
  if (!stops.length) return 'transparent'
  const colors = stops.map(
    ({ offset, color: [r, g, b] }) => `rgb(${r},${g},${b}) ${offset * 100}%`
  )
  return `linear-gradient(to right, ${colors.join(', ')})`
}

function interpolateStops(stops: ColorStop[], t: number): string {
  if (!stops.length) return 'transparent'
  const c = Math.max(0, Math.min(1, t))
  if (c <= stops[0].offset) {
    const [r, g, b] = stops[0].color
    return `rgb(${r},${g},${b})`
  }
  for (let i = 0; i < stops.length - 1; i++) {
    const { offset: o1, color: [r1, g1, b1] } = stops[i]
    const { offset: o2, color: [r2, g2, b2] } = stops[i + 1]
    if (c >= o1 && c <= o2) {
      const f = o2 === o1 ? 0 : (c - o1) / (o2 - o1)
      return `rgb(${Math.round(r1 + (r2 - r1) * f)},${Math.round(g1 + (g2 - g1) * f)},${Math.round(b1 + (b2 - b1) * f)})`
    }
  }
  const [r, g, b] = stops[stops.length - 1].color
  return `rgb(${r},${g},${b})`
}

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
.ctv-gradient-value {
  flex-shrink: 0;
  min-width: 32px;
  text-align: right;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--base-foreground, #ddd);
}
</style>
