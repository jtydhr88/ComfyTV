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
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 3px;
  padding: 4px 6px;
  color: var(--input-text, #ddd);
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  width: 100%;
  outline: none;
  box-sizing: border-box;
}
.ctv-text-area textarea { line-height: 1.4; resize: vertical; min-height: 48px; }
.ctv-text-input input:hover, .ctv-text-input textarea:hover {
  border-color: rgba(255,255,255,0.25);
}
.ctv-text-input input:focus, .ctv-text-input textarea:focus {
  border-color: rgba(78,168,255,0.6);
}
</style>
