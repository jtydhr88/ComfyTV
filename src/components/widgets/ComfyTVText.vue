<template>
  <textarea
    v-if="multiline"
    ref="textareaEl"
    class="ctv-text-input ctv-text-area"
    :value="modelValue ?? ''"
    :disabled="disabled"
    :rows="rows ?? 3"
    :placeholder="placeholder ?? ''"
    @input="onTextareaInput"
  />
  <input
    v-else
    class="ctv-text-input"
    type="text"
    :value="modelValue ?? ''"
    :disabled="disabled"
    :placeholder="placeholder ?? ''"
    @input="onInput"
  />
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: string | null
  disabled?: boolean
  multiline?: boolean
  rows?: number
  placeholder?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [v: string] }>()

const textareaEl = ref<HTMLTextAreaElement | null>(null)

function resize() {
  const el = textareaEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}

function onTextareaInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
  resize()
}

onMounted(() => { if (props.multiline) nextTick(resize) })
watch(() => props.modelValue, () => { if (props.multiline) nextTick(resize) })
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
  font-family: inherit;
  width: 100%;
  min-width: 0;
  outline: none;
  box-sizing: border-box;
}
.ctv-text-input::placeholder,
.ctv-text-input input::placeholder,
.ctv-text-input textarea::placeholder { color: var(--muted-foreground, #888); }
.ctv-text-area { line-height: 1.4; resize: vertical; min-height: 48px; overflow: hidden; }
.ctv-text-input:focus-visible,
.ctv-text-input input:focus-visible,
.ctv-text-input textarea:focus-visible {
  box-shadow: 0 0 0 1px var(--border-default, rgba(255,255,255,0.25));
}
.ctv-text-input:disabled,
.ctv-text-input input:disabled,
.ctv-text-input textarea:disabled { opacity: 0.5; pointer-events: none; }
</style>
