<template>
  <div
    class="relative flex items-center justify-center min-h-20 rounded overflow-hidden
           bg-black/20 transition-colors"
    :class="[
      value ? 'border border-solid' : 'border border-dashed',
      isDragOver
        ? 'border-primary-background bg-primary-background/10'
        : 'border-border-default',
    ]"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <template v-if="!value">
      <button
        class="flex flex-col items-center gap-1 w-full p-3.5 bg-transparent border-0
               text-muted-foreground text-xs cursor-pointer hover:bg-base-foreground/5 hover:text-base-foreground"
        @click="open"
      >
        <span class="text-lg leading-none">+</span>
        <span>{{ isDragOver ? '松开上传' : `点击或拖入${kindLabel}` }}</span>
      </button>
    </template>

    <template v-else>
      <img
        v-if="kind === 'image'"
        :src="value"
        class="block w-full max-h-44 object-contain cursor-pointer bg-black"
        @click="open"
      />
      <video
        v-else-if="kind === 'video'"
        :src="value"
        class="block w-full max-h-44 object-contain cursor-pointer bg-black"
        controls muted preload="metadata"
      />
      <button
        class="absolute top-0.5 right-0.5 size-[22px] p-0 border-0 rounded-sm cursor-pointer
               bg-black/65 text-white text-sm leading-none
               hover:bg-destructive-background"
        :title="`移除${kindLabel}`"
        @click.stop="$emit('clear')"
      >×</button>
    </template>

    <input
      ref="picker"
      type="file"
      :accept="accept"
      class="hidden"
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
