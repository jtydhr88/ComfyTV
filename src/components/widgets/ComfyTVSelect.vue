<template>
  <ComboboxRoot
    v-model:open="isOpen"
    :model-value="modelValue"
    :disabled="disabled"
    selection-behavior="replace"
    @update:model-value="onPick"
  >
    <ComboboxAnchor as-child>
      <ComboboxTrigger as-child>
        <button type="button"
                class="ctv-sel-trigger"
                :disabled="disabled"
                :aria-expanded="isOpen">
          <span class="ctv-sel-val">{{ display }}</span>
          <span class="ctv-sel-caret">▾</span>
        </button>
      </ComboboxTrigger>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent class="ctv-sel-content" position="popper" :side-offset="2" align="start">
        <div v-if="filterable" class="ctv-sel-search">
          <ComboboxInput v-model="query"
                         :placeholder="filterPlaceholder ?? 'Filter…'"
                         auto-focus
                         class="ctv-sel-search-input" />
        </div>
        <div class="ctv-sel-list" role="presentation">
          <ComboboxItem v-for="opt in filteredOptions"
                        :key="opt.value"
                        :value="opt.value"
                        :text-value="opt.label"
                        class="ctv-sel-item">
            <span class="ctv-sel-item-lbl">{{ opt.label }}</span>
            <ComboboxItemIndicator class="ctv-sel-check">✓</ComboboxItemIndicator>
          </ComboboxItem>
          <div v-if="!filteredOptions.length" class="ctv-sel-empty">no matches</div>
        </div>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
} from 'reka-ui'

interface Option { value: string; label: string }

const props = defineProps<{
  modelValue: string | number | null
  options:    Array<string | Option>
  disabled?:  boolean
  filterable?: boolean
  filterPlaceholder?: string
  placeholder?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [v: string | number] }>()

const isOpen = ref(false)
const query  = ref('')

const normalised = computed<Option[]>(() =>
  (props.options ?? []).map(o =>
    typeof o === 'string' ? { value: o, label: o } : o
  )
)

const filterable = computed(() =>
  props.filterable !== undefined ? props.filterable : normalised.value.length >= 10
)

const filteredOptions = computed(() => {
  if (!query.value.trim()) return normalised.value
  const q = query.value.toLowerCase()
  return normalised.value.filter(o => o.label.toLowerCase().includes(q))
})

const display = computed(() => {
  const v = props.modelValue
  if (v === null || v === undefined || v === '') return props.placeholder ?? '—'
  const hit = normalised.value.find(o => o.value === String(v))
  return hit?.label ?? String(v)
})

function onPick(v: any) {
  if (v === undefined || v === null) return
  emit('update:modelValue', v as string)
  isOpen.value = false
  query.value = ''
}
</script>

<style scoped>
.ctv-sel-trigger {
  display: flex; align-items: center; gap: 6px;
  width: 100%;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 3px;
  padding: 4px 8px;
  color: var(--input-text, #ddd);
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  cursor: pointer;
  outline: none;
  text-align: left;
}
.ctv-sel-trigger:hover:not(:disabled) { border-color: rgba(255,255,255,0.25); }
.ctv-sel-trigger[aria-expanded='true'] { border-color: rgba(78,168,255,0.6); }
.ctv-sel-trigger:disabled { opacity: 0.5; cursor: default; }
.ctv-sel-val { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ctv-sel-caret { color: rgba(255,255,255,0.55); font-size: 10px; }
</style>

<style>
.ctv-sel-content {
  background: #1a1a1f;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 4px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.4);
  z-index: 3000;
  min-width: var(--reka-combobox-trigger-width);
  max-width: 360px;
  padding: 4px;
  font-size: 11px;
  color: #ddd;
  font-family: ui-monospace, SFMono-Regular, monospace;
}
.ctv-sel-search {
  padding: 2px 4px 6px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 4px;
}
.ctv-sel-search-input {
  width: 100%;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 3px;
  padding: 3px 6px;
  color: #ddd;
  font: inherit;
  outline: none;
}
.ctv-sel-search-input:focus { border-color: rgba(78,168,255,0.6); }
.ctv-sel-list { max-height: 240px; overflow-y: auto; }
.ctv-sel-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 6px;
  border-radius: 2px;
  cursor: pointer;
  user-select: none;
  gap: 6px;
}
.ctv-sel-item[data-highlighted] { background: rgba(78,168,255,0.18); }
.ctv-sel-item[data-state='checked'] { color: #b5e3a5; }
.ctv-sel-item-lbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ctv-sel-check { color: #b5e3a5; font-weight: bold; }
.ctv-sel-empty { padding: 6px; color: rgba(255,255,255,0.45); text-align: center; font-style: italic; }
</style>
