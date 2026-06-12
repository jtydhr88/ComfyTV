<template>
  <SwitchRoot
    :model-value="modelValue ?? false"
    :disabled="disabled"
    class="ctv-toggle"
    @update:model-value="onChange"
  >
    <SwitchThumb class="ctv-toggle-thumb" />
  </SwitchRoot>
</template>

<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

defineProps<{
  modelValue: boolean | null
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()

function onChange(v: boolean) { emit('update:modelValue', !!v) }
</script>

<style>
.ctv-toggle {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  width: 32px;
  height: 18px;
  padding: 2px;
  border: none;
  border-radius: 9999px;
  background: var(--secondary-background, rgba(255,255,255,0.12));
  cursor: pointer;
  transition: background 0.15s ease;
}
.ctv-toggle[data-state='checked'] {
  background: var(--primary-background, rgba(78,168,255,0.6));
}
.ctv-toggle:disabled,
.ctv-toggle[data-disabled] {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
.ctv-toggle:focus-visible {
  outline: none;
  box-shadow: 0 0 0 1px var(--border-default, rgba(255,255,255,0.25));
}
.ctv-toggle-thumb {
  display: block;
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  background: #fff;
  transition: transform 0.15s ease;
  transform: translateX(0);
  will-change: transform;
  pointer-events: none;
}
.ctv-toggle[data-state='checked'] .ctv-toggle-thumb {
  transform: translateX(14px);
}
</style>
