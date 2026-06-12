<template>
  <ToggleSwitch
    :model-value="modelValue ?? false"
    :disabled="disabled"
    :pt="{ root: { class: 'ctv-toggle' } }"
    @update:model-value="onChange"
  />
</template>

<script setup lang="ts">
import ToggleSwitch from 'primevue/toggleswitch'

defineProps<{
  modelValue: boolean | null
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()

function onChange(v: boolean) { emit('update:modelValue', !!v) }
</script>

<style>
.ctv-toggle {
  --p-toggleswitch-width: 32px;
  --p-toggleswitch-height: 18px;
}
.ctv-toggle .p-toggleswitch-slider {
  background: var(--secondary-background, rgba(255,255,255,0.12));
  border: none;
}
.ctv-toggle.p-toggleswitch-checked .p-toggleswitch-slider {
  background: var(--primary-background, rgba(78,168,255,0.6));
}
</style>
