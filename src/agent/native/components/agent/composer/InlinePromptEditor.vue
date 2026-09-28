<script setup lang="ts">
import type { Node } from '@tiptap/pm/model'
import { DOMParser, Fragment, Slice } from '@tiptap/pm/model'
import { baseKeymap } from '@tiptap/pm/commands'
import { closeHistory, history, redo, undo } from '@tiptap/pm/history'
import { keymap } from '@tiptap/pm/keymap'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view'
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import { default as DOMPurify } from 'dompurify'
import { useI18n } from 'vue-i18n'

import type { ComposerPrompt } from '../../../types/composerPrompt'
import {
  composerReferenceKey,
  composerReferenceName
} from '../../../types/composerPrompt'
import { sameComposerReferenceOrder } from '../../../utils/composerPrompt'
import {
  assetReferenceText,
  nodeReferenceText
} from '../../../utils/agentMessageText'
import { selectedNodeKey } from '../../../composables/agent/useCanvasSelection'
import type { PromptEditor } from '../../../types/promptEditor'
import type { WorkflowReferenceMetadata } from '../../../types/workflowReference'
import {
  inlinePromptSchema,
  promptDocument,
  promptDocumentPosition,
  promptInsertionPoint,
  promptNodeReference,
  promptDraft,
  promptTextOffset
} from './inlinePrompt'

defineOptions({ inheritAttrs: false })
const {
  label,
  expanded = false,
  activeDescendant,
  historyEpoch = 0,
  editableWorkflowId
} = defineProps<{
  label: string
  expanded?: boolean
  activeDescendant?: string
  historyEpoch?: number
  editableWorkflowId?: string
}>()
const model = defineModel<ComposerPrompt>({
  default: () => ({ text: '', references: [] })
})
const emit = defineEmits<{
  input: []
  selectionChange: []
  keydown: [event: KeyboardEvent]
  keyup: [event: KeyboardEvent]
  click: []
  blur: []
  openReferenceWorkflow: [id: string, name: string]
  removeWorkflowReference: [id: string]
  removeNodeReference: [id: string]
}>()
const { t } = useI18n()
const host = useTemplateRef<HTMLDivElement>('host')
let view: EditorView | undefined
const insertions = new Set<{ from: number; to: number }>()
const plugins = [
  history(),
  keymap({
    'Mod-z': undo,
    'Mod-Shift-z': redo,
    'Mod-y': redo,
    'Shift-Enter': (state, dispatch) => {
      dispatch?.(state.tr.insertText('\n').scrollIntoView())
      return true
    }
  }),
  keymap(baseKeymap)
]

function createState(): EditorState {
  return EditorState.create({
    doc: promptDocument(model.value),
    plugins
  })
}

function deleteReference(state: EditorState, position: number, node: Node) {
  const end = position + node.nodeSize
  const padding = state.doc.nodeAt(end)?.text?.startsWith(' ') ? 1 : 0
  return state.tr.delete(position, end + padding)
}

function referenceClipboardText(node: Node): string {
  const reference = promptNodeReference(node, 0)
  if (!reference) return ''
  const name = composerReferenceName(reference)
  if (reference.kind === 'workflow') return `@[Workflow: ${name}]`
  return reference.kind === 'node'
    ? nodeReferenceText(name)
    : assetReferenceText(name)
}

function passiveReferenceView(node: Node, iconClass: string) {
  const dom = document.createElement('span')
  const reference = promptNodeReference(node, 0)
  if (!reference) return { dom }
  dom.contentEditable = 'false'
  dom.dataset.testid = `${reference.kind}-reference-chip`
  dom.className =
    'ctv:inline ctv:rounded-sm ctv:bg-primary-background/30 ctv:box-decoration-clone ctv:px-1 ctv:py-0.5 ctv:font-inter ctv:text-xs/[15px] ctv:font-normal ctv:break-all ctv:whitespace-normal ctv:text-primary-background-hover ctv:ring-1 ctv:ring-primary-background/30 ctv:ring-inset [&.ProseMirror-selectednode]:outline-1'
  const icon = document.createElement('span')
  icon.className = `${iconClass} ctv:mr-1 ctv:inline-block ctv:size-3 ctv:align-middle`
  icon.setAttribute('aria-hidden', 'true')
  const label = document.createElement('span')
  label.textContent = composerReferenceName(reference)
  dom.append(icon, label)
  return { dom, ignoreMutation: () => true }
}

onMounted(() => {
  if (!host.value) return
  view = new EditorView(host.value, {
    state: createState(),
    attributes: () => ({
      role: 'textbox',
      'aria-label': label,
      'aria-multiline': 'true',
      'aria-expanded': String(expanded),
      'aria-controls': 'agent-reference-menu',
      ...(activeDescendant
        ? { 'aria-activedescendant': activeDescendant }
        : {}),
      class:
        'ctv:text-base-foreground ctv:min-h-7 ctv:w-full ctv:cursor-text ctv:font-inter ctv:text-[14px]/5 ctv:font-normal ctv:wrap-anywhere ctv:whitespace-pre-wrap ctv:outline-none'
    }),
    decorations(state) {
      if (state.selection.empty) return null
      const decorations: Decoration[] = []
      state.doc.nodesBetween(
        state.selection.from,
        state.selection.to,
        (node, position) => {
          if (node.type === inlinePromptSchema.nodes.workflow)
            decorations.push(
              Decoration.node(position, position + node.nodeSize, {
                'data-selected': 'true'
              })
            )
        }
      )
      return DecorationSet.create(state.doc, decorations)
    },
    dispatchTransaction(transaction) {
      if (!view) return
      const previousReferences = promptDraft(view.state.doc).references
      const nextReferences = promptDraft(transaction.doc).references
      if (
        previousReferences.length !== nextReferences.length ||
        previousReferences.some(
          (reference, index) =>
            composerReferenceKey(reference) !==
            composerReferenceKey(nextReferences[index])
        )
      )
        closeHistory(transaction)
      for (const insertion of insertions) {
        const collapsed = insertion.from === insertion.to
        insertion.from = transaction.mapping.map(insertion.from, 1)
        insertion.to = Math.max(
          insertion.from,
          transaction.mapping.map(insertion.to, collapsed ? 1 : -1)
        )
      }
      view.updateState(view.state.apply(transaction))
      if (transaction.docChanged) {
        const draft = promptDraft(view.state.doc)
        model.value = draft
        for (const previous of previousReferences) {
          if (
            draft.references.some(
              (reference) =>
                composerReferenceKey(reference) ===
                composerReferenceKey(previous)
            )
          )
            continue
          if (previous.kind === 'workflow')
            emit('removeWorkflowReference', previous.id)
          if (previous.kind === 'node')
            emit('removeNodeReference', selectedNodeKey(previous.node))
        }
        emit('input')
      }
      if (transaction.selectionSet || transaction.docChanged)
        emit('selectionChange')
    },
    handleKeyDown(editor, event) {
      emit('keydown', event)
      if (
        !event.defaultPrevented &&
        !event.isComposing &&
        editor.state.selection.empty
      ) {
        const { $from, from } = editor.state.selection
        const adjacent =
          event.key === 'Backspace'
            ? $from.nodeBefore
            : event.key === 'Delete'
              ? $from.nodeAfter
              : null
        if (adjacent?.isAtom && !adjacent.isText) {
          const start =
            event.key === 'Backspace' ? from - adjacent.nodeSize : from
          editor.dispatch(
            deleteReference(editor.state, start, adjacent).scrollIntoView()
          )
          event.preventDefault()
        }
      }
      return event.defaultPrevented
    },
    handleDOMEvents: {
      dragenter: () => true,
      dragover: () => true,
      drop: () => true,
      keyup: (_view, event) => {
        emit('keyup', event)
        return false
      },
      click: () => {
        emit('click')
        return false
      },
      blur: () => {
        emit('blur')
        return false
      }
    },
    transformPastedHTML: (html) => DOMPurify.sanitize(html),
    handlePaste(editor, event, slice) {
      const clipboard = event.clipboardData
      if (!clipboard) return false
      const text = clipboard.getData('text/plain')
      const { state } = editor
      const hasWorkflows = slice.content.content.some(
        (node) => node.type === inlinePromptSchema.nodes.workflow
      )
      if (!hasWorkflows) {
        editor.dispatch(state.tr.insertText(text).scrollIntoView())
        return true
      }
      const usedIds = new Set([editableWorkflowId])
      state.doc.forEach((node, position) => {
        if (
          node.type === inlinePromptSchema.nodes.workflow &&
          (position < state.selection.from || position >= state.selection.to)
        )
          usedIds.add(node.attrs.id)
      })
      // The default clipboard parser collapses whitespace in inline slices.
      const pasted = DOMParser.fromSchema(inlinePromptSchema).parseSlice(
        DOMPurify.sanitize(clipboard.getData('text/html'), {
          RETURN_DOM_FRAGMENT: true
        }),
        { preserveWhitespace: 'full' }
      )
      const content = pasted.content.content.map((node) => {
        if (node.type !== inlinePromptSchema.nodes.workflow) return node
        if (usedIds.has(node.attrs.id))
          return inlinePromptSchema.text(referenceClipboardText(node))
        usedIds.add(node.attrs.id)
        return node
      })
      editor.dispatch(
        state.tr
          .replaceSelection(new Slice(Fragment.from(content), 0, 0))
          .setMeta('paste', true)
          .setMeta('uiEvent', 'paste')
          .scrollIntoView()
      )
      return true
    },
    clipboardTextSerializer: (slice) =>
      slice.content.textBetween(0, slice.content.size, '', (node) =>
        referenceClipboardText(node)
      ),
    nodeViews: {
      node: (node) => passiveReferenceView(node, 'ctv:icon-[comfy--node]'),
      asset: (node) => passiveReferenceView(node, 'ctv:icon-[lucide--paperclip]'),
      workflow(node, editor, getPos) {
        const id: unknown = node.attrs.id
        const name: unknown = node.attrs.name
        const dom = document.createElement('span')
        if (typeof id !== 'string' || typeof name !== 'string') return { dom }
        dom.contentEditable = 'false'
        dom.dataset.testid = 'workflow-reference-chip'
        dom.className =
          'group/workflow ctv:inline ctv:selection:bg-transparent ctv:selection:text-inherit'
        const open = document.createElement('span')
        open.setAttribute('role', 'button')
        open.tabIndex = 0
        const unavailable = node.attrs.unavailable === true
        open.setAttribute(
          'aria-label',
          t(
            unavailable
              ? 'agent.unavailableWorkflowReference'
              : 'agent.openWorkflowTab',
            { name }
          )
        )
        if (unavailable) {
          const reason = t('agent.workflowReferenceUnavailableReason')
          open.setAttribute('aria-disabled', 'true')
          open.setAttribute('aria-description', reason)
          open.title = reason
        }
        open.className =
          'ctv:inline ctv:cursor-pointer ctv:rounded-sm ctv:bg-primary-background/30 ctv:box-decoration-clone ctv:px-1 ctv:py-0.5 ctv:font-inter ctv:text-xs/[15px] ctv:font-normal ctv:break-all ctv:whitespace-normal ctv:text-primary-background-hover ctv:ring-1 ctv:ring-primary-background/30 ctv:transition-colors ctv:ring-inset ctv:group-data-selected/workflow:bg-primary-background/60 ctv:group-data-selected/workflow:text-base-foreground ctv:group-data-selected/workflow:ring-primary-background ctv:hover:bg-primary-background/40 ctv:group-data-selected/workflow:hover:bg-primary-background/60 ctv:focus-visible:outline-2 ctv:focus-visible:outline-offset-2 ctv:focus-visible:outline-primary-background ctv:aria-disabled:cursor-not-allowed ctv:aria-disabled:opacity-50'
        const icon = document.createElement('span')
        icon.className =
          'ctv:icon-[comfy--workflow] ctv:mr-1 ctv:inline-block ctv:size-3 ctv:align-middle'
        const title = document.createElement('span')
        title.textContent = name
        open.append(icon, title)
        open.onclick = () => {
          if (!unavailable) emit('openReferenceWorkflow', id, name)
        }
        open.onkeydown = (event) => {
          if (event.key === 'Enter' || event.key === ' ') event.preventDefault()
          if (event.key === 'Enter') open.click()
        }
        open.onkeyup = (event) => {
          if (event.key !== ' ') return
          event.preventDefault()
          open.click()
        }
        const removeAnchor = document.createElement('span')
        removeAnchor.className = 'ctv:relative ctv:inline-block ctv:h-4 ctv:w-0 ctv:align-middle'
        const remove = document.createElement('button')
        remove.type = 'button'
        remove.setAttribute(
          'aria-label',
          t('agent.removeWorkflowReference', { name })
        )
        remove.className =
          'ctv:text-base-foreground ctv:pointer-events-none ctv:absolute ctv:-top-2 ctv:-right-2 ctv:z-10 ctv:flex ctv:size-5 ctv:cursor-pointer ctv:items-center ctv:justify-center ctv:rounded-full ctv:p-0 ctv:opacity-0 ctv:transition-opacity ctv:group-focus-within/workflow:pointer-events-auto ctv:group-focus-within/workflow:opacity-100 ctv:group-hover/workflow:pointer-events-auto ctv:group-hover/workflow:opacity-100 ctv:focus-visible:outline-2 ctv:focus-visible:outline-primary-background ctv:touch:pointer-events-auto ctv:touch:opacity-100'
        const badge = document.createElement('span')
        badge.className =
          'ctv:bg-base-background ctv:hover:bg-secondary-background-hover ctv:flex ctv:size-3 ctv:items-center ctv:justify-center ctv:rounded-full ctv:ring-1 ctv:ring-border-default'
        const cross = document.createElement('span')
        cross.className = 'ctv:icon-[lucide--x] ctv:size-2'
        badge.append(cross)
        remove.append(badge)
        remove.onclick = () => {
          const position = getPos()
          if (position === undefined) return
          editor.dispatch(deleteReference(editor.state, position, node))
        }
        removeAnchor.append(remove)
        dom.append(open, removeAnchor)
        return { dom, stopEvent: () => true, ignoreMutation: () => true }
      }
    }
  })
})

watch(
  [model, () => historyEpoch],
  ([next, epoch], [, previousEpoch]) => {
    if (!view) return
    const doc = promptDocument(next)
    if (epoch !== previousEpoch) {
      insertions.clear()
      const state = createState()
      const position = Math.min(view.state.selection.head, doc.content.size)
      view.updateState(
        state.apply(
          state.tr.setSelection(TextSelection.create(state.doc, position))
        )
      )
      emit('selectionChange')
      return
    }
    const start = view.state.doc.content.findDiffStart(doc.content)
    if (start === null) return
    const end = view.state.doc.content.findDiffEnd(doc.content)
    if (!end) return
    const overlap = Math.max(0, start - Math.min(end.a, end.b))
    const before = promptDraft(view.state.doc)
    const metadataOnly =
      before.text === next.text && sameComposerReferenceOrder(before, next)
    const transaction = view.state.tr.replace(
      start,
      end.a + overlap,
      doc.slice(start, end.b + overlap)
    )
    view.dispatch(
      closeHistory(transaction.setMeta('addToHistory', !metadataOnly))
    )
  },
  { flush: 'post', deep: true }
)

watch(
  () => [label, expanded, activeDescendant],
  () => view?.setProps({})
)
onBeforeUnmount(() => {
  insertions.clear()
  view?.destroy()
  view = undefined
})

function selection() {
  if (!view) return { start: 0, end: 0 }
  return {
    start: promptTextOffset(view.state.doc, view.state.selection.from),
    end: promptTextOffset(view.state.doc, view.state.selection.to)
  }
}

function replaceText(from: number, to: number, text: string): void {
  if (!view) return
  view.dispatch(
    view.state.tr.insertText(
      text,
      promptDocumentPosition(view.state.doc, from),
      promptDocumentPosition(view.state.doc, to)
    )
  )
}

function captureInsertion(from?: number, to?: number) {
  const insertion = {
    from: view
      ? from === undefined
        ? view.state.selection.from
        : promptDocumentPosition(view.state.doc, from)
      : 0,
    to: view
      ? to === undefined
        ? view.state.selection.to
        : promptDocumentPosition(view.state.doc, to)
      : 0
  }
  insertions.add(insertion)
  return {
    insert(reference: WorkflowReferenceMetadata) {
      if (!view || !insertions.delete(insertion)) return
      const node = inlinePromptSchema.nodes.workflow.create({
        id: reference.id,
        name: reference.name
      })
      const transaction = view.state.tr.replaceWith(
        insertion.from,
        insertion.to,
        node
      )
      const afterChip = insertion.from + node.nodeSize
      if (!transaction.doc.nodeAt(afterChip)?.text?.startsWith(' '))
        transaction.insertText(' ', afterChip)
      view.dispatch(
        transaction
          .setSelection(TextSelection.create(transaction.doc, afterChip + 1))
          .scrollIntoView()
      )
      view.focus()
    },
    cancel: () => insertions.delete(insertion)
  }
}

defineExpose({
  insertionPoint: () =>
    view
      ? promptInsertionPoint(view.state.doc, view.state.selection.head)
      : { textOffset: 0, referenceIndex: 0 },
  focus: () => view?.focus(),
  selection,
  replaceText,
  captureInsertion
} satisfies PromptEditor)
</script>

<template>
  <div ref="host" @copy.stop @cut.stop @paste.stop />
</template>
