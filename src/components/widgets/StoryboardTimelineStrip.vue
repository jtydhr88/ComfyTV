<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1 ctv:shrink-0">
    <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-2xs ctv:text-muted-foreground ctv:flex-wrap">
      <span class="ctv:font-semibold">{{ $t('storyboardEditor.boards') }} · {{ sb.boards.value.length }}</span>
      <span>{{ (sb.totalMs.value / 1000).toFixed(1) }}s</span>
      <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:ml-1">
        <span>{{ $t('storyboardEditor.defaultDuration') }}</span>
        <input
          type="number" min="0.1" step="0.5"
          :value="(sb.doc.value.defaultBoardTimingMs / 1000)"
          class="ctv:w-12 ctv:py-px ctv:px-1 ctv:rounded-sm ctv:text-2xs ctv:font-mono
                 ctv:bg-secondary-background ctv:text-base-foreground ctv:border ctv:border-border-subtle"
          @change="(e) => sb.setDefaultTimingS(Number((e.target as HTMLInputElement).value))"
        /><span>s</span>
      </label>
      <span class="ctv:ml-auto" />

      <button
        v-if="hasUpstream"
        type="button" :class="stripBtn"
        @click="$emit('import-upstream')"
      >{{ $t('storyboardEditor.importUpstream') }}</button>
      <button
        v-if="hasUpstreamImages"
        type="button" :class="stripBtn"
        @click="$emit('import-upstream-images')"
      >{{ $t('storyboardEditor.importUpstreamImages') }}</button>
      <button type="button" :class="stripBtn" :disabled="sb.importingImages.value" @click="imagesInputEl?.click()">
        <span v-if="sb.importingImages.value">…</span>
        <template v-else>{{ $t('storyboardEditor.importImages') }}</template>
      </button>
      <button type="button" :class="stripBtn" @click="scriptInputEl?.click()">
        {{ $t('storyboardEditor.importScript') }}
      </button>

      <span class="ctv:w-px ctv:h-4 ctv:bg-border-subtle" />

      <button
        type="button" :class="stripBtn"
        :disabled="sb.exportingAnimatic.value"
        @click="$emit('export-animatic')"
      >
        <span v-if="sb.exportingAnimatic.value">…</span>
        <template v-else>{{ $t('storyboardEditor.exportAnimatic') }}</template>
      </button>
      <button
        type="button" :class="stripBtn"
        :disabled="sb.exportingGif.value"
        @click="$emit('export-gif')"
      >
        <span v-if="sb.exportingGif.value">…</span>
        <template v-else>GIF</template>
      </button>
      <button
        type="button" :class="stripBtn"
        :disabled="exportingPdf"
        @click="$emit('export-pdf')"
      >
        <span v-if="exportingPdf">…</span>
        <template v-else>{{ $t('storyboardEditor.exportPdf') }}</template>
      </button>
      <button
        type="button" :class="stripBtn"
        :disabled="sb.exportingZip.value"
        @click="$emit('export-zip')"
      >
        <span v-if="sb.exportingZip.value">…</span>
        <template v-else>PNG</template>
      </button>

      <span class="ctv:w-px ctv:h-4 ctv:bg-border-subtle" />

      <button type="button" :class="stripBtn" @click="sb.addBoard()">
        + {{ $t('storyboardEditor.addBoard') }}
      </button>

      <input ref="imagesInputEl" type="file" accept="image/*" multiple class="ctv:hidden" @change="onImagesPicked" />
      <input ref="scriptInputEl" type="file" accept=".fountain,.txt,.spmd" class="ctv:hidden" @change="onScriptPicked" />
    </div>

    <div class="ctv:flex ctv:gap-1.5 ctv:overflow-x-auto ctv:pb-1">
      <div
        v-for="(board, idx) in sb.boards.value"
        :key="board.uid"
        class="ctv:group ctv:relative ctv:shrink-0 ctv:w-28 ctv:cursor-pointer ctv:rounded ctv:overflow-hidden
               ctv:border ctv:bg-black"
        :class="[
          board.uid === sb.currentUid.value
            ? 'ctv:border-primary-background ctv:ring-1 ctv:ring-primary-background'
            : 'ctv:border-border-subtle',
          sb.playing.value && idx === sb.playIndex.value ? 'ctv:outline ctv:outline-1 ctv:outline-success-background' : '',
          dropIndex === idx ? 'ctv:ring-2 ctv:ring-warning-background' : '',
        ]"
        draggable="true"
        @click="sb.selectBoard(board.uid)"
        @dragstart="onDragStart($event, board.uid)"
        @dragover.prevent="dropIndex = idx"
        @dragleave="dropIndex = dropIndex === idx ? null : dropIndex"
        @drop.prevent="onDrop(idx)"
        @dragend="onDragEnd"
      >
        <div class="ctv:aspect-video ctv:w-full">
          <img
            v-if="boardImageUrl(board)"
            :src="boardImageUrl(board)!"
            class="ctv:size-full ctv:object-cover"
            draggable="false"
          />
          <div v-else class="ctv:size-full ctv:flex ctv:items-center ctv:justify-center ctv:text-3xs ctv:text-white/30">
            {{ sb.labels.value[idx] }}
          </div>
        </div>

        <span
          class="ctv:absolute ctv:top-0.5 ctv:left-0.5 ctv:py-px ctv:px-1 ctv:rounded-sm ctv:text-3xs ctv:font-mono"
          :class="(idx === 0 || board.newShot)
            ? 'ctv:bg-primary-background/85 ctv:text-white ctv:font-bold'
            : 'ctv:bg-black/60 ctv:text-white/70'"
        >{{ sb.labels.value[idx] }}</span>
        <span
          class="ctv:absolute ctv:top-0.5 ctv:right-0.5 ctv:py-px ctv:px-1 ctv:rounded-sm ctv:text-3xs ctv:font-mono ctv:bg-black/60 ctv:text-white/80 ctv:cursor-ew-resize ctv:select-none"
          :title="$t('storyboardEditor.dragDuration')"
          @pointerdown.stop="startDurationDrag($event, board.uid, idx)"
          @click.stop
        >{{ (boardDurationMs(sb.doc.value, board) / 1000).toFixed(1) }}s</span>

        <div
          class="ctv:absolute ctv:bottom-0.5 ctv:right-0.5 ctv:hidden ctv:group-hover:flex ctv:gap-px"
          @click.stop
        >
          <button type="button" :class="tileBtn"
                  :title="$t('storyboardEditor.duplicateBoard')" @click="sb.duplicateBoard(board.uid)">
            <i class="pi pi-clone" />
          </button>
          <button type="button" :class="tileBtn" :disabled="idx === 0"
                  :title="$t('storyboardEditor.moveLeft')" @click="sb.moveBoard(board.uid, -1)">
            <i class="pi pi-chevron-left" />
          </button>
          <button type="button" :class="tileBtn" :disabled="idx === sb.boards.value.length - 1"
                  :title="$t('storyboardEditor.moveRight')" @click="sb.moveBoard(board.uid, 1)">
            <i class="pi pi-chevron-right" />
          </button>
          <button type="button" :class="tileBtn" :disabled="sb.boards.value.length <= 1"
                  :title="$t('storyboardEditor.deleteBoard')" @click="sb.removeBoard(board.uid)">
            <i class="pi pi-trash" />
          </button>
        </div>
      </div>

      <button
        type="button"
        class="ctv:shrink-0 ctv:w-14 ctv:rounded ctv:border ctv:border-dashed ctv:border-border-subtle
               ctv:bg-transparent ctv:text-muted-foreground ctv:cursor-pointer ctv:text-lg
               ctv:hover:border-primary-background ctv:hover:text-primary-background"
        :title="$t('storyboardEditor.addBoard')"
        @click="sb.addBoard(false)"
      >+</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import type { StoryboardEditorController } from '@/composables/widgets/useStoryboardEditor'
import { boardDurationMs, boardImageUrl } from '@/widgets/storyboard/boardDoc'

const props = defineProps<{
  sb: StoryboardEditorController
  hasUpstream: boolean
  hasUpstreamImages: boolean
  exportingPdf: boolean
}>()

const emit = defineEmits<{
  (e: 'import-upstream'): void
  (e: 'import-upstream-images'): void
  (e: 'export-animatic'): void
  (e: 'export-gif'): void
  (e: 'export-pdf'): void
  (e: 'export-zip'): void
  (e: 'import-script', text: string): void
  (e: 'import-images', files: File[]): void
}>()

const scriptInputEl = ref<HTMLInputElement | null>(null)
const imagesInputEl = ref<HTMLInputElement | null>(null)

async function onScriptPicked(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  emit('import-script', await file.text())
}

function onImagesPicked(e: Event): void {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (files.length) emit('import-images', files)
}

const dragUid = ref<string | null>(null)
const dropIndex = ref<number | null>(null)

function onDragStart(e: DragEvent, uid: string): void {
  dragUid.value = uid
  e.dataTransfer?.setData('text/plain', uid)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onDrop(idx: number): void {
  if (dragUid.value) props.sb.moveBoardTo(dragUid.value, idx)
  onDragEnd()
}
function onDragEnd(): void {
  dragUid.value = null
  dropIndex.value = null
}

let durDrag: { uid: string; startX: number; startMs: number } | null = null
function startDurationDrag(e: PointerEvent, uid: string, idx: number): void {
  const board = props.sb.boards.value[idx]
  durDrag = { uid, startX: e.clientX, startMs: boardDurationMs(props.sb.doc.value, board) }
  const el = e.target as HTMLElement
  el.setPointerCapture(e.pointerId)
  const onMove = (ev: PointerEvent): void => {
    if (!durDrag) return
    const deltaS = (ev.clientX - durDrag.startX) / 40
    props.sb.setBoardDurationS(durDrag.uid, Math.max(0.1, durDrag.startMs / 1000 + deltaS))
  }
  const onUp = (): void => {
    durDrag = null
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', onUp)
    el.removeEventListener('pointercancel', onUp)
  }
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onUp)
}

const stripBtn =
  'ctv:py-0.5 ctv:px-2 ctv:text-2xs ctv:rounded ctv:cursor-pointer ' +
  'ctv:bg-primary-background/15 ctv:border ctv:border-primary-background/40 ctv:text-primary-background ' +
  'ctv:hover:bg-primary-background/25 ctv:disabled:opacity-50'

const tileBtn =
  'ctv:size-5 ctv:p-0 ctv:border-0 ctv:rounded ctv:cursor-pointer ctv:text-[9px] ' +
  'ctv:bg-black/70 ctv:text-white ctv:hover:bg-black/90 ctv:disabled:opacity-30 ctv:disabled:cursor-default'
</script>
