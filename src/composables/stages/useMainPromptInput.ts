import Document    from '@tiptap/extension-document'
import HardBreak   from '@tiptap/extension-hard-break'
import Mention     from '@tiptap/extension-mention'
import Paragraph   from '@tiptap/extension-paragraph'
import Placeholder from '@tiptap/extension-placeholder'
import Text        from '@tiptap/extension-text'
import { useEditor, type JSONContent } from '@tiptap/vue-3'
import { delegate as tippyDelegate } from 'tippy.js'
import { computed, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  imageSendOrder,
  imageSlotFromLabel,
  slotColor,
} from '@/composables/stages/imageSlotMentions'
import { useMentionSuggestion } from '@/composables/stages/useMentionSuggestion'
import type { LGraphNode } from '@/lib/comfyApp'
import { useEntryStore } from '@/stores/entryStore'
import { useProjectStore } from '@/stores/projectStore'
import { useStageStore } from '@/stores/stageStore'
import { getWidget, writeWidget } from '@/utils/widget'

export const ENTRY_CHIP_CLASS = 'mention-chip '
  + 'ctv:inline-block ctv:py-0 ctv:px-1 ctv:mx-px ctv:rounded ctv:font-medium ctv:whitespace-nowrap '
  + 'ctv:bg-primary-background/20 ctv:border ctv:border-primary-background/45 '
  + 'ctv:text-primary-background'

export const IMAGE_CHIP_CLASS = 'mention-chip '
  + 'ctv:inline-block ctv:py-0 ctv:px-1 ctv:mx-px ctv:rounded ctv:font-medium ctv:whitespace-nowrap ctv:border'

export const ENTRY_TOKEN_RE = /@([\p{L}_][\p{L}\p{N}_-]*)/gu

export function textToContent(text: string): JSONContent {
  const content: JSONContent[] = []
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

export interface EntryLike {
  kind: string
  label: string
  content: string
}

export function entryTooltipText(
  label: string,
  node: LGraphNode | undefined,
  entries: EntryLike[],
  t: (key: string, args?: Record<string, unknown>) => string,
): string {
  const slot = imageSlotFromLabel(label)
  if (slot != null) {
    const order = imageSendOrder(node)
    const pos = order.indexOf(slot)
    if (pos < 0) return t('mention.imageTooltipMissing', { n: slot })
    return t('mention.imageItemTitle', {
      n: slot,
      text: t('mention.imageExpand', { n: pos + 1 }),
    })
  }
  const matches = entries.filter(e => e.label === label)
  if (matches.length === 0) {
    return `@${label} — no matching entry (will stay literal at run)`
  }
  if (matches.length === 1) return matches[0].content
  return matches.map(e => `[${e.kind}] ${e.content}`).join('\n──────\n')
}

export function useMainPromptInput(
  getNode: () => LGraphNode | undefined,
  mentionListComponent: Component,
) {
  const { t } = useI18n()
  const entryStore = useEntryStore()
  const projectStore = useProjectStore()
  const stageStore = useStageStore()
  const projectId = computed(() => projectStore.currentProjectId || '')

  const widget = computed(() => getWidget(getNode(), 'main_prompt'))
  const placeholder = computed(() => {
    const w = widget.value as { options?: { placeholder?: string }; placeholder?: string } | undefined
    return w?.options?.placeholder ?? w?.placeholder ?? ''
  })

  const stageState = computed(() => {
    const node = getNode()
    return node ? stageStore.getStage(node) : undefined
  })

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
        renderHTML: ({ node }: any) => {
          const slot = imageSlotFromLabel(String(node.attrs.label ?? ''))
          if (slot != null) {
            const color = slotColor(slot)
            return ['span', {
              class: IMAGE_CHIP_CLASS,
              style: `color:${color};border-color:${color}A6;background-color:${color}2E`,
              'data-mention-id': String(node.attrs.id),
              'data-mention-label': node.attrs.label,
              'data-mention-type': 'imageSlot',
            }, `@${t('mention.imageChip', { n: slot })}`]
          }
          return ['span', {
            class: ENTRY_CHIP_CLASS,
            'data-mention-id': String(node.attrs.id),
            'data-mention-label': node.attrs.label,
            'data-mention-type': 'entry',
          }, `@${node.attrs.label}`]
        },
        suggestion: useMentionSuggestion(projectId, getNode, mentionListComponent),
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
      if (widget.value) writeWidget(getNode(), 'main_prompt', text, { fireCallback: false })
      const st = stageState.value
      if (st && st.mainPrompt !== text) st.mainPrompt = text
    },
  })

  function setContentFromText(text: string): void {
    if (!editor.value) return
    suppressWriteback = true
    try {
      editor.value.commands.setContent(textToContent(text), { emitUpdate: false })
      promptText.value = text
    } finally {
      suppressWriteback = false
    }
  }

  function applyPromptText(text: string): void {
    setContentFromText(text)
    if (widget.value) writeWidget(getNode(), 'main_prompt', text, { fireCallback: false })
    const st = stageState.value
    if (st && st.mainPrompt !== text) st.mainPrompt = text
  }

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
    return entryTooltipText(label, getNode(), entryStore.list(projectId.value), t)
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

  return {
    widget,
    placeholder,
    editor,
    promptText,
    stageState,
    setContentFromText,
    applyPromptText,
    entryTooltip,
  }
}
