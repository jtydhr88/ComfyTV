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
import { computed, onMounted, ref } from 'vue'

import {
  KIND_CONTENT_PLACEHOLDER,
  KIND_LABELS,
  KIND_META_FIELDS,
} from '@/composables/dialog/entryCatalog'
import { useEntryEditor } from '@/composables/dialog/useEntryEditor'
import { useProjectStore } from '@/stores/projectStore'
import { ENTRY_KINDS, type EntryKind } from '@/stores/entryStore'
import { isValidLabel } from '@/utils/labelRegex'

const projectStore = useProjectStore()
const projectId = computed(() => projectStore.currentProjectId || '')

const activeKind = ref<EntryKind>('fragment')
const metaFields = computed(() => KIND_META_FIELDS[activeKind.value])
const newContentPlaceholder = computed(() => KIND_CONTENT_PLACEHOLDER[activeKind.value])

const {
  activeRows, rowsByKind,
  drafts,
  saveIfDirty, confirmDelete,
  creating, newDraft, newLabelInput,
  newLabelError, canSaveNew,
  startCreate, cancelCreate, saveNew,
  kickHydrate,
} = useEntryEditor(projectId, activeKind, metaFields)

onMounted(kickHydrate)
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
