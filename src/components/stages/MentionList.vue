<template>
  <div class="min-w-64 max-w-md max-h-60 overflow-y-auto rounded text-xs
              bg-interface-menu-surface text-base-foreground
              border border-border-default shadow-md">
    <template v-if="!creating">
      <div
        v-for="(item, i) in items"
        :key="item.id"
        :class="[
          'flex items-baseline gap-2 py-1 px-2 cursor-pointer',
          'hover:bg-interface-menu-component-surface-hovered',
          i === activeIndex ? 'bg-interface-menu-component-surface-selected' : '',
        ]"
        :title="item.content"
        @mousedown.prevent
        @click="selectItem(i)"
      >
        <span v-if="showKindTag" :class="kindTag(item.kind)">{{ item.kind }}</span>
        <span class="font-mono text-base-foreground shrink-0">@{{ item.label }}</span>
        <span class="text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">{{ item.content }}</span>
      </div>
      <div
        v-if="canCreate"
        :class="[
          'flex items-baseline gap-2 py-1 px-2 cursor-pointer border-t border-border-subtle',
          'hover:bg-interface-menu-component-surface-hovered',
          activeIndex === items.length ? 'bg-interface-menu-component-surface-selected' : '',
        ]"
        @mousedown.prevent
        @click="startCreate"
      >
        <span v-if="showKindTag" :class="kindTag('create')">new</span>
        <span class="font-mono text-base-foreground shrink-0">+ Create</span>
        <span class="text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
          new fragment <code>@{{ query }}</code>
        </span>
      </div>
      <div v-if="items.length === 0 && !canCreate"
           class="py-1.5 px-2 italic text-xs text-muted-foreground">
        {{ query ? 'Invalid label — start with a letter / underscore (中文 OK), then letters / digits / _ / -' : 'No entries yet — type a label to create one' }}
      </div>
    </template>

    <div v-else class="flex flex-col gap-1.5 p-2" @mousedown.stop>
      <div class="text-xs text-muted-foreground">
        + Create fragment <code class="text-base-foreground font-mono">@{{ pendingLabel }}</code>
      </div>
      <textarea
        ref="createTa"
        v-model="pendingContent"
        rows="3"
        class="w-full py-1.5 px-2 rounded-sm resize-y outline-none box-border text-xs leading-snug
               bg-secondary-background text-base-foreground
               border border-border-default
               focus:border-primary-background"
        placeholder="Content this @-token expands to. (For characters / other kinds, use the ComfyTV button → Entries dialog.)"
        @keydown.stop="onCreateKeydown"
      />
      <div class="flex justify-end gap-1.5">
        <button :class="actionBtn()" @click="cancelCreate">Cancel</button>
        <button
          :class="actionBtn('save')"
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

const KIND_TAG_BASE = 'shrink-0 py-px px-1.5 rounded-sm text-3xs font-semibold uppercase tracking-wide'
  + ' bg-secondary-background text-secondary-foreground'
function kindTag(_kind: string) { return KIND_TAG_BASE }

const ACTION_BTN_BASE = 'relative inline-flex items-center justify-center gap-2 cursor-pointer'
  + ' touch-manipulation whitespace-nowrap appearance-none border-none transition-colors'
  + ' h-6 rounded-sm px-2 py-1 text-xs font-medium'
  + ' disabled:pointer-events-none disabled:opacity-50'
const ACTION_BTN_VARIANTS = {
  default: ' bg-secondary-background text-secondary-foreground hover:bg-secondary-background-hover',
  save:    ' bg-primary-background text-base-foreground hover:bg-primary-background-hover',
} as const
function actionBtn(variant: keyof typeof ACTION_BTN_VARIANTS = 'default') {
  return ACTION_BTN_BASE + ACTION_BTN_VARIANTS[variant]
}
</script>
