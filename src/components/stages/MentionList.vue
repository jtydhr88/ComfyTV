<template>
  <div class="mention-list">
    <template v-if="!creating">
      <div
        v-for="(item, i) in items"
        :key="item.id"
        class="ml-item"
        :class="{ active: i === activeIndex }"
        :title="item.content"
        @mousedown.prevent
        @click="selectItem(i)"
      >
        <span v-if="showKindTag" class="ml-kind" :class="`kind-${item.kind}`">{{ item.kind }}</span>
        <span class="ml-label">@{{ item.label }}</span>
        <span class="ml-content">{{ item.content }}</span>
      </div>
      <div
        v-if="canCreate"
        class="ml-item ml-create"
        :class="{ active: activeIndex === items.length }"
        @mousedown.prevent
        @click="startCreate"
      >
        <span v-if="showKindTag" class="ml-kind kind-create">new</span>
        <span class="ml-label">+ Create</span>
        <span class="ml-content">new fragment <code>@{{ query }}</code></span>
      </div>
      <div v-if="items.length === 0 && !canCreate" class="ml-empty">
        {{ query ? 'Invalid label — start with a letter / underscore (中文 OK), then letters / digits / _ / -' : 'No entries yet — type a label to create one' }}
      </div>
    </template>

    <div v-else class="ml-create-form" @mousedown.stop>
      <div class="ml-create-header">
        + Create fragment <code>@{{ pendingLabel }}</code>
      </div>
      <textarea
        ref="createTa"
        v-model="pendingContent"
        class="ml-create-textarea"
        rows="3"
        placeholder="Content this @-token expands to. (For characters / other kinds, use the ComfyTV button → Entries dialog.)"
        @keydown.stop="onCreateKeydown"
      />
      <div class="ml-create-actions">
        <button class="ml-btn" @click="cancelCreate">Cancel</button>
        <button
          class="ml-btn ml-btn-save"
          :disabled="!pendingContent.trim()"
          @click="saveCreate"
        >Save (Ctrl+Enter)</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import type { Entry } from '@/api/schemas'
import { ENTRY_KINDS, useEntryStore } from '@/stores/entryStore'
import { useProjectStore } from '@/stores/projectStore'
import { LABEL_RE } from '@/utils/labelRegex'

const props = defineProps<{
  items: Entry[]
  command: (attrs: { id: number | string; label: string }) => void
  query: string
}>()

const entryStore = useEntryStore()
const projectStore = useProjectStore()

const showKindTag = ENTRY_KINDS.length > 1

const activeIndex = ref(0)

watch(() => props.items, () => { activeIndex.value = 0 })
watch(() => props.query,  () => { activeIndex.value = 0 })

const canCreate = computed(() => !!props.query && LABEL_RE.test(props.query))

const creating = ref(false)
const pendingLabel = ref('')
const pendingContent = ref('')
const createTa = ref<HTMLTextAreaElement | null>(null)

function startCreate() {
  pendingLabel.value = props.query
  pendingContent.value = ''
  creating.value = true
  nextTick(() => createTa.value?.focus())
}
function cancelCreate() {
  creating.value = false
  pendingLabel.value = ''
  pendingContent.value = ''
}
async function saveCreate() {
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
    props.command({ id: row.id, label: row.label })
  }
}
function onCreateKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { cancelCreate(); return }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    void saveCreate()
  }
}

function selectItem(index: number) {
  if (index < props.items.length) {
    const item = props.items[index]
    if (item) props.command({ id: item.id, label: item.label })
  } else if (canCreate.value) {
    startCreate()
  }
}

function upHandler() {
  const total = props.items.length + (canCreate.value ? 1 : 0)
  if (total === 0) return
  activeIndex.value = (activeIndex.value + total - 1) % total
}
function downHandler() {
  const total = props.items.length + (canCreate.value ? 1 : 0)
  if (total === 0) return
  activeIndex.value = (activeIndex.value + 1) % total
}
function enterHandler() { selectItem(activeIndex.value) }

defineExpose({
  onKeyDown({ event }: { event: KeyboardEvent }): boolean {
    if (creating.value) return event.key === 'Escape'
    if (event.key === 'ArrowUp')   { upHandler();    return true }
    if (event.key === 'ArrowDown') { downHandler();  return true }
    if (event.key === 'Enter' || event.key === 'Tab') { enterHandler(); return true }
    if (event.key === 'Escape') { return true }
    return false
  },
})
</script>

<style scoped>
.mention-list {
  background: var(--comfy-input-bg, #1a1a1a);
  border: 1px solid var(--border-color, #3a3a3a);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  min-width: 260px;
  max-width: 420px;
  max-height: 240px;
  overflow-y: auto;
  font-size: 12px;
  color: var(--input-text, #e0e0e0);
}

.ml-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 5px 8px;
  cursor: pointer;
}
.ml-item:hover, .ml-item.active {
  background: rgba(108, 142, 239, 0.18);
}
.ml-create { border-top: 1px solid var(--border-color, #2a2a2a); }

.ml-kind {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 1px 5px;
  border-radius: 3px;
  flex-shrink: 0;
  font-weight: 600;
  border: 1px solid;
}
.ml-kind.kind-fragment  { color: #7fb5e0; border-color: rgba(127, 181, 224, 0.4); background: rgba(127, 181, 224, 0.08); }
.ml-kind.kind-character { color: #d8a26f; border-color: rgba(216, 162, 111, 0.4); background: rgba(216, 162, 111, 0.08); }
.ml-kind.kind-create    { color: #7fd87f; border-color: rgba(127, 216, 127, 0.4); background: rgba(127, 216, 127, 0.08); }

.ml-label {
  font-family: ui-monospace, monospace;
  color: rgba(140, 170, 255, 1);
  flex-shrink: 0;
}
.ml-content {
  color: var(--input-text-secondary, #888);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ml-empty {
  padding: 6px 8px;
  font-style: italic;
  color: var(--input-text-secondary, #888);
  font-size: 11px;
}

.ml-create-form {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ml-create-header {
  font-size: 11px;
  color: var(--input-text-secondary, #aaa);
}
.ml-create-header code {
  color: #7fd87f;
  font-family: ui-monospace, monospace;
}
.ml-create-textarea {
  width: 100%;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--input-text, #e0e0e0);
  border: 1px solid var(--border-color, #3a3a3a);
  border-radius: 3px;
  font: 12px / 1.4 inherit;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}
.ml-create-textarea:focus { border-color: var(--primary-color, #6c8eef); }
.ml-create-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
.ml-btn {
  padding: 3px 10px;
  font-size: 11px;
  border-radius: 3px;
  background: var(--comfy-input-bg, #1a1a1a);
  border: 1px solid var(--border-color, #3a3a3a);
  color: var(--input-text, #e0e0e0);
  cursor: pointer;
}
.ml-btn-save {
  background: rgba(108, 142, 239, 0.3);
  border-color: rgba(108, 142, 239, 0.6);
}
.ml-btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
