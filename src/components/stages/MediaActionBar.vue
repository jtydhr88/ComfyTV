<template>
  <button v-if="showView" type="button" :class="actionBtn"
          :title="t('stage.action.viewFull')"
          @click.stop="emit('view')"><i class="pi pi-window-maximize" /></button>
  <button type="button" :class="actionBtn"
          :title="t('stage.action.download')"
          @click.stop="emit('download', url)"><i class="pi pi-download" /></button>
  <button type="button" :class="tagBtn"
          :title="t('stage.action.addTag')"
          @click.stop="emit('tag', { url, label, mediaType, event: $event })"><i class="pi pi-tag" /></button>
  <button type="button" :class="actionBtn"
          :title="t('stage.action.loadAsset')"
          @click.stop="emit('load-asset', { url, label })"><i class="pi pi-bookmark" /></button>
  <button v-if="showRemove" type="button" :class="removeBtn"
          :title="t('stage.action.removeFromPicker')"
          @click.stop="emit('remove')"><i class="pi pi-times" /></button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  url: string
  label: string
  mediaType: string
  saved: boolean
  showView?: boolean
  showRemove?: boolean
}>()

const emit = defineEmits<{
  (e: 'view'): void
  (e: 'download', url: string): void
  (e: 'tag', payload: { url: string; label: string; mediaType: string; event: MouseEvent }): void
  (e: 'load-asset', payload: { url: string; label: string }): void
  (e: 'remove'): void
}>()

const COMFY_BTN_BASE = 'ctv:relative ctv:inline-flex ctv:items-center ctv:justify-center ctv:gap-2 ctv:cursor-pointer'
  + ' ctv:touch-manipulation ctv:whitespace-nowrap ctv:appearance-none ctv:border-none ctv:transition-colors'
  + ' ctv:disabled:pointer-events-none ctv:disabled:opacity-50'

const actionBtn = COMFY_BTN_BASE
  + ' ctv:size-5 ctv:p-0 ctv:rounded-sm ctv:text-sm'
  + ' ctv:bg-white ctv:text-gray-600 ctv:hover:bg-white/90'

const removeBtn = COMFY_BTN_BASE
  + ' ctv:size-5 ctv:p-0 ctv:rounded-sm ctv:text-xs'
  + ' ctv:bg-white ctv:text-gray-600 ctv:hover:bg-destructive-background ctv:hover:text-white'

const tagBtn = computed(() => COMFY_BTN_BASE
  + ' ctv:size-5 ctv:p-0 ctv:rounded-sm ctv:text-sm'
  + (props.saved
    ? ' ctv:bg-primary-background ctv:text-white ctv:hover:bg-primary-background/90'
    : ' ctv:bg-white ctv:text-gray-600 ctv:hover:bg-white/90'))
</script>
