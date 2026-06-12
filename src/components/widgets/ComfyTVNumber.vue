<template>
  <InputNumber
    :model-value="modelValue"
    :disabled="disabled"
    :min="min"
    :max="max"
    :step="step"
    :max-fraction-digits="precision"
    :show-buttons="showButtons"
    button-layout="horizontal"
    :pt="primevuePt"
    fluid
    @update:model-value="onChange"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import InputNumber from 'primevue/inputnumber'

const props = defineProps<{
  modelValue: number | null
  disabled?: boolean
  min?:  number
  max?:  number
  step?: number
  precision?: number
  showButtons?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [v: number | null] }>()

const showButtons = computed(() =>
  props.showButtons !== undefined
    ? props.showButtons
    : (props.precision === 0)
)

const primevuePt = {
  root:  { class: 'ctv-num-root' },
  pcInput: { root: { class: 'ctv-num-input' } },
}

function onChange(v: number | null) { emit('update:modelValue', v) }
</script>

<style>
.ctv-num-root .ctv-num-input,
.ctv-num-root input {
  appearance: none;
  background: var(--secondary-background, rgba(255,255,255,0.04));
  border: none;
  border-radius: 8px;
  padding: 6px 12px;
  color: var(--base-foreground, #ddd);
  font-size: 12px;
  width: 100%;
  min-width: 0;
  outline: none;
  text-align: left;
  box-sizing: border-box;
}
.ctv-num-root input::placeholder { color: var(--muted-foreground, #888); }
.ctv-num-root input:focus-visible {
  box-shadow: 0 0 0 1px var(--border-default, rgba(255,255,255,0.25));
}
.ctv-num-root input:disabled { opacity: 0.5; pointer-events: none; }
.ctv-num-root .p-inputnumber-button-group { display: none; }
</style>
