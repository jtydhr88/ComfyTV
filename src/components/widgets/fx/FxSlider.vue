<template>
  <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-[11px]">
    <span class="ctv:min-w-16 ctv:shrink-0 ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground ctv:truncate"
          :title="label">{{ label }}</span>
    <input
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

const props = withDefaults(defineProps<{
  modelValue: number
  label: string
  min: number
  max: number
  step?: number
  unit?: string
  resetTo?: number
  decimals?: number
}>(), { step: 0.01, unit: '', decimals: 2 })

const emit = defineEmits<{ 'update:modelValue': [v: number] }>()

const display = computed(() => {
  const d = props.decimals
  return Number(props.modelValue.toFixed(d))
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
</style>
