<template>
  <div
    class="file-slot"
    :class="[`k-${kind}`, { filled: !!value, dragover: isDragOver }]"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <template v-if="!value">
      <button class="picker" @click="open">
        <span class="plus">+</span>
        <span class="hint">{{ isDragOver ? '松开上传' : `点击或拖入${kindLabel}` }}</span>
      </button>
    </template>

    <template v-else>
      <img v-if="kind === 'image'" :src="value" class="thumb" @click="open" />
      <video v-else-if="kind === 'video'" :src="value" class="thumb" controls muted preload="metadata" />
      <button class="clear-btn" :title="`移除${kindLabel}`" @click.stop="$emit('clear')">×</button>
    </template>

    <input
      ref="picker"
      type="file"
      :accept="accept"
      style="display:none"
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

<style scoped>
.file-slot {
  position: relative;
  border: 1px dashed var(--border-color, #555);
  border-radius: 4px;
  background: rgba(0,0,0,0.2);
  overflow: hidden;
  min-height: 80px;
  display: flex; align-items: center; justify-content: center;
  transition: border-color 0.12s ease, background 0.12s ease;
}
.file-slot.filled { border-style: solid; padding: 0; }
.file-slot.dragover {
  border-color: var(--p-primary-color, #4ea8ff);
  background: rgba(78, 168, 255, 0.08);
}

.picker {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  width: 100%; padding: 14px;
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.65);
  font-size: 11px;
  cursor: pointer;
}
.picker .plus { font-size: 18px; line-height: 1; }
.picker:hover { background: rgba(255,255,255,0.04); color: #fff; }

.thumb {
  display: block;
  width: 100%;
  max-height: 180px;
  object-fit: contain;
  cursor: pointer;
  background: #000;
}

.clear-btn {
  position: absolute;
  top: 2px; right: 2px;
  width: 22px; height: 22px;
  border: none;
  background: rgba(0,0,0,0.65);
  color: #fff;
  border-radius: 3px;
  cursor: pointer;
  font-size: 14px; line-height: 1; padding: 0;
}
.clear-btn:hover { background: rgba(220,50,50,0.85); }
</style>
