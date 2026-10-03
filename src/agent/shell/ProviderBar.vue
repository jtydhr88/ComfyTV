<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from 'reka-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import {
  AGENT_REKA_TOOLTIP_CONTENT_CLASS,
  AGENT_REKA_TOOLTIP_PROVIDER_PROPS,
} from '@agent/composables/useTooltipConfig'
import { agentBusy, requestNewChat } from '@agent/comfytv/actions'
import { api } from '@agent/scripts/api'
import { app } from '@agent/scripts/app'
import { agentProviders, agentStatusGeneration, invalidateAgentStatus } from '@/agent/status'
import ProviderDiagnostics from './ProviderDiagnostics.vue'
import { diagnosticSummary } from './diagnostics'

const { t } = useI18n()
const providers = agentProviders
const provider = ref('')
const model = ref('')
const loaded = ref(false)
const providerSaveError = ref(false)
const providerSaving = ref(false)
const providerOpen = ref(false)
const providerTrigger = ref<HTMLElement | null>(null)
const modelOpen = ref(false)
const modelDraft = ref('')

const LABELS: Record<string, string> = {
  'local-llm': 'Local LLM', 'claude-code': 'Claude Code', codex: 'Codex', 'qwen-code': 'Qwen Code',
  'deepseek-harness': 'DeepSeek Harness',
}
const ROUTES: Record<string, string> = {
  'deepseek-account': 'agentBar.routeAccount',
  'deepseek-official': 'agentBar.routeApiKey',
}
const current = computed(() => providers.value.find((p) => p.id === provider.value))
const providerLabel = computed(() => current.value?.label ?? LABELS[provider.value] ?? t('agentBar.provider'))
const models = computed(() => current.value?.models ?? [])
const modelRows = computed(() => current.value?.model_options ?? [])
const modelLabel = computed(() => {
  const row = modelRows.value.find((r) => r.value === model.value)
  return row?.label ?? model.value
})
function routeLabel(group?: string): string {
  if (!group) return ''
  const key = ROUTES[group]
  return key ? t(key) : group
}
const statusText = computed(() => {
  const p = current.value
  if (!p) return ''
  return p.id === 'hermes' ? diagnosticSummary(p.health, t) : [p.detail, p.version].filter(Boolean).join(' · ') || t('diagnostics.incomplete')
})

const chipClass =
  'ctv:group ctv:text-agent-fg ctv:hover:bg-agent-surface-hover ctv:inline-flex ctv:h-7 ctv:min-w-0 ctv:cursor-pointer ctv:items-center ctv:gap-2 ctv:rounded-lg ctv:px-2.5 ctv:text-xs/4 ctv:font-medium ctv:transition-colors'
const menuClass =
  'agent-scope ctv:bg-agent-surface-raised ctv:z-1100 ctv:box-border ctv:max-h-72 ctv:min-w-56 ctv:overflow-y-auto ctv:rounded-[10px] ctv:border ctv:border-white/10 ctv:p-1 ctv:font-inter ctv:shadow-lg'
const itemClass =
  'ctv:text-agent-fg ctv:box-border ctv:flex ctv:h-7 ctv:w-full ctv:cursor-pointer ctv:items-center ctv:gap-1.5 ctv:rounded-lg ctv:px-1.5 ctv:py-1 ctv:text-[14px]/5 ctv:font-normal ctv:outline-none ctv:data-highlighted:bg-[#404040] ctv:data-disabled:cursor-not-allowed ctv:data-disabled:opacity-50'

async function fetchJson(path: string, init?: RequestInit): Promise<any> {
  const res = await api.fetchApi(path, init)
  return res.ok ? res.json() : null
}

function putSettings(values: Record<string, unknown>): Promise<any> {
  return fetchJson('/comfytv/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  })
}

const settings = ref<Record<string, unknown>>({})

async function load(): Promise<void> {
  const generation = agentStatusGeneration.value
  try {
    const rows = (await fetchJson('/comfytv/settings'))?.settings
    if (!Array.isArray(rows) || generation !== agentStatusGeneration.value) return
    settings.value = Object.fromEntries(rows.map((r: { key: string; value: unknown }) => [r.key, r.value]))
    const configured = String(settings.value['bot-provider'] ?? '')
    provider.value = providers.value.some(p => p.id === configured) ? configured : providers.value.find(p => p.available)?.id ?? configured
    model.value = String(settings.value[`bot-model-${provider.value}`] ?? '')
    loaded.value = true
  } catch { /* Keep established selection. Diagnostics owns fetch error presentation. */ }
}

async function setProvider(selected: unknown): Promise<void> {
  const id = typeof selected === 'string' ? selected : ''
  if (!id || id === provider.value || !providers.value.some((p) => p.id === id)) return
  if (providerSaving.value) return
  providerSaving.value = true
  providerSaveError.value = false
  try {
    const saved = await putSettings({ 'bot-provider': id })
    if (!saved) { providerSaveError.value = true; return }
    settings.value['bot-provider'] = id
    provider.value = id
    model.value = String(settings.value[`bot-model-${id}`] ?? '')
    void invalidateAgentStatus()
    requestNewChat()
  } catch {
    providerSaveError.value = true
  } finally {
    providerSaving.value = false
  }
}

async function setModel(selected: unknown): Promise<void> {
  const value = typeof selected === 'string' ? selected : ''
  const id = provider.value
  const saved = await putSettings({ [`bot-model-${id}`]: value })
  if (saved) {
    settings.value[`bot-model-${id}`] = value
    if (provider.value === id) model.value = value
    void invalidateAgentStatus()
  }
}

function onModelOpen(next: boolean): void {
  modelOpen.value = next
  if (!next) return
  modelDraft.value = model.value
}

async function commitModelDraft(): Promise<void> {
  await setModel(modelDraft.value.trim())
  modelOpen.value = false
}

function openSettings(): void {
  const tabs = app.extensionManager?.sidebarTab
  if (typeof tabs?.toggleSidebarTab === 'function') tabs.toggleSidebarTab('comfytv-workflow-config')
}

onMounted(() => void load())
watch(agentStatusGeneration, () => void load())
</script>

<template>
  <div class="ctv:border-agent-border ctv:flex ctv:flex-wrap ctv:shrink-0 ctv:items-center ctv:gap-1 ctv:border-b ctv:px-2.5 ctv:py-1.5">
    <DropdownMenuRoot v-model:open="providerOpen">
      <TooltipProvider v-bind="AGENT_REKA_TOOLTIP_PROVIDER_PROPS">
        <TooltipRoot>
          <DropdownMenuTrigger as-child>
            <TooltipTrigger as-child>
              <button
                ref="providerTrigger"
                :aria-label="t('diagnostics.newChats')"
                type="button"
                :disabled="agentBusy"
                :class="cn(chipClass, providerOpen && 'ctv:bg-agent-surface-hover', agentBusy && 'ctv:cursor-default ctv:opacity-50')"
              >
                <span class="ctv:text-agent-fg-subtle ctv:group-hover:text-agent-fg ctv:icon-[lucide--bot] ctv:size-3.5 ctv:shrink-0" />
                <span class="ctv:min-w-0 ctv:truncate">{{ providerLabel }}</span>
                <span class="ctv:flex ctv:size-3.5 ctv:shrink-0 ctv:items-center ctv:justify-center">
                  <span :class="cn('ctv:size-[7px] ctv:rounded-full', !loaded ? 'ctv:bg-agent-fg-muted ctv:animate-pulse' : current?.available ? 'ctv:bg-agent-success' : 'ctv:bg-agent-danger')" />
                </span>
                <span class="ctv:icon-[lucide--chevron-down] ctv:size-3 ctv:shrink-0 ctv:text-agent-fg-muted" />
              </button>
            </TooltipTrigger>
          </DropdownMenuTrigger>
          <TooltipPortal>
            <TooltipContent side="bottom" align="start" :side-offset="6" :collision-padding="8" :class="AGENT_REKA_TOOLTIP_CONTENT_CLASS">
              {{ statusText || t('agentBar.provider') }}
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>
      </TooltipProvider>
      <DropdownMenuPortal>
        <DropdownMenuContent side="bottom" align="start" :side-offset="8" :reference="providerTrigger ?? undefined" :class="menuClass">
          <div v-if="!loaded" :class="cn(itemClass, 'ctv:text-agent-fg-muted ctv:cursor-default')">{{ t('agentBar.loading') }}</div>
          <DropdownMenuRadioGroup v-else :model-value="provider" @update:model-value="setProvider">
            <DropdownMenuRadioItem v-for="p in providers" :key="p.id" :value="p.id" :disabled="!p.available" :class="itemClass">
              <span :class="cn('ctv:size-[7px] ctv:shrink-0 ctv:rounded-full', p.available ? 'ctv:bg-agent-success' : 'ctv:bg-agent-danger')" />
              <span class="ctv:truncate">{{ p.label }}</span>
              <span class="ctv:text-agent-fg-muted ctv:ml-1 ctv:min-w-0 ctv:truncate ctv:text-xs/4">{{ p.id === 'hermes' ? diagnosticSummary(p.health, t) : [p.detail, p.version].filter(Boolean).join(' · ') }}</span>
              <span class="ctv:ml-auto ctv:flex ctv:size-4 ctv:shrink-0 ctv:items-center ctv:justify-center">
                <DropdownMenuItemIndicator>
                  <span class="ctv:icon-[lucide--check] ctv:size-4" />
                </DropdownMenuItemIndicator>
              </span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>

    <span v-if="providerSaveError" role="alert" class="ctv:order-last ctv:w-full ctv:shrink-0 ctv:text-agent-danger ctv:text-xs">{{ t('agentBar.providerSaveFailed') }}</span>
    <ProviderDiagnostics compact />

    <DropdownMenuRoot :open="modelOpen" @update:open="onModelOpen">
      <DropdownMenuTrigger as-child>
        <button type="button" :disabled="agentBusy" :aria-label="t('diagnostics.savedModel')" :class="cn(chipClass, 'ctv:text-agent-fg-muted ctv:hover:text-agent-fg', modelOpen && 'ctv:bg-agent-surface-hover ctv:text-agent-fg')">
          <span class="ctv:min-w-0 ctv:truncate">{{ current?.id === 'hermes' ? t('diagnostics.savedModel') + ': ' : '' }}{{ modelLabel || t('agentBar.defaultModel') }}</span>
          <span class="ctv:icon-[lucide--chevron-down] ctv:size-3 ctv:shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent side="bottom" align="start" :side-offset="8" :class="menuClass" @keydown.stop>
          <template v-if="modelRows.length">
            <DropdownMenuRadioGroup :model-value="model" @update:model-value="setModel">
              <DropdownMenuRadioItem value="" :class="itemClass">
                <span class="ctv:truncate">{{ t('agentBar.defaultModel') }}</span>
                <span class="ctv:ml-auto ctv:flex ctv:size-4 ctv:shrink-0 ctv:items-center ctv:justify-center">
                  <DropdownMenuItemIndicator><span class="ctv:icon-[lucide--check] ctv:size-4" /></DropdownMenuItemIndicator>
                </span>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem v-for="row in modelRows" :key="row.value" :value="row.value" :class="itemClass">
                <span class="ctv:truncate">{{ row.label }}</span>
                <span v-if="row.group" class="ctv:text-agent-fg-muted ctv:ml-1 ctv:shrink-0 ctv:text-xs/4">{{ routeLabel(row.group) }}</span>
                <span class="ctv:ml-auto ctv:flex ctv:size-4 ctv:shrink-0 ctv:items-center ctv:justify-center">
                  <DropdownMenuItemIndicator><span class="ctv:icon-[lucide--check] ctv:size-4" /></DropdownMenuItemIndicator>
                </span>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </template>
          <template v-else-if="models.length">
            <DropdownMenuRadioGroup :model-value="model" @update:model-value="setModel">
              <DropdownMenuRadioItem value="" :class="itemClass">
                <span class="ctv:truncate">{{ t('agentBar.defaultModel') }}</span>
                <span class="ctv:ml-auto ctv:flex ctv:size-4 ctv:shrink-0 ctv:items-center ctv:justify-center">
                  <DropdownMenuItemIndicator><span class="ctv:icon-[lucide--check] ctv:size-4" /></DropdownMenuItemIndicator>
                </span>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem v-for="m in models" :key="m" :value="m" :class="itemClass">
                <span class="ctv:truncate">{{ m }}</span>
                <span class="ctv:ml-auto ctv:flex ctv:size-4 ctv:shrink-0 ctv:items-center ctv:justify-center">
                  <DropdownMenuItemIndicator><span class="ctv:icon-[lucide--check] ctv:size-4" /></DropdownMenuItemIndicator>
                </span>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </template>
          <div v-else class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:p-1">
            <div class="ctv:text-agent-fg-muted ctv:text-xs/4">{{ t('agentBar.model') }}</div>
            <input
              v-model="modelDraft"
              type="text"
              :placeholder="t('agentBar.defaultModel')"
              class="ctv:text-agent-fg ctv:placeholder:text-agent-fg-muted ctv:h-8 ctv:w-full ctv:rounded-[10px] ctv:border ctv:border-white/15 ctv:bg-transparent ctv:px-2.5 ctv:py-1 ctv:text-[14px]/5 ctv:outline-none"
              @keydown.enter.prevent="commitModelDraft"
            />
            <button
              type="button"
              class="ctv:bg-agent-fg ctv:text-agent-surface ctv:hover:bg-agent-fg/90 ctv:h-8 ctv:w-full ctv:cursor-pointer ctv:rounded-[10px] ctv:text-sm/5 ctv:font-medium ctv:transition-colors"
              @click="commitModelDraft"
            >
              {{ t('agentBar.apply') }}
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>

    <TooltipProvider v-bind="AGENT_REKA_TOOLTIP_PROVIDER_PROPS">
      <TooltipRoot>
        <TooltipTrigger as-child>
          <button
            type="button"
            :aria-label="t('agentBar.openSettings')"
            class="ctv:text-agent-fg-muted ctv:hover:bg-agent-surface-hover ctv:hover:text-agent-fg ctv:ml-auto ctv:flex ctv:size-7 ctv:shrink-0 ctv:cursor-pointer ctv:items-center ctv:justify-center ctv:rounded-lg ctv:transition-colors"
            @click="openSettings"
          >
            <span class="ctv:icon-[lucide--settings-2] ctv:size-4" />
          </button>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent side="bottom" align="end" :side-offset="6" :class="AGENT_REKA_TOOLTIP_CONTENT_CLASS">
            {{ t('agentBar.openSettings') }}
          </TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
    </TooltipProvider>
  </div>
</template>
