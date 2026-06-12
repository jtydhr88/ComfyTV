<template>
  <Textarea
    v-if="multiline"
    :model-value="modelValue ?? ''"
    :disabled="disabled"
    :rows="rows ?? 3"
    :placeholder="placeholder ?? ''"
    auto-resize
    :pt="{ root: { class: 'ctv-text-input ctv-text-area' } }"
    @update:model-value="onChange"
  />
  <InputText
    v-else
    :model-value="modelValue ?? ''"
    :disabled="disabled"
    :placeholder="placeholder ?? ''"
    :pt="{ root: { class: 'ctv-text-input' } }"
    @update:model-value="onChange"
  />
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Textarea  from 'primevue/textarea'

defineProps<{
  modelValue: string | null
  disabled?: boolean
  multiline?: boolean
  rows?: number
  placeholder?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [v: string] }>()

function onChange(v: string | undefined) { emit('update:modelValue', v ?? '') }
</script>

<style>
.ctv-text-input,
.ctv-text-input input,
.ctv-text-input textarea {
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
  box-sizing: border-box;
}
.ctv-text-input::placeholder,
.ctv-text-input input::placeholder,
.ctv-text-input textarea::placeholder { color: var(--muted-foreground, #888); }
.ctv-text-area textarea { line-height: 1.4; resize: vertical; min-height: 48px; }
.ctv-text-input:focus-visible,
.ctv-text-input input:focus-visible,
.ctv-text-input textarea:focus-visible {
  box-shadow: 0 0 0 1px var(--border-default, rgba(255,255,255,0.25));
}
.ctv-text-input:disabled,
.ctv-text-input input:disabled,
.ctv-text-input textarea:disabled { opacity: 0.5; pointer-events: none; }
</style>
