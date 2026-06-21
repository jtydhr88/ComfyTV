<template>
  <form class="ctv:flex ctv:flex-col ctv:gap-3" @submit.prevent="confirm">
    <label v-if="label" class="ctv:text-xs ctv:text-muted-foreground">{{ label }}</label>
    <input
      ref="inputEl"
      v-model="value"
      type="text"
      :placeholder="placeholder"
      class="ctv:appearance-none ctv:[font-family:inherit] ctv:focus-visible:outline-none
             ctv:w-full ctv:h-8 ctv:px-2.5 ctv:rounded-sm ctv:text-sm
             ctv:bg-secondary-background ctv:text-base-foreground
             ctv:border ctv:border-border-subtle ctv:focus:border-primary-background"
      @keydown.esc.prevent="cancel"
    />
    <div class="ctv:flex ctv:justify-end ctv:gap-2">
      <button type="button" :class="btnGhost" @click="cancel">
        {{ cancelText || $t('dialog.cancel') }}
      </button>
      <button type="submit" :class="btnPrimary" :disabled="!value.trim()">
        {{ confirmText || $t('dialog.confirm') }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  label?: string
  initialValue?: string
  placeholder?: string
  confirmText?: string
  cancelText?: string
  onResolve: (value: string | null) => void
}>()

const value = ref(props.initialValue ?? '')
const inputEl = ref<HTMLInputElement | null>(null)

let resolved = false
function settle(v: string | null) {
  if (resolved) return
  resolved = true
  props.onResolve(v)
}

function confirm() {
  const v = value.value.trim()
  if (!v) return
  settle(v)
}
function cancel() {
  settle(null)
}

onMounted(() => {
  inputEl.value?.focus()
  inputEl.value?.select()
})
onBeforeUnmount(() => settle(null))

const btnGhost = 'ctv:appearance-none ctv:border-none ctv:cursor-pointer ctv:[font-family:inherit] ' +
  'ctv:focus-visible:outline-none ctv:h-7 ctv:px-3 ctv:rounded-sm ctv:text-xs ' +
  'ctv:bg-secondary-background ctv:text-muted-foreground ' +
  'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground'
const btnPrimary = 'ctv:appearance-none ctv:border-none ctv:cursor-pointer ctv:[font-family:inherit] ' +
  'ctv:focus-visible:outline-none ctv:h-7 ctv:px-3 ctv:rounded-sm ctv:text-xs ctv:font-medium ' +
  'ctv:bg-primary-background ctv:text-primary-foreground ' +
  'ctv:hover:opacity-90 ctv:disabled:opacity-50 ctv:disabled:pointer-events-none'
</script>
