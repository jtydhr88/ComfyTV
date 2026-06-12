import { computed, nextTick, reactive, ref, watch, type Ref } from 'vue'

import type { Entry } from '@/api/schemas'
import { ENTRY_KINDS, useEntryStore, type EntryKind } from '@/stores/entryStore'
import { isValidLabel } from '@/utils/labelRegex'

import { draftFromEntry, type Draft, type MetaField } from './entryCatalog'

export function useEntryEditor(
  projectId: Ref<string>,
  activeKind: Ref<EntryKind>,
  metaFields: Ref<MetaField[]>,
) {
  const entryStore = useEntryStore()

  const allRows = computed<Entry[]>(() => entryStore.list(projectId.value))
  const rowsByKind = computed<Record<string, Entry[]>>(() => {
    const out: Record<string, Entry[]> = {}
    for (const k of ENTRY_KINDS) out[k] = []
    for (const e of allRows.value) (out[e.kind] ??= []).push(e)
    return out
  })
  const activeRows = computed<Entry[]>(() => rowsByKind.value[activeKind.value] ?? [])

  const drafts = reactive<Record<number, Draft>>({})

  watch(allRows, list => {
    for (const e of list) {
      if (!(e.id in drafts)) drafts[e.id] = draftFromEntry(e)
    }
    for (const id of Object.keys(drafts).map(Number)) {
      if (!list.find(e => e.id === id)) delete drafts[id]
    }
  }, { immediate: true, deep: false })

  async function saveIfDirty(entry: Entry) {
    const d = drafts[entry.id]
    if (!d) return
    if (!isValidLabel(d.label)) return
    const sameLabel = d.label === entry.label
    const sameContent = d.content === entry.content
    const sameMeta = JSON.stringify(d.metadata) === JSON.stringify(entry.metadata)
    if (sameLabel && sameContent && sameMeta) return
    await entryStore.upsert(projectId.value, {
      id: entry.id,
      kind: entry.kind as EntryKind,
      label: d.label,
      content: d.content,
      metadata: d.metadata,
    })
  }

  async function confirmDelete(entry: Entry) {
    if (!window.confirm(
      `Delete @${entry.label}? Existing @${entry.label} tokens will fall back to literal text.`,
    )) return
    await entryStore.remove(projectId.value, entry.id)
  }

  const creating = ref(false)
  const newDraft = reactive<Draft>({ label: '', content: '', metadata: {} })
  const newLabelInput = ref<HTMLInputElement | null>(null)

  const newLabelError = computed(() => {
    if (!newDraft.label) return ''
    if (!isValidLabel(newDraft.label)) {
      return '以字母 / 下划线开头(支持中文),后跟字母 / 数字 / _ / - / Letters or _ first, then letters / digits / _ / -'
    }
    return ''
  })
  const canSaveNew = computed(
    () => isValidLabel(newDraft.label) && !!newDraft.content.trim(),
  )

  function startCreate() {
    creating.value = true
    newDraft.label = ''
    newDraft.content = ''
    newDraft.metadata = {}
    for (const f of metaFields.value) newDraft.metadata[f.name] = ''
    void nextTick(() => newLabelInput.value?.focus())
  }

  function cancelCreate() {
    creating.value = false
    newDraft.label = ''
    newDraft.content = ''
    newDraft.metadata = {}
  }

  async function saveNew() {
    if (!canSaveNew.value) return
    await entryStore.upsert(projectId.value, {
      kind: activeKind.value,
      label: newDraft.label,
      content: newDraft.content.trim(),
      metadata: { ...newDraft.metadata },
    })
    cancelCreate()
  }

  function kickHydrate() {
    void entryStore.list(projectId.value)
  }

  return {
    allRows, rowsByKind, activeRows,
    drafts,
    saveIfDirty, confirmDelete,
    creating, newDraft, newLabelInput,
    newLabelError, canSaveNew,
    startCreate, cancelCreate, saveNew,
    kickHydrate,
  }
}
