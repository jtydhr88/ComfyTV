<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-2.5">
    <p class="ctv:m-0 ctv:mb-1 ctv:text-[11px] ctv:text-muted-foreground">
      {{ $t('entries.refHelpPre') }}
      <code class="ctv:py-0 ctv:px-1 ctv:rounded-sm ctv:font-mono
                   ctv:bg-primary-background/20 ctv:border ctv:border-primary-background/45 ctv:text-primary-background">@label</code>
      {{ $t('entries.refHelpPost') }}
    </p>

    <div v-if="ENTRY_KINDS.length > 1"
         class="ctv:flex ctv:gap-1 ctv:border-b ctv:border-border-subtle">
      <button
        v-for="k in ENTRY_KINDS"
        :key="k"
        :class="tabClass(activeKind === k)"
        @click="activeKind = k"
      >
        {{ KIND_LABELS[k] }}
        <span class="ctv:py-0 ctv:px-1.5 ctv:rounded-lg ctv:text-2xs ctv:bg-base-foreground/10">{{ rowsByKind[k]?.length ?? 0 }}</span>
      </button>
    </div>

    <table class="ctv:w-full ctv:border-collapse ctv:text-xs ctv-entry-table">
      <thead>
        <tr>
          <th class="ctv:w-[140px]">{{ $t('entries.colLabel') }}</th>
          <th>{{ $t('entries.colContent') }}</th>
          <th v-for="f in metaFields" :key="f.name" class="ctv:w-[180px]">
            {{ f.label }}
          </th>
          <th class="ctv:w-24 ctv:text-right ctv:whitespace-nowrap"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in activeRows" :key="entry.id">
          <td class="ctv:w-[140px]">
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
          <td v-for="f in metaFields" :key="f.name" class="ctv:w-[180px]">
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
          <td class="ctv:w-24 ctv:text-right ctv:whitespace-nowrap">
            <button :class="btnClass('del')"
                    :title="$t('entries.deleteTitle', { label: entry.label })"
                    @click="confirmDelete(entry)">🗑</button>
          </td>
        </tr>

        <tr v-if="activeRows.length === 0 && !creating">
          <td :colspan="3 + metaFields.length"
              class="ctv:text-center ctv:italic ctv:p-4 ctv:text-muted-foreground">
            {{ $t('entries.emptyKind', { kind: KIND_LABELS[activeKind].toLowerCase() }) }}
          </td>
        </tr>

        <tr v-if="creating" class="create-row">
          <td class="ctv:w-[140px]">
            <input
              ref="newLabelInput"
              v-model="newDraft.label"
              :class="['label-input', labelInputClass(!!newLabelError)]"
              :title="newLabelError"
              :placeholder="$t('entries.labelPlaceholder')"
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
          <td v-for="f in metaFields" :key="f.name" class="ctv:w-[180px]">
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
          <td class="ctv:w-24 ctv:text-right ctv:whitespace-nowrap">
            <button :class="btnClass('save')" :disabled="!canSaveNew" @click="saveNew">{{ $t('entries.save') }}</button>
            <button :class="btnClass('mini')" @click="cancelCreate">{{ $t('stage.cancel') }}</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="ctv:mt-1">
      <button v-if="!creating" :class="btnClass('add')" @click="startCreate">
        {{ $t('entries.addKind', { kind: KIND_LABELS[activeKind].slice(0, -1).toLowerCase() }) }}
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
    'ctv:py-1.5 ctv:px-3 ctv:text-xs ctv:cursor-pointer ctv:inline-flex ctv:items-center ctv:gap-1.5',
    'ctv:border ctv:border-transparent ctv:border-b-0 ctv:rounded-t ctv:bg-transparent',
    active
      ? 'ctv:-mb-px ctv:bg-secondary-background ctv:border-border-default ctv:text-base-foreground'
      : 'ctv:text-muted-foreground ctv:hover:text-base-foreground',
  ].join(' ')
}

const FIELD_BASE = 'ctv:w-full ctv:py-1 ctv:px-1.5 ctv:text-xs ctv:leading-snug ctv:rounded-sm ctv:outline-none ctv:box-border ctv:[font-family:inherit]'
  + ' ctv:bg-secondary-background ctv:text-base-foreground'
  + ' ctv:focus:border-primary-background'

function inputClass() {
  return `${FIELD_BASE} ctv:border ctv:border-border-default`
}
function textareaClass() {
  return `${FIELD_BASE} ctv:border ctv:border-border-default ctv:resize-y`
}
function labelInputClass(invalid: boolean) {
  return `${FIELD_BASE} ctv:font-mono ctv:border ${invalid ? 'invalid ctv:border-destructive-background' : 'ctv:border-border-default'}`
}

const BTN_BASE = 'ctv:rounded-sm ctv:text-[11px] ctv:cursor-pointer ctv:[font-family:inherit]'
  + ' ctv:bg-secondary-background ctv:text-base-foreground'
  + ' ctv:border ctv:border-border-default'
function btnClass(variant: 'del' | 'save' | 'mini' | 'add') {
  const v = {
    del:  ' ctv:py-0.5 ctv:px-2.5 ctv:hover:border-destructive-background ctv:hover:text-destructive-background',
    save: ' ctv:py-0.5 ctv:px-2 ctv:bg-primary-background/30 ctv:border-primary-background/60 ctv:disabled:opacity-40 ctv:disabled:cursor-not-allowed',
    mini: ' ctv:py-0.5 ctv:px-2',
    add:  ' ctv:py-0.5 ctv:px-2.5 ctv:self-start ctv:hover:bg-primary-background/15',
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
