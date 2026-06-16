<template>
  <div class="ctv:min-w-64 ctv:max-w-md ctv:max-h-60 ctv:overflow-y-auto ctv:rounded ctv:text-xs
              ctv:bg-interface-menu-surface ctv:text-base-foreground
              ctv:border ctv:border-border-default ctv:shadow-md">
    <template v-if="!creating">
      <div
        v-for="(item, i) in items"
        :key="itemKey(item)"
        :class="[
          'ctv:flex ctv:items-center ctv:gap-2 ctv:py-1 ctv:px-2 ctv:cursor-pointer',
          'ctv:hover:bg-interface-menu-component-surface-hovered',
          i === activeIndex ? 'ctv:bg-interface-menu-component-surface-selected' : '',
        ]"
        :title="itemTitle(item)"
        @mousedown.prevent
        @click="selectItem(i)"
      >
        <span class="ctv:font-mono ctv:text-base-foreground ctv:shrink-0">@{{ item.entry.label }}</span>
        <span class="ctv:text-muted-foreground ctv:overflow-hidden ctv:text-ellipsis ctv:whitespace-nowrap">{{ item.entry.content }}</span>
      </div>
      <div
        v-if="canCreate"
        :class="[
          'ctv:flex ctv:items-baseline ctv:gap-2 ctv:py-1 ctv:px-2 ctv:cursor-pointer ctv:border-t ctv:border-border-subtle',
          'ctv:hover:bg-interface-menu-component-surface-hovered',
          activeIndex === items.length ? 'ctv:bg-interface-menu-component-surface-selected' : '',
        ]"
        @mousedown.prevent
        @click="startCreate"
      >
        <span class="ctv:font-mono ctv:text-base-foreground ctv:shrink-0">{{ $t('mention.create') }}</span>
        <span class="ctv:text-muted-foreground ctv:overflow-hidden ctv:text-ellipsis ctv:whitespace-nowrap">
          {{ $t('mention.newFragment') }} <code>@{{ query }}</code>
        </span>
      </div>
      <div v-if="items.length === 0 && !canCreate"
           class="ctv:py-1.5 ctv:px-2 ctv:italic ctv:text-xs ctv:text-muted-foreground">
        {{ query ? $t('mention.invalidLabel') : $t('mention.noEntries') }}
      </div>
    </template>

    <div v-else class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:p-2" @mousedown.stop>
      <div class="ctv:text-xs ctv:text-muted-foreground">
        {{ $t('mention.createFragment') }} <code class="ctv:text-base-foreground ctv:font-mono">@{{ pendingLabel }}</code>
      </div>
      <textarea
        ref="createTa"
        v-model="pendingContent"
        rows="3"
        class="ctv:w-full ctv:py-1.5 ctv:px-2 ctv:rounded-sm ctv:resize-y ctv:outline-none ctv:box-border ctv:text-xs ctv:leading-snug
               ctv:bg-secondary-background ctv:text-base-foreground
               ctv:border ctv:border-border-default
               ctv:focus:border-primary-background"
        :placeholder="$t('mention.contentPlaceholder')"
        @keydown.stop="onCreateKeydown"
      />
      <div class="ctv:flex ctv:justify-end ctv:gap-1.5">
        <button :class="actionBtn()" @click="cancelCreate">{{ $t('stage.cancel') }}</button>
        <button
          :class="actionBtn('save')"
          :disabled="!pendingContent.trim()"
          @click="saveCreate"
        >{{ $t('mention.save') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import type { MentionSuggestionItem } from '@/composables/stages/useMentionSuggestion'
import { useEntryStore } from '@/stores/entryStore'
import { useProjectStore } from '@/stores/projectStore'
import { LABEL_RE } from '@/utils/labelRegex'

export interface MentionCommandAttrs {
  id: number | string
  label: string
  mentionType?: 'entry'
}

const props = defineProps<{
  items: MentionSuggestionItem[]
  command: (attrs: MentionCommandAttrs) => void
  query: string
}>()

const entryStore = useEntryStore()
const projectStore = useProjectStore()

const activeIndex = ref(0)

watch(() => props.items, () => { activeIndex.value = 0 })
watch(() => props.query,  () => { activeIndex.value = 0 })

const canCreate = computed(() => !!props.query && LABEL_RE.test(props.query))

function itemKey(item: MentionSuggestionItem): string {
  return `e${item.entry.id}`
}

function itemTitle(item: MentionSuggestionItem): string {
  return item.entry.content
}

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
    props.command({ id: row.id, label: row.label, mentionType: 'entry' })
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
    if (!item) return
    props.command({ id: item.entry.id, label: item.entry.label, mentionType: 'entry' })
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

const ACTION_BTN_BASE = 'ctv:relative ctv:inline-flex ctv:items-center ctv:justify-center ctv:gap-2 ctv:cursor-pointer'
  + ' ctv:touch-manipulation ctv:whitespace-nowrap ctv:appearance-none ctv:border-none ctv:transition-colors'
  + ' ctv:h-6 ctv:rounded-sm ctv:px-2 ctv:py-1 ctv:text-xs ctv:font-medium'
  + ' ctv:disabled:pointer-events-none ctv:disabled:opacity-50'
const ACTION_BTN_VARIANTS = {
  default: ' ctv:bg-secondary-background ctv:text-secondary-foreground ctv:hover:bg-secondary-background-hover',
  save:    ' ctv:bg-primary-background ctv:text-base-foreground ctv:hover:bg-primary-background-hover',
} as const
function actionBtn(variant: keyof typeof ACTION_BTN_VARIANTS = 'default') {
  return ACTION_BTN_BASE + ACTION_BTN_VARIANTS[variant]
}
</script>
