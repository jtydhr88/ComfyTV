<template>
  <span
    role="button"
    tabindex="0"
    :class="btnClass"
    :title="t('stage.action.viewFull')"
    @click.stop.prevent="open"
    @keydown.enter.stop.prevent="open"
    @keydown.space.stop.prevent="open"
    @pointerdown.stop
  ><i class="pi pi-window-maximize" /></span>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { type LightboxItem, openLightbox } from '@/composables/useLightbox'

const { t } = useI18n()

const props = defineProps<{
  url?: string
  label?: string
  items?: LightboxItem[]
  index?: number
}>()

function open(): void {
  if (props.items?.length) {
    openLightbox(props.items, props.index ?? 0)
  } else if (props.url) {
    openLightbox([{ url: props.url, label: props.label }])
  }
}

const btnClass = [
  'ctv-hover-reveal ctv:absolute ctv:z-10 ctv:flex ctv:items-center ctv:justify-center',
  'ctv:size-4 ctv:rounded-sm ctv:cursor-pointer ctv:text-2xs ctv:leading-none ctv:[font-family:inherit]',
  'ctv:bg-black/60 ctv:text-white ctv:border ctv:border-white/30 ctv:hover:bg-black/80',
].join(' ')
</script>
