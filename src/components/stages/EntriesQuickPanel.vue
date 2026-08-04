<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1 ctv:mt-1 ctv:p-2 ctv:rounded ctv:text-xs
              ctv:bg-interface-menu-surface ctv:text-base-foreground
              ctv:border ctv:border-border-default">
    <div v-if="allRows.length === 0"
         class="ctv:py-2 ctv:text-center ctv:italic ctv:text-muted-foreground">
      {{ $t('promptEntries.empty') }}
    </div>
    <div v-else class="ctv:relative">
      <i class="pi pi-search ctv:absolute ctv:left-2 ctv:top-1/2 ctv:-translate-y-1/2 ctv:text-2xs
                ctv:text-muted-foreground ctv:pointer-events-none" />
      <input
        v-model="query"
        type="text"
        :placeholder="$t('promptEntries.searchPlaceholder')"
        class="ctv:w-full ctv:h-6 ctv:box-border ctv:pl-6 ctv:pr-2 ctv:rounded-sm ctv:text-2xs ctv:[font-family:inherit]
               ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground
               ctv:placeholder:text-muted-foreground ctv:focus-visible:outline-none ctv:focus:border-border-default"
        @keydown.stop
      />
    </div>
    <div v-if="allRows.length > 0 && rows.length === 0"
         class="ctv:py-2 ctv:text-center ctv:italic ctv:text-muted-foreground">
      {{ $t('promptEntries.noMatch') }}
    </div>
    <div class="ctv-scroll-thin ctv:max-h-48 ctv:overflow-y-auto ctv:flex ctv:flex-col ctv:gap-0.5">
      <div
        v-for="entry in rows"
        :key="entry.id"
        class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:py-1 ctv:px-1.5 ctv:rounded
               ctv:hover:bg-interface-menu-component-surface-hovered"
      >
        <span class="ctv:font-mono ctv:shrink-0 ctv:text-2xs">
          <i v-if="entry.kind === 'prompt'"
             class="pi pi-file-import ctv:text-2xs ctv:mr-1 ctv:text-primary-background" />@{{ entry.label }}</span>
        <span v-if="entry.kind === 'prompt'"
              class="ctv:shrink-0 ctv:py-0 ctv:px-1 ctv:rounded ctv:text-3xs
                     ctv:bg-primary-background/15 ctv:text-primary-background">
          {{ $t('mention.promptBadge') }}
        </span>
        <span class="ctv:flex-1 ctv:text-muted-foreground ctv:text-2xs ctv:overflow-hidden ctv:text-ellipsis ctv:whitespace-nowrap"
              :title="entry.content">
          {{ entry.content }}
        </span>
        <button
          type="button"
          class="ctv:shrink-0 ctv:inline-flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:[font-family:inherit]
                 ctv:h-5 ctv:rounded-sm ctv:px-1.5 ctv:text-2xs ctv:border ctv:border-border-default ctv:transition-colors
                 ctv:bg-secondary-background ctv:text-muted-foreground
                 ctv:hover:bg-primary-background/20 ctv:hover:border-primary-background/50 ctv:hover:text-primary-background"
          @click="$emit('insert', entry)"
        >{{ $t('promptEntries.insert') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Entry } from '@/api/schemas'
import { useEntryStore } from '@/stores/entryStore'
import { useProjectStore } from '@/stores/projectStore'

defineEmits<{
  insert: [entry: Entry]
}>()

const entryStore = useEntryStore()
const projectStore = useProjectStore()

const query = ref('')

const allRows = computed<Entry[]>(() =>
  entryStore.list(projectStore.currentProjectId || ''),
)

const rows = computed<Entry[]>(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return allRows.value
  return allRows.value.filter(e =>
    e.label.toLowerCase().includes(q) || e.content.toLowerCase().includes(q),
  )
})
</script>
