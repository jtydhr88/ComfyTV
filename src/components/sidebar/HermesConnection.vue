<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '@agent/scripts/api'
import { createInteractionChannel } from '@/agent/native/services/agent/agentInteractionChannel'
import { connectionStatusSchema, connectionMutationSchema, connectionTestSchema, connectionErrorSchema, type ConnectionStatus } from '@/api/schemas/hermesConnection'
import { invalidateAgentStatus } from '@/agent/status'
const props = defineProps<{ active?: boolean; model?: string }>()
const { t } = useI18n()
const base = '/comfytv/hermes/connection'
const status = ref<ConnectionStatus | null>(null)
const busy = ref(false)
const operationBusy = ref(false)
const message = ref('')
const draftEndpoint = ref('')
const pairingCode = ref('')
const clientToken = ref('')
const codeInput = ref<HTMLInputElement | null>(null)
const tokenInput = ref<HTMLInputElement | null>(null)
const draftMcp = ref('')
const confirmDisconnect = ref(false)
const revokeRemote = ref(true)
const emit = defineEmits<{ changed: [] }>()
function clearSecrets() {
  pairingCode.value = ''; clientToken.value = ''
  if (codeInput.value) codeInput.value.value = ''
  if (tokenInput.value) tokenInput.value.value = ''
}
const channel = createInteractionChannel((route, init) => api.fetchApi(route, init), window.location.origin)
const authorized = computed(() => props.active === true && status.value?.can_manage === true && channel.available.value)
const manageable = computed(() => authorized.value && !busy.value && !operationBusy.value)
let generation = 0
async function readStatus(headers: Record<string, string> = {}) {
  const response = await api.fetchApi(base, { method: 'GET', credentials: 'same-origin', redirect: 'error', headers })
  if (!response.ok) throw new Error('unavailable')
  return connectionStatusSchema.parse(await response.json())
}
async function load() {
  clearSecrets()
  const owned = ++generation
  busy.value = true
  status.value = null
  message.value = ''
  try {
    const publicStatus = await readStatus()
    if (owned !== generation) return
    status.value = publicStatus
    await channel.open()
    if (owned !== generation) return
    if (channel.isAvailable()) {
      const localStatus = await readStatus(channel.headers(base))
      if (owned !== generation) return
      status.value = localStatus
    }
  } catch { if (owned === generation) { status.value = null; message.value = 'unavailable' } }
  finally { if (owned === generation) busy.value = false }
}
async function perform(action: 'pair' | 'import' | 'migrate' | 'test' | 'disconnect', body: Record<string, unknown>) {
  clearSecrets()
  if (!manageable.value || (!['test', 'disconnect'].includes(action) && !status.value?.secure_storage.available) || (action === 'test' && !status.value?.configured) || (action === 'disconnect' && !confirmDisconnect.value)) return
  confirmDisconnect.value = false
  const owned = generation
  operationBusy.value = true
  message.value = ''
  try {
    const route = base + '/' + action
    const response = await api.fetchApi(route, { method: 'POST', credentials: 'same-origin', redirect: 'error', headers: { 'Content-Type': 'application/json', ...channel.headers(route) }, body: JSON.stringify(body) })
    if (!response.ok) {
      const error = connectionErrorSchema.safeParse(await response.json())
      if (owned === generation) message.value = error.success && error.data.error === 'setup_pending' ? 'pending' : 'failed'
      return
    }
    let expected: ConnectionStatus | undefined
    if (action === 'test') connectionTestSchema.parse(await response.json())
    else {
      const mutation = connectionMutationSchema.parse(await response.json())
      if (mutation.status !== (action === 'disconnect' ? 'disconnected' : 'configured')) throw new Error('protocol')
      expected = mutation.connection
    }
    if (owned !== generation) return
    const saved = await readStatus(channel.headers(base))
    if (owned !== generation) return
    if (expected && ['source', 'configured', 'endpoint', 'mcp_server', 'credential_id'].some(key => saved[key as keyof ConnectionStatus] !== expected![key as keyof ConnectionStatus])) throw new Error('readback')
    status.value = saved
    message.value = action === 'disconnect' ? (body.revoke_remote ? 'revoked' : 'localOnly') : action === 'test' ? 'tested' : 'saved'
    void invalidateAgentStatus()
    emit('changed')
  } catch { if (owned === generation) message.value = 'pending' }
  finally { operationBusy.value = false }
}
function pair() { void perform('pair', { schema_version: 1, endpoint: draftEndpoint.value, pairing_code: pairingCode.value }) }
function importToken() { void perform('import', { schema_version: 1, endpoint: draftEndpoint.value, client_token: clientToken.value, mcp_server: draftMcp.value }) }
watch(() => props.active, active => { clearSecrets(); if (active) void load(); else { generation++; channel.close(); status.value = null; busy.value = false } }, { immediate: true })
onBeforeUnmount(() => { clearSecrets(); generation++; channel.close() })
</script>
<template>
  <details class="hermes-connection">
    <summary>{{ t('hermesConnection.title') }}<span v-if="status"> · {{ t(`hermesConnection.sources.${status.source}`) }}</span></summary>
    <div class="connection-body">
      <p v-if="busy || operationBusy">{{ t('hermesConnection.checking') }}</p>
      <p data-testid="result" role="status" v-if="message">{{ t(`hermesConnection.${message}`) }}</p>
      <template v-if="status">
        <p data-testid="source">{{ t('hermesConnection.source') }}: {{ status.source }}</p>
        <p>{{ t(`hermesConnection.sources.${status.source}`) }}</p>
        <p>{{ t(status.configured ? 'hermesConnection.configured' : 'hermesConnection.unconfigured') }}</p>
        <p data-testid="endpoint">{{ status.endpoint }}</p>
        <p>{{ t('hermesConnection.mcp') }}: {{ status.mcp_server }}</p>
        <p>{{ t('hermesConnection.model') }}: {{ model || '—' }}</p>
        <p>{{ t('hermesConnection.storage') }}: {{ status.secure_storage.backend }}</p>
        <p v-if="!status.secure_storage.available">{{ t('hermesConnection.storageUnavailable') }}</p>
        <p data-testid="readonly" v-if="!authorized">{{ t('hermesConnection.readonly') }}</p>
      </template>
      <details><summary>{{ t('hermesConnection.pair') }}</summary>
      <p>{{ t('hermesConnection.pairHelp') }}</p>
      <p>{{ t('hermesConnection.transportHelp') }}</p>
      <label>{{ t('hermesConnection.endpoint') }}<input data-testid="draft-endpoint" v-model="draftEndpoint" :disabled="!manageable" type="url" autocomplete="off" maxlength="2048" /></label>
      <label>{{ t('hermesConnection.code') }}<input ref="codeInput" data-testid="pairing-code" v-model="pairingCode" :disabled="!manageable" type="password" autocomplete="off" maxlength="1024" spellcheck="false" /></label>
      <button data-testid="pair" :disabled="!manageable || !status?.secure_storage.available" @click="pair">{{ t('hermesConnection.pair') }}</button>
      </details>
      <button data-testid="test" :disabled="!manageable || !status?.configured" @click="perform('test', { schema_version: 1 })">{{ t('hermesConnection.test') }}</button>
      <button v-for="from in (['legacy_dpapi', 'environment'] as const)" :key="from" :data-testid="'migrate-' + from" :disabled="!manageable || !status?.secure_storage.available || !status?.migration[from]" @click="perform('migrate', { schema_version: 1, from })">{{ t(`hermesConnection.migrate_${from}`) }}</button>
      <p v-if="status?.migration.legacy_dpapi || status?.migration.environment">{{ t('hermesConnection.migrationHelp') }}</p>
      <details><summary>{{ t('hermesConnection.advanced') }}</summary>
        <p>{{ t('hermesConnection.importHelp') }}</p>
        <label>{{ t('hermesConnection.endpoint') }}<input v-model="draftEndpoint" :disabled="!manageable" type="url" autocomplete="off" maxlength="2048" /></label>
        <label>{{ t('hermesConnection.token') }}<input ref="tokenInput" data-testid="client-token" v-model="clientToken" :disabled="!manageable" type="password" autocomplete="off" maxlength="4096" spellcheck="false" /></label>
        <label>{{ t('hermesConnection.mcp') }}<input data-testid="draft-mcp" v-model="draftMcp" :disabled="!manageable" autocomplete="off" /></label>
        <button data-testid="import" :disabled="!manageable || !status?.secure_storage.available" @click="importToken">{{ t('hermesConnection.import') }}</button>
      </details>
      <details><summary>{{ t('hermesConnection.disconnect') }}</summary>
        <p>{{ t('hermesConnection.revokeHelp') }}</p>
        <label class="check"><input data-testid="revoke-remote" v-model="revokeRemote" type="checkbox" :disabled="!manageable" />{{ t('hermesConnection.revokeRemote') }}</label>
        <p v-if="!revokeRemote">{{ t('hermesConnection.localOnlyWarning') }}</p>
        <label class="check"><input data-testid="confirm-disconnect" v-model="confirmDisconnect" type="checkbox" :disabled="!manageable" />{{ t('hermesConnection.confirmDisconnect') }}</label>
        <button data-testid="disconnect" :disabled="!manageable || !confirmDisconnect" @click="perform('disconnect', { schema_version: 1, revoke_remote: revokeRemote })">{{ t('hermesConnection.disconnect') }}</button>
      </details>
      <button data-testid="refresh" :disabled="busy || operationBusy || !active" @click="load">{{ t('hermesConnection.refresh') }}</button>
    </div>
  </details>
</template>
<style scoped>
.hermes-connection { font-size: 12px; min-width: 0; }
summary { cursor: pointer; padding: 6px; }
.connection-body { padding: 10px; overflow-wrap: anywhere; line-height: 1.5; }
p { margin: 0 0 8px; }
label { display: flex; flex-direction: column; gap: 4px; margin: 8px 0; }
label.check { flex-direction: row; align-items: flex-start; }
input { font: inherit; color: inherit; background: transparent; border: 1px solid currentColor; border-radius: 4px; padding: 6px; min-width: 0; max-width: 100%; box-sizing: border-box; }
input[type='checkbox'] { flex-shrink: 0; }
button { margin: 4px 4px 8px 0; }
summary:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
button { font: inherit; color: inherit; background: transparent; border: 1px solid currentColor; border-radius: 6px; padding: 6px; cursor: pointer; }
button:disabled { opacity: .5; cursor: default; }
</style>
