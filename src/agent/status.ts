import { ref, watch } from 'vue'
import { agentBusy } from '@agent/comfytv/actions'
import { api } from '@agent/scripts/api'
import { type BotProviderStatus, BotStatusSchema, HermesHealthResponseSchema } from '@/api/schemas/bot'
import { setAgentPanelEnabled } from './mount'

export const agentProviders = ref<BotProviderStatus[]>([])
export const agentEnabled = ref(false)
export const agentStatusError = ref<'unavailable' | 'unsupported' | null>(null)
export const agentStatusFetchedAt = ref<number | null>(null)
export const agentStatusChecking = ref(false)
export const agentStatusDeferred = ref(false)
export const agentStatusStale = ref(false)
export const agentStatusGeneration = ref(0)

type Scope = 'all' | 'hermes'
let inflight: Promise<boolean> | null = null
let attempted = false
let pending: Scope | null = null
let legacyFallbackUsed = false

// Invalidation belongs to successful saves, never draft keystrokes.
export function invalidateAgentStatus(): Promise<boolean> {
  agentStatusGeneration.value++
  legacyFallbackUsed = false
  agentStatusStale.value = true
  attempted = false
  pending = 'all'
  return refreshAgentStatus()
}

watch(agentBusy, busy => { if (!busy && pending) void requestStatus(pending) })

export function ensureAgentStatus(): Promise<boolean> {
  return inflight ?? (attempted ? Promise.resolve(agentEnabled.value) : refreshAgentStatus())
}
export function refreshAgentStatus(): Promise<boolean> { return requestStatus('all') }
export function refreshHermesHealth(): Promise<boolean> { return requestStatus('hermes') }

function requestStatus(scope: Scope): Promise<boolean> {
  if (agentBusy.value) {
    pending = pending === 'all' ? 'all' : scope
    agentStatusDeferred.value = true
    return Promise.resolve(agentEnabled.value)
  }
  if (inflight) return inflight
  if (pending === 'all') scope = 'all'
  pending = null
  agentStatusDeferred.value = false
  attempted = true
  agentStatusChecking.value = true
  inflight = fetchStatus(scope, agentStatusGeneration.value).finally(() => {
    inflight = null
    agentStatusChecking.value = false
    if (pending && !agentBusy.value) void requestStatus(pending)
  })
  return inflight
}

async function fetchStatus(scope: Scope, generation: number): Promise<boolean> {
  try {
    if (scope === 'hermes' && legacyFallbackUsed) {
      agentStatusError.value = 'unsupported'
      return agentEnabled.value
    }
    let response = await api.fetchApi(scope === 'all' ? '/comfytv/bot/status' : '/comfytv/bot/providers/hermes/health')
    if (scope === 'hermes' && response.status === 404) {
      if (generation !== agentStatusGeneration.value) return agentEnabled.value
      legacyFallbackUsed = true
      if (agentBusy.value) return requestStatus('all')
      scope = 'all'
      response = await api.fetchApi('/comfytv/bot/status')
    }
    if (!response.ok) throw new Error('unavailable')
    // Do not use apiFetch: its schema failure logger includes raw upstream data.
    const raw: unknown = await response.json()
    const data = scope === 'all' ? BotStatusSchema.parse(raw) : HermesHealthResponseSchema.parse(raw)
    if (generation !== agentStatusGeneration.value) return agentEnabled.value
    agentProviders.value = 'providers' in data ? data.providers
      : data.enabled && data.provider ? [...agentProviders.value.filter(p => p.id !== 'hermes'), data.provider] : []
    agentEnabled.value = data.enabled !== false
    agentStatusFetchedAt.value = Date.now()
    agentStatusStale.value = false
    agentStatusError.value = legacyFallbackUsed && scope === 'all' ? 'unsupported' : null
    setAgentPanelEnabled(agentEnabled.value)
  } catch {
    if (generation === agentStatusGeneration.value) {
      agentStatusError.value = 'unavailable'
      agentStatusStale.value = true
    }
  }
  return agentEnabled.value
}
