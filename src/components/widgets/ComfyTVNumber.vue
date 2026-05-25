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
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 3px;
  padding: 4px 6px;
  color: var(--input-text, #ddd);
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  width: 100%;
  outline: none;
  text-align: left;
}
.ctv-num-root input:hover { border-color: rgba(255,255,255,0.25); }
.ctv-num-root input:focus { border-color: rgba(78,168,255,0.6); }
.ctv-num-root .p-inputnumber-button-group { display: none; }
</style>
