<template>
  <div ref="rootEl" class="ctv:relative">
    <EditorContent :editor="editor" class="comfytv-prompt-editor" />
    <div class="ctv:flex ctv:gap-1 ctv:mt-1">
      <button
        type="button"
        :class="[iconBtnClass,
          'ctv:bg-secondary-background ctv:border-border-default ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground']"
        :title="$t('mention.parse')"
        @click="onParseMentions"
      ><i class="pi pi-at" /></button>
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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { EditorContent } from '@tiptap/vue-3'
import 'tippy.js/dist/tippy.css'

import type { Entry } from '@/api/schemas'
import { normalizeMentionText } from '@/composables/stages/imageSlotMentions'
import {
  inlineContentFromText,
  usePromptEditorCore,
} from '@/composables/stages/useMainPromptInput'
import type { MentionSource } from '@/composables/stages/useMentionSuggestion'

import EntriesQuickPanel from './EntriesQuickPanel.vue'
import MentionList from './MentionList.vue'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  source: MentionSource
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const rootEl = ref<HTMLElement | null>(null)

const { editor, promptText, applyPromptText } = usePromptEditorCore({
  initialText: props.modelValue,
  placeholder: () => props.placeholder ?? '',
  source: () => props.source,
  mentionList: MentionList,
  onTextChange: (text) => emit('update:modelValue', text),
})

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

const iconBtnClass = 'ctv:inline-flex ctv:items-center ctv:justify-center ctv:size-5 ctv:cursor-pointer'
  + ' ctv:rounded-sm ctv:border ctv:text-2xs ctv:leading-none ctv:[font-family:inherit] ctv:transition-colors'
</script>

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
