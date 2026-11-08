<template>
  <section class="ctv:flex ctv:flex-col ctv:gap-1.5">
    <div class="ctv:flex ctv:items-center ctv:gap-1.5">
      <span class="ctv:flex-1 ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:font-semibold ctv:text-muted-foreground">
        {{ $t('stageGroups.title') }}
      </span>
      <button
        :class="saveBtnClass"
        :disabled="!canSave"
        @click="onSave"
      >
        <IconPlus class="ctv:size-3.5" />
        {{ $t('stageGroups.save') }}
      </button>
    </div>

    <div v-if="groups.length === 0" class="ctv:py-2 ctv:px-1.5 ctv:italic ctv:text-muted-foreground/60">
      {{ $t('stageGroups.empty') }}
    </div>

    <div class="ctv:grid ctv:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] ctv:gap-2">
      <div
        v-for="g in groups"
        :key="g.id"
        draggable="true"
        class="ctv:group ctv:relative ctv:flex ctv:flex-col ctv:rounded-lg ctv:overflow-hidden ctv:cursor-grab
               ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:hover:border-primary-background"
        :title="$t('stageGroups.insertHint')"
        @click="onInsert(g)"
        @dragstart="onDragStart(g, $event)"
      >
        <div class="ctv:aspect-[8/5] ctv:flex ctv:items-center ctv:justify-center ctv:bg-base-background">
          <img
            v-if="g.thumbnail_url"
            :src="g.thumbnail_url"
            :alt="g.name"
            draggable="false"
            class="ctv:size-full ctv:object-contain"
          >
          <IconBoxes v-else class="ctv:size-6 ctv:text-muted-foreground" />
        </div>
        <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:py-1.5 ctv:px-2">
          <span class="ctv:flex-1 ctv:min-w-0 ctv:truncate ctv:font-semibold">{{ g.name }}</span>
          <span class="ctv:text-2xs ctv:tabular-nums ctv:text-muted-foreground">{{ nodeCountOf(g) }}</span>
        </div>
        <div class="ctv:absolute ctv:top-1 ctv:right-1 ctv:flex ctv:gap-0.5 ctv:opacity-0 ctv:group-hover:opacity-100">
          <button :class="iconBtnClass" :title="$t('stageGroups.rename')" @click.stop="onRename(g)">
            <IconPencil class="ctv:size-3.5" />
          </button>
          <button
            :class="[iconBtnClass, 'ctv:hover:text-destructive-background']"
            :title="$t('stageGroups.delete')"
            @click.stop="onDelete(g)"
          >
            <IconTrash2 class="ctv:size-3.5" />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { nodeCountOf, useStageGroups } from '@/composables/sidebar/useStageGroups'

import IconBoxes from '~icons/lucide/boxes'
import IconPencil from '~icons/lucide/pencil'
import IconPlus from '~icons/lucide/plus'
import IconTrash2 from '~icons/lucide/trash-2'

const props = defineProps<{ active?: boolean }>()

const { groups, canSave, onSave, onRename, onDelete, onInsert, onDragStart } = useStageGroups(() => props.active)

const saveBtnClass = 'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:shrink-0 ctv:[font-family:inherit] '
  + 'ctv:rounded-md ctv:border-none ctv:bg-secondary-background ctv:py-1 ctv:px-2 ctv:text-2xs ctv:text-base-foreground '
  + 'ctv:hover:bg-secondary-background-hover ctv:disabled:opacity-50 ctv:disabled:pointer-events-none'
const iconBtnClass = 'ctv:inline-flex ctv:items-center ctv:justify-center ctv:cursor-pointer ctv:shrink-0 '
  + 'ctv:rounded-md ctv:border-none ctv:bg-secondary-background ctv:p-1 ctv:text-muted-foreground '
  + 'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground'
</script>
