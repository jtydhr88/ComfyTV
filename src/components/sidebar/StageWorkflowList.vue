<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5">
    <div class="ctv:flex ctv:items-center ctv:gap-1.5">
      <span class="ctv:text-3xs ctv:font-mono ctv:py-px ctv:px-1.5 ctv:rounded-lg ctv:bg-base-foreground/5 ctv:text-muted-foreground">
        {{ rows.length }}
      </span>
      <span class="ctv:flex-1"></span>
      <button :class="iconBtn" :title="$t('stageManager.refresh')" :disabled="loading" @click="reload">
        <i :class="['pi pi-refresh', loading ? 'pi-spin' : '']" />
      </button>
      <button :class="importBtn" :title="$t('stageManager.rescanTooltip')" :disabled="rescanBusy" @click="onRescan">
        <i :class="['pi pi-sync', rescanBusy ? 'pi-spin' : '']" /> {{ $t('stageManager.rescan') }}
      </button>
      <button :class="importBtn" :disabled="importBusy" @click="onImport">
        <i class="pi pi-upload" /> {{ $t('stageManager.import') }}
      </button>
    </div>

    <div v-if="loadError"
         class="ctv:py-1.5 ctv:px-2 ctv:text-xs ctv:rounded
                ctv:bg-destructive-background/15 ctv:border ctv:border-destructive-background/50 ctv:text-destructive-background">
      {{ loadError }}
    </div>

    <div v-else-if="!loading && rows.length === 0"
         class="ctv:py-3 ctv:text-center ctv:italic ctv:text-muted-foreground/60">
      {{ $t('stageManager.emptyWorkflows') }}
    </div>

    <div
      v-for="w in rows"
      :key="w.id"
      class="ctv:flex ctv:flex-col ctv:gap-0.5 ctv:py-1.5 ctv:px-2 ctv:rounded ctv:border ctv:border-border-subtle"
    >
      <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:flex-wrap">
        <span class="ctv:font-semibold ctv:truncate">{{ w.label }}</span>
        <span v-if="recentAdded.has(w.label)"
              :class="[badge, 'ctv:bg-success-background/15 ctv:text-success-background']"
              :title="$t('stageManager.badge.newHint')">
          {{ $t('stageManager.badge.new') }}
        </span>
        <span v-if="w.builtin"
              :class="[badge, 'ctv:bg-base-foreground/10 ctv:text-muted-foreground']"
              :title="$t('stageManager.badge.builtinHint')">
          {{ $t('stageManager.badge.builtin') }}
        </span>
        <span v-if="w.link_type === LINK_TYPE_NATIVE"
              :class="[badge, 'ctv:bg-primary-background/10 ctv:text-primary-foreground']"
              :title="$t('stageManager.badge.linkedHint')">
          <i class="pi pi-link ctv:text-3xs" /> {{ $t('stageManager.badge.linked') }}
        </span>
        <span v-if="!w.file_exists"
              :class="[badge, 'ctv:bg-destructive-background/15 ctv:text-destructive-background']"
              :title="w.file_path">
          <i class="pi pi-exclamation-triangle ctv:text-3xs" /> {{ $t('stageManager.badge.fileMissing') }}
        </span>
        <span v-else-if="w.gui_valid === false"
              :class="[badge, 'ctv:bg-warning-background/15 ctv:text-warning-background']"
              :title="$t('stageManager.badge.notGuiHint')">
          <i class="pi pi-exclamation-triangle ctv:text-3xs" /> {{ $t('stageManager.badge.notGui') }}
        </span>
        <span v-if="w.file_exists && w.gui_valid !== false && !w.has_api"
              :class="[badge, 'ctv:bg-base-foreground/5 ctv:text-muted-foreground']"
              :title="$t('stageManager.badge.noApiHint')">
          {{ $t('stageManager.badge.noApi') }}
        </span>
      </div>
      <div class="ctv:text-3xs ctv:font-mono ctv:text-muted-foreground ctv:truncate" :title="w.file_path">
        {{ fileName(w.file_path) }}
      </div>
      <div v-if="w.description" class="ctv:text-3xs ctv:text-muted-foreground/80 ctv:truncate" :title="w.description">
        {{ w.description }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { LINK_TYPE_NATIVE } from '@/api'
import {
  useStageWorkflowList,
  workflowFileName as fileName,
} from '@/composables/sidebar/useStageWorkflowList'

const props = defineProps<{ kind: string; active?: boolean }>()
const emit = defineEmits<{ (e: 'kinds', kinds: string[]): void }>()

const {
  rows,
  loading,
  loadError,
  importBusy,
  rescanBusy,
  recentAdded,
  reload,
  onRescan,
  onImport,
} = useStageWorkflowList(
  computed(() => props.kind),
  () => props.active,
  (kinds) => emit('kinds', kinds),
)

defineExpose({ reload })

const badge = 'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:py-px ctv:px-1.5 ctv:rounded ctv:text-3xs ctv:whitespace-nowrap'
const iconBtn = 'ctv:shrink-0 ctv:flex ctv:items-center ctv:justify-center ctv:size-6 ctv:rounded-sm ctv:cursor-pointer ctv:text-xs'
  + ' ctv:border-none ctv:bg-transparent ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover'
  + ' ctv:disabled:pointer-events-none ctv:disabled:opacity-50'
const importBtn = 'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:h-6 ctv:px-2 ctv:rounded-sm ctv:text-xs ctv:font-medium ctv:cursor-pointer'
  + ' ctv:border-none ctv:text-secondary-foreground ctv:bg-secondary-background ctv:hover:bg-secondary-background-hover'
  + ' ctv:disabled:pointer-events-none ctv:disabled:opacity-50'
</script>
