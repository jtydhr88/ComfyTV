<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-3">
    <p class="ctv:m-0 ctv:text-xs ctv:leading-relaxed ctv:text-base-foreground ctv:whitespace-pre-wrap">{{ message }}</p>
    <div class="ctv:flex ctv:justify-end ctv:gap-2">
      <button type="button" :class="btnGhost" @click="resolve(false)">
        {{ cancelText || $t('dialog.cancel') }}
      </button>
      <button type="button" :class="danger ? btnDanger : btnPrimary" @click="resolve(true)">
        {{ confirmText || $t('dialog.confirm') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue'

const props = defineProps<{
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onResolve: (value: boolean) => void
}>()

let resolved = false
function resolve(value: boolean) {
  if (resolved) return
  resolved = true
  props.onResolve(value)
}

onBeforeUnmount(() => resolve(false))

const btnGhost = 'ctv:appearance-none ctv:border-none ctv:cursor-pointer ctv:[font-family:inherit] ' +
  'ctv:focus-visible:outline-none ctv:h-7 ctv:px-3 ctv:rounded-sm ctv:text-xs ' +
  'ctv:bg-secondary-background ctv:text-muted-foreground ' +
  'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground'
const btnPrimary = 'ctv:appearance-none ctv:border-none ctv:cursor-pointer ctv:[font-family:inherit] ' +
  'ctv:focus-visible:outline-none ctv:h-7 ctv:px-3 ctv:rounded-sm ctv:text-xs ctv:font-medium ' +
  'ctv:bg-primary-background ctv:text-primary-foreground ctv:hover:opacity-90'
const btnDanger = 'ctv:appearance-none ctv:border-none ctv:cursor-pointer ctv:[font-family:inherit] ' +
  'ctv:focus-visible:outline-none ctv:h-7 ctv:px-3 ctv:rounded-sm ctv:text-xs ctv:font-medium ' +
  'ctv:bg-destructive-background ctv:text-white ctv:hover:opacity-90'
</script>
