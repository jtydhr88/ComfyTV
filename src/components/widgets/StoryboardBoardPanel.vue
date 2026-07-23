<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:overflow-y-auto ctv:p-1 ctv:text-2xs">
    <div class="ctv:flex ctv:items-center ctv:gap-2">
      <span class="ctv:text-sm ctv:font-bold ctv:font-mono ctv:text-base-foreground">
        {{ sb.labels.value[sb.currentIndex.value] }}
      </span>
      <span class="ctv:text-muted-foreground">#{{ sb.currentIndex.value + 1 }}</span>
      <label class="ctv:ml-auto ctv:flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:text-muted-foreground">
        <input
          type="checkbox"
          :checked="board.newShot"
          :disabled="sb.currentIndex.value === 0"
          @change="sb.toggleNewShot(board.uid)"
        />
        {{ $t('storyboardEditor.newShot') }}
      </label>
    </div>

    <label class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-muted-foreground">
      {{ $t('storyboardEditor.duration') }}
      <input
        type="number" min="0.1" step="0.5"
        :value="board.durationMs != null ? board.durationMs / 1000 : ''"
        :placeholder="(sb.doc.value.defaultBoardTimingMs / 1000).toFixed(1)"
        class="ctv:w-16 ctv:py-0.5 ctv:px-1 ctv:rounded-sm ctv:font-mono
               ctv:bg-secondary-background ctv:text-base-foreground ctv:border ctv:border-border-subtle"
        @change="onDuration"
      /><span>s</span>
      <button
        v-if="suggestedS != null"
        type="button" :class="btn"
        :title="$t('storyboardEditor.suggestDurationHint')"
        @click="sb.applySuggestedDuration(board.uid)"
      >≈ {{ suggestedS }}s</button>
    </label>

    <template v-for="field in FIELDS" :key="field.key">
      <label class="ctv:opacity-60">{{ $t(field.label) }}</label>
      <textarea
        :value="board[field.key]"
        :rows="field.rows ?? 1"
        class="ctv:w-full ctv:box-border ctv:resize-y ctv:py-1 ctv:px-1.5 ctv:rounded ctv:text-2xs ctv:leading-snug ctv:[font-family:inherit]
               ctv:bg-secondary-background ctv:text-base-foreground ctv:border ctv:border-transparent ctv:min-h-[24px]
               ctv:hover:border-border-subtle ctv:focus:outline-none ctv:focus:border-primary-background/50"
        @input="(e) => sb.setBoardField(board.uid, field.key, (e.target as HTMLTextAreaElement).value)"
      />
    </template>

    <div class="ctv:flex ctv:flex-col ctv:gap-1 ctv:pt-1 ctv:border-t ctv:border-border-subtle">
      <span class="ctv:opacity-60">{{ $t('storyboardEditor.refImage') }}</span>
      <div class="ctv:relative ctv:w-full ctv:aspect-video ctv:rounded ctv:overflow-hidden ctv:bg-black ctv:border ctv:border-border-subtle">
        <img v-if="board.refUrl" :src="board.refUrl" class="ctv:size-full ctv:object-contain" draggable="false" />
        <div v-else class="ctv:size-full ctv:flex ctv:items-center ctv:justify-center ctv:text-3xs ctv:text-white/30">
          {{ $t('storyboardEditor.noRef') }}
        </div>
      </div>
      <div class="ctv:flex ctv:gap-1">
        <button type="button" :class="btn" :disabled="uploading" @click="pickFile">
          <span v-if="uploading">…</span>
          <template v-else>{{ $t('storyboardEditor.uploadRef') }}</template>
        </button>
        <button
          v-if="board.refUrl" type="button" :class="btn"
          @click="sb.editor.addImageFromUrl(board.refUrl!, 'reference')"
        >{{ $t('storyboardEditor.addRefToCanvas') }}</button>
        <button
          v-if="board.refUrl" type="button" :class="btn"
          @click="sb.setBoardRefUrl(board.uid, null)"
        >{{ $t('storyboardEditor.clearRef') }}</button>
      </div>
    </div>

    <input ref="fileInputEl" type="file" accept="image/*" class="ctv:hidden" @change="onFilePicked" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { StoryboardEditorController } from '@/composables/widgets/useStoryboardEditor'
import { suggestedDurationMs } from '@/widgets/storyboard/boardDoc'
import { uploadBlob } from '@/utils/uploadCanvas'

const props = defineProps<{ sb: StoryboardEditorController }>()

const board = computed(() => props.sb.currentBoard.value)
const suggestedS = computed(() => {
  const ms = suggestedDurationMs(board.value)
  return ms != null ? (ms / 1000).toFixed(1) : null
})

type FieldKey = 'scenePurpose' | 'dialogue' | 'action' | 'notes' | 'character' | 'shotSize' | 'imagePrompt' | 'motionPrompt'
const FIELDS: ReadonlyArray<{ key: FieldKey; label: string; rows?: number }> = [
  { key: 'scenePurpose', label: 'storyboardEditor.fields.scenePurpose', rows: 2 },
  { key: 'dialogue',     label: 'storyboardEditor.fields.dialogue' },
  { key: 'action',       label: 'storyboardEditor.fields.action' },
  { key: 'notes',        label: 'storyboardEditor.fields.notes' },
  { key: 'character',    label: 'storyboardEditor.fields.character' },
  { key: 'shotSize',     label: 'storyboardEditor.fields.shotSize' },
  { key: 'imagePrompt',  label: 'storyboardEditor.fields.imagePrompt', rows: 2 },
  { key: 'motionPrompt', label: 'storyboardEditor.fields.motionPrompt', rows: 2 },
]

function onDuration(e: Event): void {
  const raw = (e.target as HTMLInputElement).value.trim()
  props.sb.setBoardDurationS(board.value.uid, raw ? Number(raw) : null)
}

const fileInputEl = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

function pickFile(): void {
  fileInputEl.value?.click()
}
async function onFilePicked(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  uploading.value = true
  try {
    const url = await uploadBlob(file, { subfolder: 'comfytv/storyboard', filename: file.name })
    props.sb.setBoardRefUrl(board.value.uid, url)
  } catch (err) {
    console.error('[ComfyTV/storyboardEditor] ref upload failed', err)
  } finally {
    uploading.value = false
  }
}

const btn =
  'ctv:py-0.5 ctv:px-2 ctv:text-2xs ctv:rounded ctv:cursor-pointer ' +
  'ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground ' +
  'ctv:hover:bg-secondary-background-hover ctv:disabled:opacity-50'
</script>
