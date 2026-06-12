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
                class="ctv:flex ctv:w-full ctv:cursor-pointer ctv:items-center ctv:justify-between ctv:select-none
                       ctv:h-8 ctv:px-3 ctv:py-1 ctv:text-xs ctv:rounded-lg
                       ctv:bg-secondary-background ctv:text-base-foreground
                       ctv:transition-all ctv:duration-200 ctv:ease-in-out
                       ctv:hover:bg-secondary-background-hover
                       ctv:border-[2.5px] ctv:border-solid ctv:border-transparent
                       ctv:focus:border-node-component-border ctv:focus:outline-none
                       ctv:data-[state=open]:border-node-component-border
                       ctv:disabled:cursor-not-allowed ctv:disabled:opacity-30 ctv:disabled:hover:bg-secondary-background"
                :disabled="disabled"
                :aria-expanded="isOpen">
          <span class="ctv:truncate ctv:text-left">{{ display }}</span>
          <span class="ctv:shrink-0 ctv:text-muted-foreground ctv:text-2xs">▾</span>
        </button>
      </ComboboxTrigger>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        class="ctv:z-3000 ctv:overflow-hidden ctv:rounded-lg ctv:p-2 ctv:bg-base-background ctv:text-base-foreground
               ctv:border ctv:border-solid ctv:border-border-default ctv:shadow-md
               ctv:min-w-[var(--reka-combobox-trigger-width)] ctv:max-w-[360px]"
        position="popper"
        :side-offset="2"
        align="start"
      >
        <div v-if="filterable" class="ctv:px-1 ctv:pb-2">
          <ComboboxInput
            v-model="query"
            :placeholder="filterPlaceholder ?? 'Filter…'"
            auto-focus
            class="ctv:flex ctv:h-7 ctv:w-full ctv:min-w-0 ctv:appearance-none ctv:rounded-lg ctv:border-none
                   ctv:bg-secondary-background ctv:px-3 ctv:py-1 ctv:text-xs ctv:text-base-foreground
                   ctv:placeholder:text-muted-foreground
                   ctv:focus-visible:ring-1 ctv:focus-visible:ring-border-default ctv:focus-visible:outline-none"
          />
        </div>
        <div class="ctv:max-h-60 ctv:overflow-y-auto" role="presentation">
          <ComboboxItem
            v-for="opt in filteredOptions"
            :key="opt.value"
            :value="opt.value"
            :text-value="opt.label"
            class="ctv:relative ctv:flex ctv:w-full ctv:cursor-pointer ctv:items-center ctv:justify-between ctv:select-none
                   ctv:gap-3 ctv:rounded-sm ctv:px-2 ctv:py-2 ctv:text-xs ctv:outline-none
                   ctv:hover:bg-secondary-background-hover
                   ctv:data-[highlighted]:bg-secondary-background-hover
                   ctv:data-[state=checked]:bg-secondary-background-selected
                   ctv:data-[state=checked]:hover:bg-secondary-background-selected"
          >
            <span class="ctv:truncate">{{ opt.label }}</span>
            <ComboboxItemIndicator class="ctv:flex ctv:shrink-0 ctv:items-center ctv:justify-center ctv:text-base-foreground">✓</ComboboxItemIndicator>
          </ComboboxItem>
          <div v-if="!filteredOptions.length" class="ctv:px-3 ctv:pb-2 ctv:text-xs ctv:text-muted-foreground">
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
