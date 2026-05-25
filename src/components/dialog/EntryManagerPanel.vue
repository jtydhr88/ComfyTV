<template>
  <div class="entry-manager">
    <p class="entry-hint">
      Reference any entry in a stage's prompt with <code>@label</code>. Unknown tokens stay literal.
    </p>

    <div v-if="ENTRY_KINDS.length > 1" class="tabs">
      <button
        v-for="k in ENTRY_KINDS"
        :key="k"
        class="tab"
        :class="{ active: activeKind === k }"
        @click="activeKind = k"
      >
        {{ KIND_LABELS[k] }}
        <span class="tab-count">{{ rowsByKind[k]?.length ?? 0 }}</span>
      </button>
    </div>

    <table class="entry-table">
      <thead>
        <tr>
          <th class="col-label">Label</th>
          <th>Content</th>
          <th v-for="f in metaFields" :key="f.name" class="col-meta">
            {{ f.label }}
          </th>
          <th class="col-actions"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in activeRows" :key="entry.id">
          <td class="col-label">
            <input
              v-model="drafts[entry.id].label"
              class="label-input"
              :class="{ invalid: !isValidLabel(drafts[entry.id].label) }"
              @blur="saveIfDirty(entry)"
              @keydown.ctrl.enter.prevent="saveIfDirty(entry)"
              @keydown.meta.enter.prevent="saveIfDirty(entry)"
            />
          </td>
          <td>
            <textarea
              v-model="drafts[entry.id].content"
              class="content-textarea"
              rows="2"
              @blur="saveIfDirty(entry)"
              @keydown.ctrl.enter.prevent="saveIfDirty(entry)"
              @keydown.meta.enter.prevent="saveIfDirty(entry)"
            />
          </td>
          <td v-for="f in metaFields" :key="f.name" class="col-meta">
            <textarea
              v-if="f.type === 'textarea'"
              v-model="drafts[entry.id].metadata[f.name]"
              class="meta-textarea"
              rows="2"
              @blur="saveIfDirty(entry)"
            />
            <input
              v-else
              v-model="drafts[entry.id].metadata[f.name]"
              class="meta-input"
              :placeholder="f.placeholder ?? ''"
              @blur="saveIfDirty(entry)"
            />
          </td>
          <td class="col-actions">
            <button class="del-btn" :title="`Delete @${entry.label}`" @click="confirmDelete(entry)">🗑</button>
          </td>
        </tr>

        <tr v-if="activeRows.length === 0 && !creating" class="empty-row">
          <td :colspan="3 + metaFields.length">
            No {{ KIND_LABELS[activeKind].toLowerCase() }} yet. Click <strong>+ Add</strong> below.
          </td>
        </tr>

        <tr v-if="creating" class="create-row">
          <td class="col-label">
            <input
              ref="newLabelInput"
              v-model="newDraft.label"
              class="label-input"
              :class="{ invalid: !!newLabelError }"
              :title="newLabelError"
              placeholder="label"
              @keydown.escape="cancelCreate"
            />
          </td>
          <td>
            <textarea
              v-model="newDraft.content"
              class="content-textarea"
              rows="2"
              :placeholder="newContentPlaceholder"
              @keydown.escape="cancelCreate"
              @keydown.ctrl.enter.prevent="saveNew"
              @keydown.meta.enter.prevent="saveNew"
            />
          </td>
          <td v-for="f in metaFields" :key="f.name" class="col-meta">
            <textarea
              v-if="f.type === 'textarea'"
              v-model="newDraft.metadata[f.name]"
              class="meta-textarea"
              rows="2"
              :placeholder="f.placeholder ?? ''"
            />
            <input
              v-else
              v-model="newDraft.metadata[f.name]"
              class="meta-input"
              :placeholder="f.placeholder ?? ''"
            />
          </td>
          <td class="col-actions">
            <button class="btn-mini btn-save" :disabled="!canSaveNew" @click="saveNew">Save</button>
            <button class="btn-mini" @click="cancelCreate">Cancel</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <button v-if="!creating" class="btn-add" @click="startCreate">
        + Add {{ KIND_LABELS[activeKind].slice(0, -1).toLowerCase() }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'

import type { Entry } from '@/api/schemas'
import { useProjectStore } from '@/stores/projectStore'
import { ENTRY_KINDS, useEntryStore, type EntryKind } from '@/stores/entryStore'

interface MetaField {
  name: string
  label: string
  type: 'text' | 'textarea'
  placeholder?: string
}

const KIND_LABELS: Record<EntryKind, string> = {
  fragment: 'Fragments',
}

const KIND_META_FIELDS: Record<EntryKind, MetaField[]> = {
  fragment: [],
}

const KIND_CONTENT_PLACEHOLDER: Record<EntryKind, string> = {
  fragment: 'Content this @-token expands to',
}

const entryStore = useEntryStore()
const projectStore = useProjectStore()
const projectId = computed(() => projectStore.currentProjectId || '')

const activeKind = ref<EntryKind>('fragment')

const allRows = computed<Entry[]>(() => entryStore.list(projectId.value))
const rowsByKind = computed<Record<string, Entry[]>>(() => {
  const out: Record<string, Entry[]> = {}
  for (const k of ENTRY_KINDS) out[k] = []
  for (const e of allRows.value) (out[e.kind] ??= []).push(e)
  return out
})
const activeRows = computed<Entry[]>(() => rowsByKind.value[activeKind.value] ?? [])
const metaFields = computed<MetaField[]>(() => KIND_META_FIELDS[activeKind.value])
const newContentPlaceholder = computed(() => KIND_CONTENT_PLACEHOLDER[activeKind.value])

interface Draft { label: string; content: string; metadata: Record<string, any> }
const drafts = reactive<Record<number, Draft>>({})

watch(allRows, list => {
  for (const e of list) {
    if (!(e.id in drafts)) {
      drafts[e.id] = {
        label: e.label,
        content: e.content,
        metadata: { ...e.metadata },
      }
    }
  }
  for (const id of Object.keys(drafts).map(Number)) {
    if (!list.find(e => e.id === id)) delete drafts[id]
  }
}, { immediate: true, deep: false })

const LABEL_RE = /^[\p{L}_][\p{L}\p{N}_-]*$/u
function isValidLabel(s: string): boolean { return LABEL_RE.test(s) }

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
  if (!window.confirm(`Delete @${entry.label}? Existing @${entry.label} tokens will fall back to literal text.`)) return
  await entryStore.remove(projectId.value, entry.id)
}

const creating = ref(false)
const newDraft = reactive<Draft>({ label: '', content: '', metadata: {} })
const newLabelInput = ref<HTMLInputElement | null>(null)

const newLabelError = computed(() => {
  if (!newDraft.label) return ''
  if (!isValidLabel(newDraft.label)) return '以字母 / 下划线开头(支持中文),后跟字母 / 数字 / _ / - / Letters or _ first, then letters / digits / _ / -'
  return ''
})
const canSaveNew = computed(() =>
  isValidLabel(newDraft.label) && !!newDraft.content.trim(),
)

function startCreate() {
  creating.value = true
  newDraft.label = ''
  newDraft.content = ''
  newDraft.metadata = {}
  for (const f of metaFields.value) newDraft.metadata[f.name] = ''
  nextTick(() => newLabelInput.value?.focus())
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

onMounted(() => { void entryStore.list(projectId.value) })
</script>

<style scoped>
.entry-manager {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.entry-hint {
  margin: 0 0 4px;
  font-size: 11px;
  color: var(--input-text-secondary, #aaa);
}
.entry-hint code {
  background: rgba(108, 142, 239, 0.18);
  border: 1px solid rgba(108, 142, 239, 0.45);
  padding: 0 4px;
  border-radius: 3px;
  color: rgba(140, 170, 255, 1);
  font-family: ui-monospace, monospace;
}

.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border-color, #2a2a2a);
}
.tab {
  padding: 6px 12px;
  background: transparent;
  border: 1px solid transparent;
  border-bottom: 0;
  border-radius: 4px 4px 0 0;
  color: var(--input-text-secondary, #aaa);
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.tab:hover { color: var(--input-text, #e0e0e0); }
.tab.active {
  background: var(--comfy-input-bg, #1a1a1a);
  border-color: var(--border-color, #3a3a3a);
  color: var(--input-text, #e0e0e0);
  margin-bottom: -1px;
}
.tab-count {
  background: rgba(255, 255, 255, 0.08);
  padding: 0 6px;
  border-radius: 8px;
  font-size: 10px;
}

.entry-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.entry-table th,
.entry-table td {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-color, #2a2a2a);
  vertical-align: top;
}
.entry-table th {
  font-weight: 600;
  color: var(--input-text-secondary, #aaa);
}
.col-label { width: 140px; }
.col-meta  { width: 180px; }
.col-actions {
  width: 96px;
  text-align: right;
  white-space: nowrap;
}

.label-input, .content-textarea, .meta-input, .meta-textarea {
  width: 100%;
  background: var(--comfy-input-bg, #1a1a1a);
  color: var(--input-text, #e0e0e0);
  border: 1px solid var(--border-color, #3a3a3a);
  border-radius: 3px;
  padding: 4px 6px;
  font-size: 12px;
  font-family: inherit;
  line-height: 1.4;
  outline: none;
  box-sizing: border-box;
}
.label-input { font-family: ui-monospace, monospace; }
.content-textarea, .meta-textarea { resize: vertical; }
.label-input:focus, .content-textarea:focus,
.meta-input:focus, .meta-textarea:focus {
  border-color: var(--primary-color, #6c8eef);
}
.label-input.invalid { border-color: #b65454; }

.empty-row td {
  color: var(--input-text-secondary, #888);
  font-style: italic;
  text-align: center;
  padding: 16px;
}

.del-btn, .btn-add, .btn-mini {
  background: var(--comfy-input-bg, #1a1a1a);
  border: 1px solid var(--border-color, #3a3a3a);
  color: var(--input-text, #e0e0e0);
  border-radius: 3px;
  padding: 3px 10px;
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
}
.del-btn:hover { border-color: #b65454; color: #b65454; }
.btn-mini { padding: 3px 8px; }
.btn-mini.btn-save {
  background: rgba(108, 142, 239, 0.3);
  border-color: rgba(108, 142, 239, 0.6);
}
.btn-mini.btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-add:hover { background: rgba(108, 142, 239, 0.16); }
.btn-add { align-self: flex-start; }
.footer { margin-top: 4px; }
</style>
