import Document    from '@tiptap/extension-document'
import HardBreak   from '@tiptap/extension-hard-break'
import Mention     from '@tiptap/extension-mention'
import Paragraph   from '@tiptap/extension-paragraph'
import Placeholder from '@tiptap/extension-placeholder'
import Text        from '@tiptap/extension-text'
import { Fragment, Slice, type Node as PMNode } from '@tiptap/pm/model'
import { useEditor, type JSONContent } from '@tiptap/vue-3'
import { delegate as tippyDelegate } from 'tippy.js'
import { computed, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  MENTION_TOKEN_RE,
  mentionSendOrderOf,
  mentionSlotFromLabel,
  mentionTokenLabel,
  normalizeMentionText,
  slotColor,
  type MentionOrders,
} from '@/composables/stages/imageSlotMentions'
import {
  nodeMentionSource,
  useMentionSuggestionFromSource,
  type MentionSource,
} from '@/composables/stages/useMentionSuggestion'
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

export const ENTRY_TOKEN_RE = MENTION_TOKEN_RE

export function inlineContentFromText(text: string): JSONContent[] {
  const content: JSONContent[] = []
  let i = 0
  for (const m of text.matchAll(MENTION_TOKEN_RE)) {
    const start = m.index!
    if (start > i) content.push({ type: 'text', text: text.slice(i, start) })
    const label = mentionTokenLabel(m)
    content.push({ type: 'mention', attrs: { id: label, label } })
    i = start + m[0].length
  }
  if (i < text.length) content.push({ type: 'text', text: text.slice(i) })
  return content
}

export function textToContent(text: string): JSONContent {
  const content = inlineContentFromText(text)
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: content.length ? content : undefined }],
  }
}

export function chipifyFragment(fragment: Fragment): Fragment {
  const out: PMNode[] = []
  fragment.forEach((node) => {
    if (node.isText && node.text) {
      const schema = node.type.schema
      const mention = schema.nodes.mention
      if (!mention) { out.push(node); return }
      const text = normalizeMentionText(node.text)
      let last = 0
      for (const m of text.matchAll(ENTRY_TOKEN_RE)) {
        const start = m.index!
        if (start > last) out.push(schema.text(text.slice(last, start), node.marks))
        const label = mentionTokenLabel(m)
        out.push(mention.create({ id: label, label }))
        last = start + m[0].length
      }
      if (last < text.length) out.push(schema.text(text.slice(last), node.marks))
    } else {
      out.push(node.copy(chipifyFragment(node.content)))
    }
  })
  return Fragment.fromArray(out)
}

export interface EntryLike {
  kind: string
  label: string
  content: string
}

export function entryTooltipTextFromOrders(
  label: string,
  orders: MentionOrders,
  entries: EntryLike[],
  t: (key: string, args?: Record<string, unknown>) => string,
): string {
  const parsed = mentionSlotFromLabel(label)
  if (parsed != null) {
    const pos = orders[parsed.type].indexOf(parsed.slot)
    if (pos < 0) return t('mention.imageTooltipMissing', { n: parsed.slot })
    return t('mention.imageItemTitle', {
      n: parsed.slot,
      text: t(`mention.${parsed.type}Expand`, { n: pos + 1 }),
    })
  }
  const matches = entries.filter(e => e.label === label)
  if (matches.length === 0) {
    return `@${label} — no matching entry (will stay literal at run)`
  }
  if (matches.length === 1) return matches[0].content
  return matches.map(e => `[${e.kind}] ${e.content}`).join('\n──────\n')
}

export function entryTooltipText(
  label: string,
  node: LGraphNode | undefined,
  entries: EntryLike[],
  t: (key: string, args?: Record<string, unknown>) => string,
): string {
  return entryTooltipTextFromOrders(label, {
    image: mentionSendOrderOf(node, 'image'),
    video: mentionSendOrderOf(node, 'video'),
    audio: mentionSendOrderOf(node, 'audio'),
  }, entries, t)
}

export interface PromptEditorCoreOpts {
  initialText: string
  placeholder: () => string
  source: () => MentionSource
  mentionList: Component
  onTextChange: (text: string) => void
}

export function usePromptEditorCore(opts: PromptEditorCoreOpts) {
  const { t } = useI18n()
  const entryStore = useEntryStore()
  const projectStore = useProjectStore()
  const projectId = computed(() => projectStore.currentProjectId || '')

  const promptText = ref(opts.initialText)
  let suppressWriteback = false

  const editor = useEditor({
    content: textToContent(opts.initialText),
    extensions: [
      Document,
      Paragraph,
      Text,
      HardBreak,
      Placeholder.configure({
        placeholder: opts.placeholder() || 'Prompt — type @ to insert a saved fragment',
      }),
      Mention.configure({
        renderText: ({ node }) => `@${node.attrs.label}`,
        renderHTML: ({ node }: any) => {
          const parsed = mentionSlotFromLabel(String(node.attrs.label ?? ''))
          if (parsed != null) {
            const color = slotColor(parsed.slot)
            return ['span', {
              class: IMAGE_CHIP_CLASS,
              style: `color:${color};border-color:${color}A6;background-color:${color}2E`,
              'data-mention-id': String(node.attrs.id),
              'data-mention-label': node.attrs.label,
              'data-mention-type': 'imageSlot',
            }, `@${t(`mention.${parsed.type}Chip`, { n: parsed.slot })}`]
          }
          return ['span', {
            class: ENTRY_CHIP_CLASS,
            'data-mention-id': String(node.attrs.id),
            'data-mention-label': node.attrs.label,
            'data-mention-type': 'entry',
          }, `@${node.attrs.label}`]
        },
        suggestion: useMentionSuggestionFromSource(projectId, opts.source, opts.mentionList),
      }),
    ],
    editorProps: {
      transformPasted: (slice: Slice) =>
        new Slice(chipifyFragment(slice.content), slice.openStart, slice.openEnd),
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
      opts.onTextChange(text)
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
    opts.onTextChange(text)
  }

  function entryTooltip(label: string): string {
    return entryTooltipTextFromOrders(
      label, opts.source().orders(), entryStore.list(projectId.value), t)
  }

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

  return { editor, promptText, setContentFromText, applyPromptText, entryTooltip }
}

export function useMainPromptInput(
  getNode: () => LGraphNode | undefined,
  mentionListComponent: Component,
) {
  const stageStore = useStageStore()

  const widget = computed(() => getWidget(getNode(), 'main_prompt'))
  const placeholder = computed(() => {
    const w = widget.value as { options?: { placeholder?: string }; placeholder?: string } | undefined
    return w?.options?.placeholder ?? w?.placeholder ?? ''
  })

  const stageState = computed(() => {
    const node = getNode()
    return node ? stageStore.getStage(node) : undefined
  })

  const core = usePromptEditorCore({
    initialText: String(widget.value?.value ?? ''),
    placeholder: () => placeholder.value,
    source: () => nodeMentionSource(getNode),
    mentionList: mentionListComponent,
    onTextChange: (text) => {
      if (widget.value) writeWidget(getNode(), 'main_prompt', text, { fireCallback: false })
      const st = stageState.value
      if (st && st.mainPrompt !== text) st.mainPrompt = text
    },
  })

  watch(
    () => stageState.value?.mainPrompt,
    (next) => {
      if (next == null) return
      if (!core.editor.value) return
      const current = core.editor.value.getText({ blockSeparator: '\n' })
      if (next === current) return
      core.setContentFromText(next)
    },
  )

  return { widget, placeholder, stageState, ...core }
}
