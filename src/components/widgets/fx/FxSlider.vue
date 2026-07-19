<template>
  <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-[11px]">
    <span class="ctv:min-w-16 ctv:shrink-0 ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground ctv:truncate"
          :title="label">{{ label }}</span>

    <div v-if="gradient && gradient.length" class="ctv-fx-gradwrap ctv:flex-1">
      <div class="ctv-fx-gradbar" :style="{ background: gradientCss }" />
      <input
        type="range" :min="min" :max="max" :step="step"
        class="ctv-fx-range--grad ctv:cursor-pointer"
        :style="{ '--thumb-color': thumbColor }"
        :value="modelValue"
        @input="onInput"
        @dblclick="reset"
      />
    </div>
    <input
      v-else
      type="range" :min="min" :max="max" :step="step"
      class="ctv:flex-1 ctv:accent-primary-background ctv:cursor-pointer"
      :value="modelValue"
      @input="onInput"
      @dblclick="reset"
    />

    <input
      type="number" :min="min" :max="max" :step="step"
      class="ctv-fx-num ctv:w-14 ctv:py-0.5 ctv:px-1 ctv:text-right ctv:text-[11px] ctv:font-mono ctv:rounded
             ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground"
      :value="display"
      @change="onNum"
    />
    <span v-if="unit" class="ctv:shrink-0 ctv:w-4 ctv:text-2xs ctv:text-muted-foreground">{{ unit }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  interpolateStops,
  stopsToGradient,
  type ColorStop,
} from '@/components/widgets/colorStops'

const props = withDefaults(defineProps<{
  modelValue: number
  label: string
  min: number
  max: number
  step?: number
  unit?: string
  resetTo?: number
  decimals?: number
  gradient?: ColorStop[]
}>(), { step: 0.01, unit: '', decimals: 2 })

const emit = defineEmits<{ 'update:modelValue': [v: number] }>()

const display = computed(() => {
  const d = props.decimals
  return Number(props.modelValue.toFixed(d))
})

const gradientCss = computed(() =>
  props.gradient ? stopsToGradient(props.gradient) : 'transparent'
)
const thumbColor = computed(() => {
  if (!props.gradient) return '#fff'
  const t = props.max === props.min ? 0 : (props.modelValue - props.min) / (props.max - props.min)
  return interpolateStops(props.gradient, t)
})

function clamp(v: number) {
  return Math.min(props.max, Math.max(props.min, v))
}
function onInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  if (Number.isFinite(v)) emit('update:modelValue', clamp(v))
}
function onNum(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  if (Number.isFinite(v)) emit('update:modelValue', clamp(v))
}
function reset() {
  if (props.resetTo !== undefined) emit('update:modelValue', props.resetTo)
}
</script>

<style scoped>
.ctv-fx-num { -moz-appearance: textfield; }
.ctv-fx-num::-webkit-inner-spin-button,
.ctv-fx-num::-webkit-outer-spin-button { -webkit-appearance: none; }

.ctv-fx-gradwrap {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
}
.ctv-fx-gradbar {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  height: 8px;
  border-radius: 9999px;
  pointer-events: none;
}
.ctv-fx-range--grad {
  position: relative;
  width: 100%;
  height: 16px;
  margin: 0;
  background: transparent;
  -webkit-appearance: none;
  appearance: none;
}
.ctv-fx-range--grad::-webkit-slider-runnable-track {
  height: 8px;
  background: transparent;
}
.ctv-fx-range--grad::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  background: var(--thumb-color, #fff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  outline: 1px solid rgba(0, 0, 0, 0.35);
  margin-top: -3px;
  cursor: grab;
}
.ctv-fx-range--grad::-moz-range-track {
  height: 8px;
  background: transparent;
}
.ctv-fx-range--grad::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: none;
  border-radius: 9999px;
  background: var(--thumb-color, #fff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  cursor: grab;
}
.ctv-fx-range--grad:active::-webkit-slider-thumb { cursor: grabbing; }
</style>
