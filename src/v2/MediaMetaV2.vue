<template>
  <div v-if="tokens.length || genTime" class="v2-meta" :title="hoverTitle">
    <span v-if="info?.format" class="v2-meta__fmt">{{ info.format }}</span>
    <span v-for="tok in tokens" :key="tok" class="v2-meta__tok">{{ tok }}</span>
    <span class="v2-meta__spacer" />
    <span v-if="genTime" class="v2-meta__gen" :title="t('v2.meta.genTime', { t: genTime })">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </svg>
      {{ genTime }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMediaInfo } from '@/composables/stages/useMediaInfo'
import { formatDuration } from '@/utils/mediaFormat'
import { fileNameFromUrl, metaTokens } from '@/v2/mediaMeta'

const { t } = useI18n()

const props = defineProps<{
  url?: string | null
  durationMs?: number | null
}>()

const info = useMediaInfo(() => props.url)
const tokens = computed(() => metaTokens(info.value, t))
const genTime = computed(() => {
  const ms = Number(props.durationMs)
  return Number.isFinite(ms) && ms > 0 ? formatDuration(ms) : ''
})
const hoverTitle = computed(() => {
  const name = props.url ? fileNameFromUrl(props.url) : ''
  const codec = info.value?.codec ? String(info.value.codec).toUpperCase() : ''
  return [name, codec].filter(Boolean).join(' · ')
})
</script>

<style scoped>
.v2-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 6px 0;
  min-height: 15px;
  color: var(--v2-text-muted);
  font: 500 10.5px/1 system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  user-select: none;
}
.v2-meta__fmt {
  flex: none;
  padding: 2px 5px;
  border-radius: 5px;
  background: var(--v2-chip-bg);
  border: 1px solid var(--v2-chip-border);
  color: var(--v2-text-mid);
  font: 600 9px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .04em;
}
.v2-meta__tok { flex: none; }
.v2-meta__tok + .v2-meta__tok::before {
  content: '·';
  margin-right: 8px;
  color: var(--v2-text-faint);
}
.v2-meta__spacer { flex: 1; min-width: 4px; }
.v2-meta__gen {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--v2-text-faint);
}
.v2-meta__gen svg { width: 11px; height: 11px; }
</style>
