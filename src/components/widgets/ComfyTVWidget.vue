<template>
  <ComfyTVSelect
    v-if="kind === 'COMBO'"
    :model-value="modelValue"
    :options="options ?? []"
    :disabled="disabled"
    :placeholder="placeholder"
    @update:model-value="emit('update:modelValue', $event)"
  />

  <ComfyTVNumber
    v-else-if="kind === 'INT' || kind === 'FLOAT'"
    :model-value="numericValue"
    :disabled="disabled"
    :min="min"
    :max="max"
    :step="step ?? (kind === 'INT' ? 1 : 0.01)"
    :precision="kind === 'INT' ? 0 : precision"
    @update:model-value="emit('update:modelValue', $event)"
  />

  <ComfyTVToggle
    v-else-if="kind === 'BOOLEAN'"
    :model-value="boolValue"
    :disabled="disabled"
    @update:model-value="emit('update:modelValue', $event)"
  />

  <ComfyTVText
    v-else-if="kind === 'STRING'"
    :model-value="stringValue"
    :disabled="disabled"
    :multiline="multiline"
    :placeholder="placeholder"
    @update:model-value="emit('update:modelValue', $event)"
  />

  <input v-else
         class="w-full py-1 px-1.5 rounded-sm text-2xs font-mono
                bg-base-foreground/[0.03] border border-dashed border-warning-background/50
                text-warning-background cursor-not-allowed"
         :value="String(modelValue ?? '')"
         readonly
         :title="`Unsupported widget type: ${kind}`" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import ComfyTVSelect from './ComfyTVSelect.vue'
import ComfyTVNumber from './ComfyTVNumber.vue'
import ComfyTVToggle from './ComfyTVToggle.vue'
import ComfyTVText   from './ComfyTVText.vue'

interface Props {
  kind: string
  modelValue: any
  disabled?: boolean
  options?:   any[]
  min?:       number
  max?:       number
  step?:      number
  precision?: number
  multiline?: boolean
  placeholder?: string
}
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [v: any] }>()

const numericValue = computed<number | null>(() => {
  const v = props.modelValue
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
})

const boolValue = computed<boolean>(() => !!props.modelValue)

const stringValue = computed<string>(() =>
  props.modelValue == null ? '' : String(props.modelValue)
)

const multiline = computed(() =>
  props.multiline === true || stringValue.value.includes('\n')
)
</script>
