<template>
  <div v-if="widget" ref="rootEl" class="ctv:relative ctv:pt-1 ctv:px-2 ctv:pb-1">
    <EditorContent :editor="editor" class="comfytv-prompt-editor" />
    <div class="ctv:flex ctv:gap-1 ctv:mt-1">
      <button
        type="button"
        :class="[iconBtnClass, helperOpen
          ? 'ctv:bg-primary-background/20 ctv:border-primary-background/50 ctv:text-primary-background'
          : 'ctv:bg-secondary-background ctv:border-border-default ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground']"
        :title="$t('promptHelper.open')"
        @click="helperOpen = !helperOpen"
      ><i class="pi pi-sparkles" /></button>
      <button
        type="button"
        :class="[iconBtnClass, cameraOpen
          ? 'ctv:bg-primary-background/20 ctv:border-primary-background/50 ctv:text-primary-background'
          : 'ctv:bg-secondary-background ctv:border-border-default ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground']"
        :title="$t('cameraPrompt.open')"
        @click="cameraOpen = !cameraOpen"
      ><i class="pi pi-video" /></button>
      <button
        type="button"
        :class="[iconBtnClass,
          'ctv:bg-secondary-background ctv:border-border-default ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground']"
        :title="$t('mention.parse')"
        @click="onParseMentions"
      ><i class="pi pi-at" /></button>
      <button
        type="button"
        :class="[iconBtnClass, saveOpen
          ? 'ctv:bg-primary-background/20 ctv:border-primary-background/50 ctv:text-primary-background'
          : 'ctv:bg-secondary-background ctv:border-border-default ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground']"
        :title="$t('promptSave.open')"
        @click="toggleSave"
      ><i class="pi pi-bookmark" /></button>
      <button
        type="button"
        :class="[iconBtnClass, entriesOpen
          ? 'ctv:bg-primary-background/20 ctv:border-primary-background/50 ctv:text-primary-background'
          : 'ctv:bg-secondary-background ctv:border-border-default ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground']"
        :title="$t('promptEntries.open')"
        @click="entriesOpen = !entriesOpen"
      ><i class="pi pi-book" /></button>
    </div>
    <EntriesQuickPanel v-if="entriesOpen" @insert="onEntryInsert" />
    <div v-if="saveOpen"
         class="ctv:mt-1 ctv:p-2 ctv:rounded ctv:flex ctv:flex-col ctv:gap-1.5
                ctv:bg-secondary-background ctv:border ctv:border-border-default">
      <span class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('promptSave.hint') }}</span>
      <input
        v-model="saveLabel"
        class="ctv:h-6 ctv:box-border ctv:px-2 ctv:rounded-sm ctv:text-xs ctv:[font-family:inherit]
               ctv:bg-interface-panel-surface ctv:border ctv:border-border-subtle ctv:text-base-foreground
               ctv:placeholder:text-muted-foreground ctv:focus-visible:outline-none ctv:focus:border-border-default"
        :placeholder="$t('promptSave.labelPlaceholder')"
        @keydown.stop
        @keydown.enter.prevent="onSavePrompt"
        @keydown.escape="saveOpen = false"
      />
      <span v-if="saveError" class="ctv:text-2xs ctv:text-destructive-background">{{ saveError }}</span>
      <div class="ctv:flex ctv:justify-end ctv:gap-1.5">
        <button :class="saveBtnClass" :disabled="!canSavePrompt" @click="onSavePrompt">
          {{ $t('promptSave.save') }}
        </button>
      </div>
    </div>
    <PromptHelperPanel
      v-if="helperOpen"
      :groups="helper.groups"
      :is-active="helper.isActive"
      @apply="helper.apply"
    />
    <CameraPromptPanel v-if="cameraOpen" @insert="onCameraInsert" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { EditorContent } from '@tiptap/vue-3'
import 'tippy.js/dist/tippy.css'

import type { Entry } from '@/api/schemas'
import type { CameraSelection } from '@/composables/stages/cameraControlCatalog'
import { CAMERA_BUILDER } from '@/composables/stages/promptModules/builders'
import { nonSlotMentionLabels, normalizeMentionText } from '@/composables/stages/imageSlotMentions'
import { inlineContentFromText, useMainPromptInput } from '@/composables/stages/useMainPromptInput'
import { usePromptModules } from '@/composables/stages/usePromptModules'
import { useEntryStore } from '@/stores/entryStore'
import { useProjectStore } from '@/stores/projectStore'
import { isValidLabel } from '@/utils/labelRegex'
import type { LGraphNode } from '@/lib/comfyApp'

import CameraPromptPanel from './CameraPromptPanel.vue'
import EntriesQuickPanel from './EntriesQuickPanel.vue'
import MentionList from './MentionList.vue'
import PromptHelperPanel from './PromptHelperPanel.vue'

const props = defineProps<{ node?: LGraphNode }>()

const rootEl = ref<HTMLElement | null>(null)

const { widget, editor, promptText, applyPromptText } = useMainPromptInput(
  () => props.node,
  MentionList,
)

const helperOpen = ref(false)
const helper = usePromptModules(() => promptText.value, applyPromptText)

const cameraOpen = ref(false)
function onCameraInsert(selection: CameraSelection) {
  helper.apply(CAMERA_BUILDER, selection as Record<string, string>)
}

const entriesOpen = ref(false)
function onEntryInsert(entry: Entry) {
  const ed = editor.value
  if (!ed) return
  const content = entry.kind === 'prompt'
    ? inlineContentFromText(normalizeMentionText(entry.content))
    : [
        { type: 'mention', attrs: { id: entry.label, label: entry.label } },
        { type: 'text', text: ' ' },
      ]
  ed.chain().focus().insertContent(content).run()
}

function onParseMentions() {
  applyPromptText(normalizeMentionText(promptText.value))
}

const { t } = useI18n()
const entryStore = useEntryStore()
const projectStore = useProjectStore()

const saveOpen = ref(false)
const saveLabel = ref('')
const saveDone = ref(false)

const saveError = computed(() => {
  if (saveDone.value) return ''
  const bad = nonSlotMentionLabels(normalizeMentionText(promptText.value))
  if (bad.length) {
    return t('promptSave.entryRefsError', { tokens: bad.map(l => `@${l}`).join(' ') })
  }
  if (saveLabel.value && !isValidLabel(saveLabel.value)) return t('entries.labelError')
  return ''
})

const canSavePrompt = computed(() =>
  !!promptText.value.trim()
  && isValidLabel(saveLabel.value)
  && nonSlotMentionLabels(normalizeMentionText(promptText.value)).length === 0,
)

function toggleSave() {
  saveOpen.value = !saveOpen.value
  saveDone.value = false
  if (saveOpen.value) saveLabel.value = ''
}

async function onSavePrompt() {
  if (!canSavePrompt.value) return
  const row = await entryStore.upsert(projectStore.currentProjectId || '', {
    kind: 'prompt',
    label: saveLabel.value,
    content: normalizeMentionText(promptText.value).trim(),
  })
  if (row) {
    saveDone.value = true
    saveOpen.value = false
  }
}

const iconBtnClass = 'ctv:inline-flex ctv:items-center ctv:justify-center ctv:size-5 ctv:cursor-pointer'
  + ' ctv:rounded-sm ctv:border ctv:text-2xs ctv:leading-none ctv:[font-family:inherit] ctv:transition-colors'

const saveBtnClass = 'ctv:inline-flex ctv:items-center ctv:justify-center ctv:gap-1 ctv:cursor-pointer'
  + ' ctv:h-6 ctv:rounded-sm ctv:px-2 ctv:text-xs ctv:font-medium ctv:border-none ctv:transition-colors'
  + ' ctv:bg-primary-background ctv:text-base-foreground ctv:hover:bg-primary-background-hover'
  + ' ctv:disabled:pointer-events-none ctv:disabled:opacity-50'
</script>

<style>
.comfytv-prompt-prosemirror {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.35) transparent;
}
.comfytv-prompt-prosemirror::-webkit-scrollbar {
  width: 10px;
}
.comfytv-prompt-prosemirror::-webkit-scrollbar-track {
  background: transparent;
}
.comfytv-prompt-prosemirror::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.35);
  border-radius: 5px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.comfytv-prompt-prosemirror:hover::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.55);
}

.tippy-box[data-theme~='comfytv-transparent'] {
  background: transparent;
  box-shadow: none;
}
.tippy-box[data-theme~='comfytv-transparent'] > .tippy-content { padding: 0; }

.tippy-box[data-theme~='comfytv-tooltip'] {
  background: var(--interface-menu-surface, #1a1a1a);
  border: 1px solid var(--border-default, #3a3a3a);
  color: var(--base-foreground, #e0e0e0);
  font-size: 11px;
  line-height: 1.45;
  border-radius: 4px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}
.tippy-box[data-theme~='comfytv-tooltip'] > .tippy-content {
  padding: 6px 8px;
  white-space: pre-wrap;
  word-break: break-word;
}
.tippy-box[data-theme~='comfytv-tooltip'][data-placement^='top']    > .tippy-arrow::before { border-top-color: var(--border-default, #3a3a3a); }
.tippy-box[data-theme~='comfytv-tooltip'][data-placement^='bottom'] > .tippy-arrow::before { border-bottom-color: var(--border-default, #3a3a3a); }
.tippy-box[data-theme~='comfytv-tooltip'][data-placement^='left']   > .tippy-arrow::before { border-left-color: var(--border-default, #3a3a3a); }
.tippy-box[data-theme~='comfytv-tooltip'][data-placement^='right']  > .tippy-arrow::before { border-right-color: var(--border-default, #3a3a3a); }
</style>

<style scoped>
.comfytv-prompt-editor :deep(p) { margin: 0; }
.comfytv-prompt-editor :deep(p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: var(--muted-foreground, #888);
  opacity: 0.65;
  float: left;
  height: 0;
  pointer-events: none;
}
</style>
