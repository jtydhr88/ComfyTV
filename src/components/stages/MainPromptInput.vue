<template>
  <div v-if="widget" class="comfytv-main-prompt">
    <EditorContent :editor="editor" class="prompt-editor" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch, computed, ref } from 'vue'

import Document    from '@tiptap/extension-document'
import HardBreak   from '@tiptap/extension-hard-break'
import Mention     from '@tiptap/extension-mention'
import Paragraph   from '@tiptap/extension-paragraph'
import Placeholder from '@tiptap/extension-placeholder'
import Text        from '@tiptap/extension-text'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { delegate as tippyDelegate } from 'tippy.js'
import 'tippy.js/dist/tippy.css'

import { useMentionSuggestion } from '@/composables/stages/useMentionSuggestion'
import { useEntryStore } from '@/stores/entryStore'
import { useProjectStore } from '@/stores/projectStore'
import { MENTION_RE } from '@/utils/labelRegex'

import MentionList from './MentionList.vue'

const props = defineProps<{ node: any }>()

const entryStore = useEntryStore()
const projectStore = useProjectStore()
const projectId = computed(() => projectStore.currentProjectId || '')

const widget = computed(() =>
  props.node?.widgets?.find((w: any) => w.name === 'main_prompt'),
)
const placeholder = computed(() => {
  const w = widget.value
  return w?.options?.placeholder ?? w?.placeholder ?? ''
})

function textToContent(text: string): any {
  const content: any[] = []
  let i = 0
  const matches = text.matchAll(MENTION_RE)
  for (const m of matches) {
    const start = m.index!
    if (start > i) content.push({ type: 'text', text: text.slice(i, start) })
    const label = m[1]
    content.push({
      type: 'mention',
      attrs: { id: label, label },
    })
    i = start + m[0].length
  }
  if (i < text.length) content.push({ type: 'text', text: text.slice(i) })
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: content.length ? content : undefined }],
  }
}


const initialText = String(widget.value?.value ?? '')
let suppressWriteback = false

const editor = useEditor({
  content: textToContent(initialText),
  extensions: [
    Document,
    Paragraph,
    Text,
    HardBreak,
    Placeholder.configure({
      placeholder: placeholder.value || 'Prompt — type @ to insert a saved fragment / character',
    }),
    Mention.configure({
      HTMLAttributes: { class: 'mention-chip' },
      renderText: ({ node }) => `@${node.attrs.label}`,
      renderHTML: ({ node, HTMLAttributes }: any) => [
        'span',
        {
          ...HTMLAttributes,
          'data-mention-id': node.attrs.id,
          'data-mention-label': node.attrs.label,
        },
        `@${node.attrs.label}`,
      ],
      suggestion: useMentionSuggestion(projectId, MentionList),
    }),
  ],
  editorProps: {
    attributes: {
      class: 'comfytv-prompt-prosemirror',
      spellcheck: 'false',
    },
  },
  onUpdate: ({ editor }) => {
    if (suppressWriteback) return
    const text = editor.getText({ blockSeparator: '\n' })
    const w = widget.value
    if (w && w.value !== text) {
      w.value = text
    }
  },
})

import { useStageStore } from '@/stores/stageStore'
const stageStore = useStageStore()
const stageState = computed(() => stageStore.getStage(props.node))

watch(
  () => stageState.value?.mainPrompt,
  (next) => {
    if (next == null) return
    if (!editor.value) return
    const current = editor.value.getText({ blockSeparator: '\n' })
    if (next === current) return
    suppressWriteback = true
    try {
      editor.value.commands.setContent(textToContent(next), { emitUpdate: false })
    } finally {
      suppressWriteback = false
    }
  },
)

let chipTooltips: any = null

function stopBubble(e: Event) { e.stopPropagation() }

onMounted(() => {
  void entryStore.list(projectId.value)
  Promise.resolve().then(() => {
    const root = editor.value?.view?.dom
    if (!root) return
    root.addEventListener('paste', stopBubble)
    root.addEventListener('copy',  stopBubble)
    root.addEventListener('cut',   stopBubble)
    chipTooltips = tippyDelegate(root, {
      target: '.mention-chip',
      content: (ref) => {
        const el = ref as HTMLElement
        const label = el.dataset.mentionLabel ?? el.textContent?.slice(1) ?? ''
        const matches = entryStore.list(projectId.value).filter(e => e.label === label)
        if (matches.length === 0) {
          return `@${label} — no matching entry (will stay literal at run)`
        }
        if (matches.length === 1) return matches[0].content
        return matches.map(e => `[${e.kind}] ${e.content}`).join('\n──────\n')
      },
      placement: 'top',
      arrow: true,
      delay: [250, 0],
      theme: 'comfytv-tooltip',
      maxWidth: 380,
      allowHTML: false,
    })
  })
})

onBeforeUnmount(() => {
  if (Array.isArray(chipTooltips)) chipTooltips.forEach(t => t?.destroy?.())
  else chipTooltips?.destroy?.()
  try {
    const root = editor.value?.view?.dom
    if (root) {
      root.removeEventListener('paste', stopBubble)
      root.removeEventListener('copy',  stopBubble)
      root.removeEventListener('cut',   stopBubble)
    }
  } catch {  }
  editor.value?.destroy()
})
</script>

<style>
.tippy-box[data-theme~='comfytv-transparent'] {
  background: transparent;
  box-shadow: none;
}
.tippy-box[data-theme~='comfytv-transparent'] > .tippy-content { padding: 0; }

.tippy-box[data-theme~='comfytv-tooltip'] {
  background: var(--comfy-input-bg, #1a1a1a);
  border: 1px solid var(--border-color, #3a3a3a);
  color: var(--input-text, #e0e0e0);
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
.tippy-box[data-theme~='comfytv-tooltip'][data-placement^='top']    > .tippy-arrow::before { border-top-color: var(--border-color, #3a3a3a); }
.tippy-box[data-theme~='comfytv-tooltip'][data-placement^='bottom'] > .tippy-arrow::before { border-bottom-color: var(--border-color, #3a3a3a); }
.tippy-box[data-theme~='comfytv-tooltip'][data-placement^='left']   > .tippy-arrow::before { border-left-color: var(--border-color, #3a3a3a); }
.tippy-box[data-theme~='comfytv-tooltip'][data-placement^='right']  > .tippy-arrow::before { border-right-color: var(--border-color, #3a3a3a); }
</style>

<style scoped>
.comfytv-main-prompt {
  padding: 6px 8px 4px;
}

.prompt-editor {
  /* :deep is how scoped styles cross into ProseMirror's rendered DOM. */
}

.prompt-editor :deep(.comfytv-prompt-prosemirror) {
  min-height: 44px;
  max-height: 320px;
  overflow-y: auto;
  padding: 6px 8px;
  background: var(--comfy-input-bg, #1a1a1a);
  color: var(--input-text, #e0e0e0);
  border: 1px solid var(--border-color, #3a3a3a);
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
  line-height: 1.4;
  outline: none;
  box-sizing: border-box;
  white-space: pre-wrap;
  word-wrap: break-word;
}
.prompt-editor :deep(.comfytv-prompt-prosemirror:focus) {
  border-color: var(--primary-color, #6c8eef);
}
.prompt-editor :deep(p) {
  margin: 0;
}
.prompt-editor :deep(p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: var(--input-text-secondary, #888);
  opacity: 0.65;
  float: left;
  height: 0;
  pointer-events: none;
}
.prompt-editor :deep(.mention-chip) {
  background: rgba(108, 142, 239, 0.18);
  border: 1px solid rgba(108, 142, 239, 0.45);
  border-radius: 4px;
  padding: 0 4px;
  margin: 0 1px;
  color: rgba(140, 170, 255, 1);
  font-weight: 500;
  white-space: nowrap;
}
</style>
