<template>
  <div v-if="chips.length" class="ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-1">
    <button type="button" :class="chipClass(filter === 'all')" @click="filter = 'all'">
      {{ $t('assets.category.all') }}
      <span :class="countClass">{{ total }}</span>
    </button>
    <button
      v-for="chip in chips"
      :key="chip.id"
      type="button"
      :class="chipClass(filter === chip.id)"
      @click="filter = filter === chip.id ? 'all' : chip.id"
    >
      {{ chip.name }}
      <span :class="countClass">{{ chip.count }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { TagChip, TagFilter } from '@/composables/sidebar/useItemTags'

defineProps<{
  chips: TagChip[]
  total: number
}>()

const filter = defineModel<TagFilter>({ required: true })

function chipClass(active: boolean) {
  return [
    'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:[font-family:inherit]',
    'ctv:rounded-lg ctv:border ctv:px-2 ctv:py-0.5 ctv:text-2xs ctv:transition-colors',
    active
      ? 'ctv:bg-secondary-background-selected ctv:border-primary-background/60 ctv:text-base-foreground'
      : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground',
  ].join(' ')
}

const countClass = 'ctv:py-0 ctv:px-1 ctv:rounded-lg ctv:text-3xs ctv:bg-base-foreground/10'
</script>
