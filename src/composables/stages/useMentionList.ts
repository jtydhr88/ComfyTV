import { computed, ref, watch } from 'vue'

import { imageSlotLabel } from '@/composables/stages/imageSlotMentions'
import type { MentionSuggestionItem } from '@/composables/stages/useMentionSuggestion'
import { useListKeyboardNav } from '@/composables/useListKeyboardNav'
import { useEntryStore } from '@/stores/entryStore'
import { useProjectStore } from '@/stores/projectStore'
import { LABEL_RE } from '@/utils/labelRegex'

export interface MentionCommandAttrs {
  id: number | string
  label: string
  mentionType?: 'entry' | 'imageSlot'
}

export function mentionItemKey(item: MentionSuggestionItem): string {
  return item.type === 'imageSlot' ? imageSlotLabel(item.slot) : item.module.id
}

export interface MentionListOptions {
  items: () => MentionSuggestionItem[]
  query: () => string
  command: (attrs: MentionCommandAttrs) => void
  focusCreate?: () => void
}

export function useMentionList(opts: MentionListOptions) {
  const entryStore = useEntryStore()
  const projectStore = useProjectStore()

  const imageItems = computed(() =>
    opts.items().filter((it): it is Extract<MentionSuggestionItem, { type: 'imageSlot' }> =>
      it.type === 'imageSlot'))
  const snippetItems = computed(() =>
    opts.items().filter((it): it is Extract<MentionSuggestionItem, { type: 'snippet' }> =>
      it.type === 'snippet'))

  const canCreate = computed(() => !!opts.query() && LABEL_RE.test(opts.query()))

  const nav = useListKeyboardNav(() => opts.items().length + (canCreate.value ? 1 : 0))
  const activeIndex = nav.activeIndex

  watch(() => opts.items(), nav.reset)
  watch(() => opts.query(), nav.reset)

  const creating = ref(false)
  const pendingLabel = ref('')
  const pendingContent = ref('')

  function startCreate(): void {
    pendingLabel.value = opts.query()
    pendingContent.value = ''
    creating.value = true
    opts.focusCreate?.()
  }

  function cancelCreate(): void {
    creating.value = false
    pendingLabel.value = ''
    pendingContent.value = ''
  }

  async function saveCreate(): Promise<void> {
    const content = pendingContent.value.trim()
    if (!content) return
    const row = await entryStore.upsert(projectStore.currentProjectId || '', {
      kind: 'fragment',
      label: pendingLabel.value,
      content,
    })
    creating.value = false
    pendingContent.value = ''
    if (row) {
      opts.command({ id: row.id, label: row.label, mentionType: 'entry' })
    }
  }

  function onCreateKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') { cancelCreate(); return }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void saveCreate()
    }
  }

  function selectItem(index: number): void {
    const ordered = [...imageItems.value, ...snippetItems.value]
    if (index < ordered.length) {
      const item = ordered[index]
      if (!item) return
      if (item.type === 'imageSlot') {
        const label = imageSlotLabel(item.slot)
        opts.command({ id: label, label, mentionType: 'imageSlot' })
        return
      }
      const label = item.module.label ?? ''
      opts.command({ id: label, label, mentionType: 'entry' })
    } else if (canCreate.value) {
      startCreate()
    }
  }

  function onKeyDown(event: KeyboardEvent): boolean {
    if (creating.value) return event.key === 'Escape'
    return nav.onKeyDown(event, selectItem)
  }

  return {
    imageItems,
    snippetItems,
    canCreate,
    activeIndex,
    creating,
    pendingLabel,
    pendingContent,
    startCreate,
    cancelCreate,
    saveCreate,
    onCreateKeydown,
    selectItem,
    onKeyDown,
  }
}
