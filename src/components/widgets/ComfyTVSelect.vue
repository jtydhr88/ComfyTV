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
                class="flex w-full cursor-pointer items-center justify-between select-none
                       h-8 px-3 py-1 text-xs rounded-lg
                       bg-secondary-background text-base-foreground
                       transition-all duration-200 ease-in-out
                       hover:bg-secondary-background-hover
                       border-[2.5px] border-solid border-transparent
                       focus:border-node-component-border focus:outline-none
                       data-[state=open]:border-node-component-border
                       disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-secondary-background"
                :disabled="disabled"
                :aria-expanded="isOpen">
          <span class="truncate text-left">{{ display }}</span>
          <span class="shrink-0 text-muted-foreground text-2xs">▾</span>
        </button>
      </ComboboxTrigger>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        class="z-3000 overflow-hidden rounded-lg p-2 bg-base-background text-base-foreground
               border border-solid border-border-default shadow-md
               min-w-[var(--reka-combobox-trigger-width)] max-w-[360px]"
        position="popper"
        :side-offset="2"
        align="start"
      >
        <div v-if="filterable" class="px-1 pb-2">
          <ComboboxInput
            v-model="query"
            :placeholder="filterPlaceholder ?? 'Filter…'"
            auto-focus
            class="flex h-7 w-full min-w-0 appearance-none rounded-lg border-none
                   bg-secondary-background px-3 py-1 text-xs text-base-foreground
                   placeholder:text-muted-foreground
                   focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none"
          />
        </div>
        <div class="max-h-60 overflow-y-auto" role="presentation">
          <ComboboxItem
            v-for="opt in filteredOptions"
            :key="opt.value"
            :value="opt.value"
            :text-value="opt.label"
            class="relative flex w-full cursor-pointer items-center justify-between select-none
                   gap-3 rounded-sm px-2 py-2 text-xs outline-none
                   hover:bg-secondary-background-hover
                   data-[highlighted]:bg-secondary-background-hover
                   data-[state=checked]:bg-secondary-background-selected
                   data-[state=checked]:hover:bg-secondary-background-selected"
          >
            <span class="truncate">{{ opt.label }}</span>
            <ComboboxItemIndicator class="flex shrink-0 items-center justify-center text-base-foreground">✓</ComboboxItemIndicator>
          </ComboboxItem>
          <div v-if="!filteredOptions.length" class="px-3 pb-2 text-xs text-muted-foreground">
            no matches
          </div>
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
