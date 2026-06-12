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
        <span>{{ isDragOver ? '松开上传' : `点击或拖入${kindLabel}` }}</span>
      </button>
    </template>

    <template v-else>
      <img
        v-if="kind === 'image'"
        :src="value"
        class="ctv:block ctv:w-full ctv:max-h-44 ctv:object-contain ctv:cursor-pointer ctv:bg-black"
        @click="open"
      />
      <video
        v-else-if="kind === 'video'"
        :src="value"
        class="ctv:block ctv:w-full ctv:max-h-44 ctv:object-contain ctv:cursor-pointer ctv:bg-black"
        controls muted preload="metadata"
      />
      <button
        class="ctv:absolute ctv:top-0.5 ctv:right-0.5 ctv:size-[22px] ctv:p-0 ctv:border-0 ctv:rounded-sm ctv:cursor-pointer
               ctv:bg-black/65 ctv:text-white ctv:text-sm ctv:leading-none
               ctv:hover:bg-destructive-background"
        :title="`移除${kindLabel}`"
        @click.stop="$emit('clear')"
      >×</button>
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
const isDragOver = ref(false)
let dragCounter = 0

const kindLabel = computed(() => (props.kind === 'image' ? '图片' : '视频'))

function open() { picker.value?.click() }

function acceptFile(f: File) {
  const url = URL.createObjectURL(f)
  emit('change', url)
}

function onFileChange(ev: Event) {
  const t = ev.target as HTMLInputElement
  const f = t.files?.[0]
  if (f) acceptFile(f)
  t.value = ''
}

function isMatchingFile(item: DataTransferItem): boolean {
  if (item.kind !== 'file') return false
  if (props.kind === 'image') return item.type.startsWith('image/')
  return item.type.startsWith('video/')
}
function onDragEnter(ev: DragEvent) {
  if (!Array.from(ev.dataTransfer?.items || []).some(isMatchingFile)) return
  dragCounter++
  isDragOver.value = true
}
function onDragOver(ev: DragEvent) {
  if (!ev.dataTransfer) return
  ev.dataTransfer.dropEffect = 'copy'
}
function onDragLeave() {
  dragCounter = Math.max(0, dragCounter - 1)
  if (dragCounter === 0) isDragOver.value = false
}
function onDrop(ev: DragEvent) {
  dragCounter = 0
  isDragOver.value = false
  const file = Array.from(ev.dataTransfer?.files || []).find(f =>
    (props.kind === 'image' ? f.type.startsWith('image/') : f.type.startsWith('video/'))
  )
  if (file) acceptFile(file)
}
</script>
