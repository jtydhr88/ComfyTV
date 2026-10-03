<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { agentEnabled, agentProviders, agentStatusChecking, agentStatusDeferred, agentStatusError, agentStatusFetchedAt, agentStatusStale, refreshHermesHealth } from '../status'
import { diagnosticRepairs, diagnosticRows, diagnosticSummary } from './diagnostics'
defineProps<{ dirty?: boolean; compact?: boolean }>()
const { t } = useI18n()
const health = computed(() => agentProviders.value.find(p => p.id === 'hermes')?.health)
const rows = computed(() => diagnosticRows(health.value, t))
const repairs = computed(() => diagnosticRepairs(health.value, t))
const summary = computed(() => diagnosticSummary(health.value, t))
const fetched = computed(() => agentStatusFetchedAt.value === null ? t('diagnostics.unknown') : new Date(agentStatusFetchedAt.value).toISOString())
</script>

<template>
  <details class="provider-diagnostics" :class="{ compact }">
    <summary>{{ t('diagnostics.title') }}</summary>
    <div class="diagnostics-body">
      <p>{{ t(dirty ? 'diagnostics.draft' : 'diagnostics.saved') }}</p>
      <p>{{ t('diagnostics.scope') }}</p>
      <p>{{ summary }}</p>
      <p v-if="!agentEnabled && agentStatusFetchedAt !== null">{{ t('diagnostics.disabled') }}</p>
      <p v-if="!health">{{ t('diagnostics.unsupported') }}</p>
      <p role="status" aria-live="polite">
        <span v-if="agentStatusChecking">{{ t('diagnostics.checking') }} </span>
        <span v-if="agentStatusDeferred">{{ t('diagnostics.deferred') }} </span>
        <span v-if="agentStatusError">{{ t(`diagnostics.${agentStatusError}`) }} </span>
        <span v-if="agentStatusStale || health?.stale">{{ t('diagnostics.stale') }}</span>
      </p>
      <button type="button" :disabled="agentStatusChecking" @click="refreshHermesHealth">{{ t('diagnostics.refresh') }}</button>
      <p>{{ t('diagnostics.fetched') }}: {{ fetched }}</p>
      <p>{{ t('diagnostics.checked') }}: {{ health?.checked_at ?? t('diagnostics.unknown') }} · {{ t('diagnostics.age') }}: {{ health?.age_ms ?? t('diagnostics.unknown') }}</p>
      <dl>
        <template v-for="row in rows" :key="row.label">
          <dt>{{ row.label }}</dt><dd>{{ row.value }}</dd>
        </template>
      </dl>
      <p>{{ t('diagnostics.evidenceScope') }}</p>
      <ul v-if="repairs.length"><li v-for="(repair, index) in repairs" :key="index">{{ repair }}</li></ul>
    </div>
  </details>
</template>

<style scoped>
.provider-diagnostics { position: relative; font-size: 12px; }
summary, button { cursor: pointer; padding: 6px; }
summary:focus-visible, button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.diagnostics-body { padding: 12px; overflow-wrap: anywhere; line-height: 1.5; }
.diagnostics-body p { margin: 0 0 10px; }
.diagnostics-body dl { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 6px 12px; margin: 12px 0; }
.diagnostics-body dt { font-weight: 600; }
.diagnostics-body dd { margin: 0; }
.diagnostics-body button { color: inherit; background: transparent; font: inherit; border: 1px solid currentColor; border-radius: 6px; margin-bottom: 10px; }
.diagnostics-body button:disabled { cursor: wait; opacity: .65; }
/* The dock clips overflow; use a viewport panel rather than clipping essential evidence. */
.compact .diagnostics-body { position: fixed; right: 12px; top: 76px; width: min(440px, 85vw); max-height: 70vh; overflow-y: auto; z-index: 1100; background: var(--agent-surface, #242424); color: var(--agent-fg, #eee); border: 1px solid #777; border-radius: 8px; }
</style>
