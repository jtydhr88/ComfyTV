<template>
  <div class="flex flex-col gap-2.5">
    <p class="m-0 mb-1 text-[11px] text-muted-foreground">
      Reference any entry in a stage's prompt with
      <code class="py-0 px-1 rounded-sm font-mono
                   bg-primary-background/20 border border-primary-background/45 text-primary-background">@label</code>.
      Unknown tokens stay literal.
    </p>

    <div v-if="ENTRY_KINDS.length > 1"
         class="flex gap-1 border-b border-border-subtle">
      <button
        v-for="k in ENTRY_KINDS"
        :key="k"
        :class="tabClass(activeKind === k)"
        @click="activeKind = k"
      >
        {{ KIND_LABELS[k] }}
        <span class="py-0 px-1.5 rounded-lg text-2xs bg-base-foreground/10">{{ rowsByKind[k]?.length ?? 0 }}</span>
      </button>
    </div>

    <table class="w-full border-collapse text-xs ctv-entry-table">
      <thead>
        <tr>
          <th class="w-[140px]">Label</th>
          <th>Content</th>
          <th v-for="f in metaFields" :key="f.name" class="w-[180px]">
            {{ f.label }}
          </th>
          <th class="w-24 text-right whitespace-nowrap"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in activeRows" :key="entry.id">
          <td class="w-[140px]">
            <input
              v-model="drafts[entry.id].label"
              :class="labelInputClass(!isValidLabel(drafts[entry.id].label))"
              @blur="saveIfDirty(entry)"
              @keydown.ctrl.enter.prevent="saveIfDirty(entry)"
              @keydown.meta.enter.prevent="saveIfDirty(entry)"
            />
          </td>
          <td>
            <textarea
              v-model="drafts[entry.id].content"
              :class="textareaClass()"
              rows="2"
              @blur="saveIfDirty(entry)"
              @keydown.ctrl.enter.prevent="saveIfDirty(entry)"
              @keydown.meta.enter.prevent="saveIfDirty(entry)"
            />
          </td>
          <td v-for="f in metaFields" :key="f.name" class="w-[180px]">
            <textarea
              v-if="f.type === 'textarea'"
              v-model="drafts[entry.id].metadata[f.name]"
              :class="textareaClass()"
              rows="2"
              @blur="saveIfDirty(entry)"
            />
            <input
              v-else
              v-model="drafts[entry.id].metadata[f.name]"
              :class="inputClass()"
              :placeholder="f.placeholder ?? ''"
              @blur="saveIfDirty(entry)"
            />
          </td>
          <td class="w-24 text-right whitespace-nowrap">
            <button :class="btnClass('del')"
                    :title="`Delete @${entry.label}`"
                    @click="confirmDelete(entry)">🗑</button>
          </td>
        </tr>

        <tr v-if="activeRows.length === 0 && !creating">
          <td :colspan="3 + metaFields.length"
              class="text-center italic p-4 text-muted-foreground">
            No {{ KIND_LABELS[activeKind].toLowerCase() }} yet. Click <strong>+ Add</strong> below.
          </td>
        </tr>

        <tr v-if="creating" class="create-row">
          <td class="w-[140px]">
            <input
              ref="newLabelInput"
              v-model="newDraft.label"
              :class="['label-input', labelInputClass(!!newLabelError)]"
              :title="newLabelError"
              placeholder="label"
              @keydown.escape="cancelCreate"
            />
          </td>
          <td>
            <textarea
              v-model="newDraft.content"
              :class="['content-textarea', textareaClass()]"
              rows="2"
              :placeholder="newContentPlaceholder"
              @keydown.escape="cancelCreate"
              @keydown.ctrl.enter.prevent="saveNew"
              @keydown.meta.enter.prevent="saveNew"
            />
          </td>
          <td v-for="f in metaFields" :key="f.name" class="w-[180px]">
            <textarea
              v-if="f.type === 'textarea'"
              v-model="newDraft.metadata[f.name]"
              :class="textareaClass()"
              rows="2"
              :placeholder="f.placeholder ?? ''"
            />
            <input
              v-else
              v-model="newDraft.metadata[f.name]"
              :class="inputClass()"
              :placeholder="f.placeholder ?? ''"
            />
          </td>
          <td class="w-24 text-right whitespace-nowrap">
            <button :class="btnClass('save')" :disabled="!canSaveNew" @click="saveNew">Save</button>
            <button :class="btnClass('mini')" @click="cancelCreate">Cancel</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="mt-1">
      <button v-if="!creating" :class="btnClass('add')" @click="startCreate">
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

function tabClass(active: boolean) {
  return [
    'py-1.5 px-3 text-xs cursor-pointer inline-flex items-center gap-1.5',
    'border border-transparent border-b-0 rounded-t bg-transparent',
    active
      ? '-mb-px bg-secondary-background border-border-default text-base-foreground'
      : 'text-muted-foreground hover:text-base-foreground',
  ].join(' ')
}

const FIELD_BASE = 'w-full py-1 px-1.5 text-xs leading-snug rounded-sm outline-none box-border [font-family:inherit]'
  + ' bg-secondary-background text-base-foreground'
  + ' focus:border-primary-background'

function inputClass() {
  return `${FIELD_BASE} border border-border-default`
}
function textareaClass() {
  return `${FIELD_BASE} border border-border-default resize-y`
}
function labelInputClass(invalid: boolean) {
  return `${FIELD_BASE} font-mono border ${invalid ? 'invalid border-destructive-background' : 'border-border-default'}`
}

const BTN_BASE = 'rounded-sm text-[11px] cursor-pointer [font-family:inherit]'
  + ' bg-secondary-background text-base-foreground'
  + ' border border-border-default'
function btnClass(variant: 'del' | 'save' | 'mini' | 'add') {
  const v = {
    del:  ' py-0.5 px-2.5 hover:border-destructive-background hover:text-destructive-background',
    save: ' py-0.5 px-2 bg-primary-background/30 border-primary-background/60 disabled:opacity-40 disabled:cursor-not-allowed',
    mini: ' py-0.5 px-2',
    add:  ' py-0.5 px-2.5 self-start hover:bg-primary-background/15',
  }[variant]
  return BTN_BASE + v
}
</script>

<style scoped>
.ctv-entry-table th,
.ctv-entry-table td {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-subtle, #2a2a2a);
  vertical-align: top;
}
.ctv-entry-table th {
  font-weight: 600;
  color: var(--muted-foreground, #aaa);
}
</style>
