<template>
  <div
    class="ctv:relative ctv:flex ctv:items-center ctv:justify-center ctv:min-h-20 ctv:rounded ctv:overflow-hidden
           ctv:bg-black/20 ctv:transition-colors"
    :class="[
      value ? 'ctv:border ctv:border-solid' : 'ctv:border ctv:border-dashed',
      isDragOver
        ? 'ctv:border-primary-background ctv:bg-primary-background/10'
        : 'ctv:border-border-default',
    ]"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <template v-if="!value">
      <button
        class="ctv:flex ctv:flex-col ctv:items-center ctv:gap-1 ctv:w-full ctv:p-3.5 ctv:bg-transparent ctv:border-0
               ctv:text-muted-foreground ctv:text-xs ctv:cursor-pointer ctv:hover:bg-base-foreground/5 ctv:hover:text-base-foreground"
        @click="open"
      >
        <span class="ctv:text-lg ctv:leading-none">+</span>
        <span>{{ isDragOver ? $t('fileSlot.releaseToUpload') : $t('fileSlot.clickOrDrag', { kind: kindLabel }) }}</span>
      </button>
    </template>

    <template v-else>
      <img
        v-if="kind === 'image'"
        :src="value"
        class="ctv:block ctv:w-full ctv:max-h-44 ctv:object-contain ctv:cursor-pointer ctv:bg-black"
        @click="open"
      />
      <ProxiedVideo
        v-else-if="kind === 'video'"
        :src="value"
        class="ctv:block ctv:w-full ctv:max-h-44 ctv:object-contain ctv:cursor-pointer ctv:bg-black"
        controls muted preload="metadata"
      />
      <button
        class="ctv:absolute ctv:top-0.5 ctv:right-0.5 ctv:size-[22px] ctv:p-0 ctv:border-0 ctv:rounded-sm ctv:cursor-pointer
               ctv:bg-black/65 ctv:text-white ctv:text-sm ctv:leading-none
               ctv:hover:bg-destructive-background"
        :title="$t('fileSlot.remove', { kind: kindLabel })"
        @click.stop="$emit('clear')"
      ><i class="pi pi-times" /></button>
    </template>

    <input
      ref="picker"
      type="file"
      :accept="accept"
      class="ctv:hidden"
      @change="onFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ProxiedVideo from '@/components/widgets/ProxiedVideo.vue'

import { useFileDrop } from '@/composables/stages/useFileDrop'

const { t } = useI18n()

const props = defineProps<{
  value: string
  kind: 'image' | 'video'
  accept: string
}>()
const emit = defineEmits<{
  (e: 'change', url: string): void
  (e: 'clear'): void
}>()

const picker = ref<HTMLInputElement | null>(null)

const kindLabel = computed(() => (props.kind === 'image' ? t('fileSlot.image') : t('fileSlot.video')))

function open() { picker.value?.click() }

function acceptFile(f: File) {
  emit('change', URL.createObjectURL(f))
}

function onFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const f = input.files?.[0]
  if (f) acceptFile(f)
  input.value = ''
}

const { isDragOver, onDragEnter, onDragOver, onDragLeave, onDrop } = useFileDrop(() => props.kind, acceptFile)
</script>
