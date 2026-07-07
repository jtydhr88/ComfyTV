<template>
  <div
    ref="rootEl"
    class="comfytv-slot-popover
           ctv:absolute ctv:z-30 ctv:w-64 ctv:flex ctv:flex-col ctv:p-1 ctv:rounded ctv:shadow-md ctv:text-xs
           ctv:bg-interface-menu-surface ctv:text-base-foreground
           ctv:border ctv:border-border-default"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @keydown.escape.stop="$emit('close')"
  >
    <div class="ctv:py-1 ctv:px-2 ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">
      {{ $t('promptAssets.slotTitle') }}
    </div>

    <div v-if="loading" class="ctv:py-1.5 ctv:px-2 ctv:italic ctv:text-muted-foreground">
      {{ $t('configSidebar.loading') }}
    </div>
    <div v-else-if="error" class="ctv:py-1.5 ctv:px-2 ctv:text-destructive-background">
      {{ error }}
    </div>
    <template v-else>
      <button
        v-for="opt in options"
        :key="opt.slot"
        type="button"
        :class="rowClass(currentSlot === opt.slot)"
        @click="$emit('pick', opt.slot)"
      >
        <span class="ctv:shrink-0 ctv:font-mono ctv:text-muted-foreground">#{{ opt.slot }}</span>
        <span class="ctv:flex-1 ctv:truncate ctv:text-left">{{ opt.nodeTitles.join(' / ') }}</span>
        <span v-if="wiredSlots.includes(opt.slot)" :class="badgeClass">
          {{ $t('promptAssets.slotWired') }}
        </span>
        <span v-else-if="claimedSlots.includes(opt.slot) && currentSlot !== opt.slot" :class="badgeClass">
          {{ $t('promptAssets.slotClaimed') }}
        </span>
      </button>
      <div v-if="options.length === 0"
           class="ctv:py-1.5 ctv:px-2 ctv:italic ctv:text-muted-foreground ctv:whitespace-normal">
        {{ $t('promptAssets.slotEmpty') }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { ref } from 'vue'

import type { ImageSlotOption } from '@/composables/stages/assetSlots'

defineProps<{
  x: number
  y: number
  loading: boolean
  error: string | null
  options: ImageSlotOption[]
  currentSlot: number | null
  wiredSlots: number[]
  claimedSlots: number[]
}>()

const emit = defineEmits<{
  pick: [slot: number]
  close: []
}>()

const rootEl = ref<HTMLElement | null>(null)
onClickOutside(rootEl, () => emit('close'))

function rowClass(active: boolean) {
  return [
    'ctv:flex ctv:items-center ctv:gap-2 ctv:w-full ctv:py-1 ctv:px-2 ctv:cursor-pointer ctv:rounded-sm',
    'ctv:border-none ctv:text-xs ctv:text-left ctv:[font-family:inherit]',
    active
      ? 'ctv:bg-interface-menu-component-surface-selected ctv:text-base-foreground'
      : 'ctv:bg-transparent ctv:text-base-foreground ctv:hover:bg-interface-menu-component-surface-hovered',
  ].join(' ')
}

const badgeClass = 'ctv:shrink-0 ctv:py-px ctv:px-1 ctv:rounded-sm ctv:text-3xs '
  + 'ctv:bg-warning-background/15 ctv:text-warning-background'
</script>
