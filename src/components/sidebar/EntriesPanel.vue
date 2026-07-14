<template>
  <div class="ctv:flex ctv:flex-col ctv:size-full ctv:box-border ctv:overflow-hidden ctv:text-xs ctv:text-base-foreground">
    <div class="ctv:shrink-0 ctv:flex ctv:items-center ctv:gap-1.5 ctv:py-1.5 ctv:px-2.5
                ctv:bg-interface-panel-surface ctv:border-b ctv:border-border-subtle">
      <span class="ctv:flex-1 ctv:font-semibold ctv:text-sm">{{ $t('entries.title') }}</span>
      <button :class="btnClass('mini')" :title="$t('entries.importTooltip')" @click="importPicker?.click()">
        <i class="pi pi-upload ctv:mr-1 ctv:text-2xs" />{{ $t('entries.import') }}
      </button>
      <button :class="btnClass('mini')" :title="$t('entries.exportTooltip')" @click="exportEntries">
        <i class="pi pi-download ctv:mr-1 ctv:text-2xs" />{{ $t('entries.export') }}
      </button>
      <input
        ref="importPicker"
        type="file"
        accept="application/json,.json"
        class="ctv:hidden"
        @change="onImportFile"
      />
    </div>

    <div v-if="ioStatus"
         class="ctv:shrink-0 ctv:flex ctv:items-center ctv:gap-2 ctv:my-1.5 ctv:mx-2.5 ctv:py-1.5 ctv:px-2 ctv:text-xs ctv:rounded
                ctv:bg-secondary-background ctv:border ctv:border-border-subtle">
      <span class="ctv:flex-1">{{ ioStatus }}</span>
      <button
        class="ctv:inline-flex ctv:bg-transparent ctv:border-none ctv:cursor-pointer ctv:text-inherit ctv:opacity-70 ctv:hover:opacity-100"
        @click="ioStatus = ''"
      ><i class="pi pi-times ctv:text-2xs" /></button>
    </div>

    <p class="ctv:shrink-0 ctv:m-0 ctv:py-1.5 ctv:px-2.5 ctv:text-[11px] ctv:text-muted-foreground ctv:border-b ctv:border-border-subtle">
      {{ $t('entries.refHelpPre') }}
      <code class="ctv:py-0 ctv:px-1 ctv:rounded-sm ctv:font-mono
                   ctv:bg-primary-background/20 ctv:border ctv:border-primary-background/45 ctv:text-primary-background">@label</code>
      {{ $t('entries.refHelpPost') }}
    </p>

    <div v-if="ENTRY_KINDS.length > 1"
         class="ctv:shrink-0 ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-1 ctv:py-1.5 ctv:px-2.5 ctv:border-b ctv:border-border-subtle">
      <button
        v-for="k in ENTRY_KINDS"
        :key="k"
        :class="chipClass(activeKind === k)"
        @click="activeKind = k"
      >
        {{ KIND_LABELS[k] }}
        <span class="ctv:py-0 ctv:px-1.5 ctv:rounded-lg ctv:text-2xs ctv:bg-base-foreground/10">{{ rowsByKind[k]?.length ?? 0 }}</span>
      </button>
    </div>

    <div class="comfytv-entries-scroll ctv:flex-1 ctv:min-h-0 ctv:overflow-y-auto ctv:p-2.5 ctv:flex ctv:flex-col ctv:gap-2">
      <div
        v-for="entry in activeRows"
        :key="entry.id"
        :class="cardClass"
      >
        <div class="ctv:flex ctv:items-center ctv:gap-1.5">
          <input
            v-model="drafts[entry.id].label"
            :class="labelInputClass(!isValidLabel(drafts[entry.id].label))"
            @blur="saveIfDirty(entry)"
            @keydown.ctrl.enter.prevent="saveIfDirty(entry)"
            @keydown.meta.enter.prevent="saveIfDirty(entry)"
          />
          <button :class="btnClass('del')"
                  :title="$t('entries.deleteTitle', { label: entry.label })"
                  @click="confirmDelete(entry)"><i class="pi pi-trash" /></button>
        </div>
        <textarea
          v-model="drafts[entry.id].content"
          :class="textareaClass()"
          rows="2"
          @blur="saveIfDirty(entry)"
          @keydown.ctrl.enter.prevent="saveIfDirty(entry)"
          @keydown.meta.enter.prevent="saveIfDirty(entry)"
        />
        <label v-for="f in metaFields" :key="f.name" class="ctv:flex ctv:flex-col ctv:gap-0.5">
          <span class="ctv:text-2xs ctv:text-muted-foreground">{{ f.label }}</span>
          <textarea
            v-if="f.type === 'textarea'"
            v-model="drafts[entry.id].metadata[f.name]"
            :class="textareaClass()"
            rows="2"
            :placeholder="f.placeholder ?? ''"
            @blur="saveIfDirty(entry)"
          />
          <input
            v-else
            v-model="drafts[entry.id].metadata[f.name]"
            :class="inputClass()"
            :placeholder="f.placeholder ?? ''"
            @blur="saveIfDirty(entry)"
          />
        </label>
      </div>

      <p v-if="activeRows.length === 0 && !creating"
         class="ctv:m-0 ctv:p-4 ctv:text-center ctv:italic ctv:text-muted-foreground">
        {{ $t('entries.emptyKind', { kind: KIND_LABELS[activeKind].toLowerCase() }) }}
      </p>

      <div v-if="creating" :class="['create-row', cardClass]">
        <input
          ref="newLabelInput"
          v-model="newDraft.label"
          :class="['label-input', labelInputClass(!!newLabelError)]"
          :title="newLabelError"
          :placeholder="$t('entries.labelPlaceholder')"
          @keydown.escape="cancelCreate"
        />
        <textarea
          v-model="newDraft.content"
          :class="['content-textarea', textareaClass()]"
          rows="2"
          :placeholder="newContentPlaceholder"
          @keydown.escape="cancelCreate"
          @keydown.ctrl.enter.prevent="saveNew"
          @keydown.meta.enter.prevent="saveNew"
        />
        <label v-for="f in metaFields" :key="f.name" class="ctv:flex ctv:flex-col ctv:gap-0.5">
          <span class="ctv:text-2xs ctv:text-muted-foreground">{{ f.label }}</span>
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
        </label>
        <div class="ctv:flex ctv:justify-end ctv:gap-1.5">
          <button :class="btnClass('save')" :disabled="!canSaveNew" @click="saveNew">{{ $t('entries.save') }}</button>
          <button :class="btnClass('mini')" @click="cancelCreate">{{ $t('stage.cancel') }}</button>
        </div>
      </div>

      <button v-if="!creating" :class="btnClass('add')" @click="startCreate">
        {{ $t('entries.addKind', { kind: KIND_LABELS[activeKind].slice(0, -1).toLowerCase() }) }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  KIND_CONTENT_PLACEHOLDER,
  KIND_LABELS,
  KIND_META_FIELDS,
} from '@/composables/dialog/entryCatalog'
import { useEntryEditor } from '@/composables/dialog/useEntryEditor'
import { useProjectStore } from '@/stores/projectStore'
import { ENTRY_KINDS, useEntryStore, type EntryKind } from '@/stores/entryStore'
import { isValidLabel } from '@/utils/labelRegex'
import { t } from '@/i18n'

const props = defineProps<{ active?: boolean }>()

const projectStore = useProjectStore()
const projectId = computed(() => projectStore.currentProjectId || '')

const activeKind = ref<EntryKind>('fragment')
const metaFields = computed(() => KIND_META_FIELDS[activeKind.value])
const newContentPlaceholder = computed(() => KIND_CONTENT_PLACEHOLDER[activeKind.value])

const {
  allRows, activeRows, rowsByKind,
  drafts,
  saveIfDirty, confirmDelete,
  creating, newDraft, newLabelInput,
  newLabelError, canSaveNew,
  startCreate, cancelCreate, saveNew,
  kickHydrate,
} = useEntryEditor(projectId, activeKind, metaFields)

onMounted(kickHydrate)
watch(() => props.active, (active) => { if (active) kickHydrate() })
watch(projectId, kickHydrate)

const entryStore = useEntryStore()
const importPicker = ref<HTMLInputElement | null>(null)
const ioStatus = ref('')

function exportEntries() {
  const rows = allRows.value.map(e => ({
    kind: e.kind,
    label: e.label,
    content: e.content,
    metadata: e.metadata,
  }))
  if (rows.length === 0) {
    ioStatus.value = t('entries.exportEmpty')
    return
  }
  const payload = {
    comfytv_entries: 1,
    project_id: projectId.value,
    exported_at: new Date().toISOString(),
    entries: rows,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const stamp = new Date().toISOString().slice(0, 10)
  a.download = `comfytv-entries-${projectId.value}-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
  ioStatus.value = ''
}

async function onImportFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  let rows: unknown
  try {
    const parsed = JSON.parse(await file.text())
    rows = Array.isArray(parsed) ? parsed : parsed?.entries
  } catch {
    rows = null
  }
  if (!Array.isArray(rows)) {
    ioStatus.value = t('entries.importError')
    return
  }
  let added = 0, dup = 0, invalid = 0
  for (const r of rows as any[]) {
    const kind: EntryKind = (ENTRY_KINDS as readonly string[]).includes(r?.kind) ? r.kind : 'fragment'
    const label = typeof r?.label === 'string' ? r.label : ''
    const content = typeof r?.content === 'string' ? r.content : ''
    if (!isValidLabel(label) || !content.trim()) { invalid++; continue }
    const metadata = (r?.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata))
      ? r.metadata as Record<string, unknown>
      : {}
    const identical = allRows.value.some(e =>
      e.kind === kind && e.label === label && e.content === content
      && JSON.stringify(e.metadata) === JSON.stringify(metadata))
    if (identical) { dup++; continue }
    const saved = await entryStore.upsert(projectId.value, { kind, label, content, metadata })
    if (!saved) { invalid++; continue }
    added++
  }
  ioStatus.value = t('entries.importResult', { added, dup, invalid })
}

const cardClass = 'ctv:flex ctv:flex-col ctv:gap-1.5 ctv:p-2 ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background/40'

function chipClass(active: boolean) {
  return [
    'ctv:py-1 ctv:px-2 ctv:text-xs ctv:cursor-pointer ctv:inline-flex ctv:items-center ctv:gap-1.5',
    'ctv:rounded-lg ctv:border ctv:border-transparent ctv:bg-transparent ctv:[font-family:inherit]',
    active
      ? 'ctv:bg-interface-menu-component-surface-hovered ctv:text-base-foreground ctv:font-semibold'
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
  return `${FIELD_BASE} ctv:flex-1 ctv:min-w-0 ctv:font-mono ctv:border ${invalid ? 'invalid ctv:border-destructive-background' : 'ctv:border-border-default'}`
}

const BTN_BASE = 'ctv:rounded-sm ctv:text-[11px] ctv:cursor-pointer ctv:[font-family:inherit]'
  + ' ctv:bg-secondary-background ctv:text-base-foreground'
  + ' ctv:border ctv:border-border-default'
function btnClass(variant: 'del' | 'save' | 'mini' | 'add') {
  const v = {
    del:  ' ctv:shrink-0 ctv:py-0.5 ctv:px-2 ctv:hover:border-destructive-background ctv:hover:text-destructive-background',
    save: ' ctv:py-0.5 ctv:px-2 ctv:bg-primary-background/30 ctv:border-primary-background/60 ctv:disabled:opacity-40 ctv:disabled:cursor-not-allowed',
    mini: ' ctv:py-0.5 ctv:px-2',
    add:  ' ctv:py-0.5 ctv:px-2.5 ctv:self-start ctv:hover:bg-primary-background/15',
  }[variant]
  return BTN_BASE + v
}
</script>

<style>
.comfytv-entries-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.35) transparent;
}
.comfytv-entries-scroll::-webkit-scrollbar {
  width: 10px;
}
.comfytv-entries-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.comfytv-entries-scroll::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.35);
  border-radius: 5px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.comfytv-entries-scroll:hover::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.55);
}
</style>
