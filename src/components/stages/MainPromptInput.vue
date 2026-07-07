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

import type { CameraSelection } from '@/composables/stages/cameraControlCatalog'
import { CAMERA_BUILDER } from '@/composables/stages/promptModules/builders'
import { useMentionSuggestion } from '@/composables/stages/useMentionSuggestion'
import { usePromptModules } from '@/composables/stages/usePromptModules'
import type { LGraphNode } from '@/lib/comfyApp'
import { useEntryStore } from '@/stores/entryStore'
import { useProjectStore } from '@/stores/projectStore'
import { useStageStore } from '@/stores/stageStore'
import { getWidget, writeWidget } from '@/utils/widget'

import CameraPromptPanel from './CameraPromptPanel.vue'
import MentionList from './MentionList.vue'
import PromptHelperPanel from './PromptHelperPanel.vue'

const props = defineProps<{ node?: LGraphNode }>()

const entryStore = useEntryStore()
const projectStore = useProjectStore()
const stageStore = useStageStore()
const projectId = computed(() => projectStore.currentProjectId || '')

const widget = computed(() => getWidget(props.node, 'main_prompt'))
const placeholder = computed(() => {
  const w = widget.value as { options?: { placeholder?: string }; placeholder?: string } | undefined
  return w?.options?.placeholder ?? w?.placeholder ?? ''
})

const rootEl = ref<HTMLElement | null>(null)

const ENTRY_CHIP_CLASS = 'mention-chip '
  + 'ctv:inline-block ctv:py-0 ctv:px-1 ctv:mx-px ctv:rounded ctv:font-medium ctv:whitespace-nowrap '
  + 'ctv:bg-primary-background/20 ctv:border ctv:border-primary-background/45 '
  + 'ctv:text-primary-background'

const ENTRY_TOKEN_RE = /@([\p{L}_][\p{L}\p{N}_-]*)/gu

function textToContent(text: string): any {
  const content: any[] = []
  let i = 0
  for (const m of text.matchAll(ENTRY_TOKEN_RE)) {
    const start = m.index!
    if (start > i) content.push({ type: 'text', text: text.slice(i, start) })
    const label = m[1]
    content.push({ type: 'mention', attrs: { id: label, label } })
    i = start + m[0].length
  }
  if (i < text.length) content.push({ type: 'text', text: text.slice(i) })
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: content.length ? content : undefined }],
  }
}

const initialText = String(widget.value?.value ?? '')
const promptText = ref(initialText)
let suppressWriteback = false

const editor = useEditor({
  content: textToContent(initialText),
  extensions: [
    Document,
    Paragraph,
    Text,
    HardBreak,
    Placeholder.configure({
      placeholder: placeholder.value || 'Prompt — type @ to insert a saved fragment',
    }),
    Mention.configure({
      renderText: ({ node }) => `@${node.attrs.label}`,
      renderHTML: ({ node }: any) => ['span', {
        class: ENTRY_CHIP_CLASS,
        'data-mention-id': String(node.attrs.id),
        'data-mention-label': node.attrs.label,
        'data-mention-type': 'entry',
      }, `@${node.attrs.label}`],
      suggestion: useMentionSuggestion(projectId, MentionList),
    }),
  ],
  editorProps: {
    attributes: {
      class: 'comfytv-prompt-prosemirror'
           + ' ctv:min-h-11 ctv:max-h-80 ctv:overflow-y-scroll ctv:py-1.5 ctv:px-2 ctv:rounded'
           + ' ctv:bg-secondary-background'
           + ' ctv:text-base-foreground'
           + ' ctv:border ctv:border-border-default'
           + ' ctv:focus:border-primary-background'
           + ' ctv:text-xs ctv:leading-snug ctv:[font-family:inherit] ctv:outline-none ctv:box-border'
           + ' ctv:whitespace-pre-wrap ctv:break-words',
      spellcheck: 'false',
    },
  },
  onUpdate: ({ editor }) => {
    if (suppressWriteback) return
    const text = editor.getText({ blockSeparator: '\n' })
    promptText.value = text
    if (widget.value) writeWidget(props.node, 'main_prompt', text, { fireCallback: false })
    const st = stageState.value
    if (st && st.mainPrompt !== text) st.mainPrompt = text
  },
})

function setContentFromText(text: string) {
  if (!editor.value) return
  suppressWriteback = true
  try {
    editor.value.commands.setContent(textToContent(text), { emitUpdate: false })
    promptText.value = text
  } finally {
    suppressWriteback = false
  }
}

function applyPromptText(text: string) {
  setContentFromText(text)
  if (widget.value) writeWidget(props.node, 'main_prompt', text, { fireCallback: false })
  const st = stageState.value
  if (st && st.mainPrompt !== text) st.mainPrompt = text
}

const helperOpen = ref(false)
const helper = usePromptModules(() => promptText.value, applyPromptText)

const cameraOpen = ref(false)
function onCameraInsert(selection: CameraSelection) {
  helper.apply(CAMERA_BUILDER, selection as Record<string, string>)
}

const iconBtnClass = 'ctv:inline-flex ctv:items-center ctv:justify-center ctv:size-5 ctv:cursor-pointer'
  + ' ctv:rounded-sm ctv:border ctv:text-2xs ctv:leading-none ctv:[font-family:inherit] ctv:transition-colors'

const stageState = computed(() => props.node ? stageStore.getStage(props.node) : undefined)

watch(
  () => stageState.value?.mainPrompt,
  (next) => {
    if (next == null) return
    if (!editor.value) return
    const current = editor.value.getText({ blockSeparator: '\n' })
    if (next === current) return
    setContentFromText(next)
  },
)

let chipTooltips: any = null

function stopBubble(e: Event) { e.stopPropagation() }

function entryTooltip(label: string): string {
  const matches = entryStore.list(projectId.value).filter(e => e.label === label)
  if (matches.length === 0) {
    return `@${label} — no matching entry (will stay literal at run)`
  }
  if (matches.length === 1) return matches[0].content
  return matches.map(e => `[${e.kind}] ${e.content}`).join('\n──────\n')
}

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
        return entryTooltip(label)
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
