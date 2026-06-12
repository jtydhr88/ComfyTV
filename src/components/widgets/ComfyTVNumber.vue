<template>
  <NumberFieldRoot
    class="ctv-num-root"
    :model-value="modelValue ?? undefined"
    :disabled="disabled"
    :min="min"
    :max="max"
    :step="step ?? 1"
    :format-options="formatOptions"
    @update:model-value="onChange"
  >
    <NumberFieldDecrement v-if="showButtons" class="ctv-num-btn">−</NumberFieldDecrement>
    <NumberFieldInput class="ctv-num-input" />
    <NumberFieldIncrement v-if="showButtons" class="ctv-num-btn">+</NumberFieldIncrement>
  </NumberFieldRoot>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  NumberFieldRoot,
  NumberFieldInput,
  NumberFieldIncrement,
  NumberFieldDecrement,
} from 'reka-ui'

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

const formatOptions = computed<Intl.NumberFormatOptions | undefined>(() =>
  props.precision !== undefined
    ? { maximumFractionDigits: props.precision }
    : undefined
)

// reka-ui emits NaN when the field is cleared; normalise to null.
function onChange(v: number) {
  emit('update:modelValue', Number.isFinite(v) ? v : null)
}
</script>

<style>
.ctv-num-root {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  background: var(--secondary-background, rgba(255,255,255,0.04));
  border-radius: 8px;
  box-sizing: border-box;
}
.ctv-num-root .ctv-num-input,
.ctv-num-root input {
  appearance: none;
  background: transparent;
  border: none;
  border-radius: 8px;
  padding: 6px 12px;
  color: var(--base-foreground, #ddd);
  font-size: 12px;
  font-family: inherit;
  width: 100%;
  min-width: 0;
  flex: 1;
  outline: none;
  text-align: left;
  box-sizing: border-box;
}
.ctv-num-root input::placeholder { color: var(--muted-foreground, #888); }
.ctv-num-root:focus-within {
  box-shadow: 0 0 0 1px var(--border-default, rgba(255,255,255,0.25));
}
.ctv-num-root input:disabled { opacity: 0.5; pointer-events: none; }
.ctv-num-btn {
  flex-shrink: 0;
  appearance: none;
  background: transparent;
  border: none;
  color: var(--muted-foreground, #888);
  font-size: 13px;
  line-height: 1;
  width: 22px;
  height: 100%;
  min-height: 28px;
  cursor: pointer;
  user-select: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.ctv-num-btn:hover { color: var(--base-foreground, #ddd); }
.ctv-num-btn[data-disabled] { opacity: 0.4; pointer-events: none; }
</style>
