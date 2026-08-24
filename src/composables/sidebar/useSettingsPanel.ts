import { computed, ref, watch } from 'vue'

import { fetchSettings, runDbBackup, saveSettings } from '@/api'
import type { BackupResult, SettingRow, SettingValue } from '@/api'
import { syncBotTab } from '@/composables/sidebar/botTab'
import { app } from '@/lib/comfyApp'
import { useBotStore } from '@/stores/botStore'

const AGENT_TOGGLE_KEYS = new Set(['enable-mcp', 'enable-bot'])
const MODEL_KEY_PREFIX = 'bot-model-'
const SKILL_KEYS = new Set(['enable-skills', 'skills-disabled'])

function isAgentKey(key: string): boolean {
  return AGENT_TOGGLE_KEYS.has(key) || key.startsWith('bot-')
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function tryBotStore(): ReturnType<typeof useBotStore> | null {
  try {
    return useBotStore()
  } catch {
    return null
  }
}

export function useSettingsPanel(isActive: () => boolean | undefined) {
  const rows = ref<SettingRow[]>([])
  const values = ref<Record<string, SettingValue>>({})
  const loading = ref(false)
  const saving = ref(false)
  const backingUp = ref(false)
  const error = ref('')
  const backupResult = ref<BackupResult | null>(null)

  function modelSuggestions(key: string): string[] {
    if (!key.startsWith(MODEL_KEY_PREFIX)) return []
    const providerId = key.slice(MODEL_KEY_PREFIX.length)
    return tryBotStore()?.providers.find((p) => p.id === providerId)?.models
      ?? []
  }

  const dirty = computed(() =>
    rows.value.some((r) => values.value[r.key] !== r.value))
  const backupRows = computed(() =>
    rows.value.filter((r) => !isAgentKey(r.key) && !SKILL_KEYS.has(r.key)))
  const agentRows = computed(() =>
    rows.value.filter((r) => isAgentKey(r.key)
      && (AGENT_TOGGLE_KEYS.has(r.key) || values.value['enable-bot'] === true)))
  const skillsRows = computed(() =>
    rows.value.filter((r) => r.key === 'enable-skills'))
  const botToggleLocked = computed(() => values.value['enable-mcp'] !== true)

  function syncValues(): void {
    values.value = Object.fromEntries(rows.value.map((r) => [r.key, r.value]))
  }

  async function load(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      rows.value = (await fetchSettings()).settings
      syncValues()
    } catch (e) {
      rows.value = []
      values.value = {}
      error.value = message(e)
    } finally {
      loading.value = false
    }
  }

  function setValue(key: string, v: SettingValue): void {
    const next = { ...values.value, [key]: v }
    if (key === 'enable-mcp' && v === false) next['enable-bot'] = false
    values.value = next
  }

  async function save(): Promise<void> {
    if (!dirty.value || saving.value) return
    const changed = Object.fromEntries(
      rows.value
        .filter((r) => values.value[r.key] !== r.value)
        .map((r) => [r.key, values.value[r.key]!]),
    )
    saving.value = true
    error.value = ''
    try {
      rows.value = (await saveSettings(changed)).settings
      syncValues()
      if (Object.keys(changed).some((k) => AGENT_TOGGLE_KEYS.has(k))) {
        const bot = useBotStore()
        await bot.refreshStatus()
        syncBotTab(app, bot.enabled)
      }
    } catch (e) {
      error.value = message(e)
    } finally {
      saving.value = false
    }
  }

  async function backupNow(): Promise<void> {
    if (backingUp.value) return
    backingUp.value = true
    backupResult.value = null
    try {
      backupResult.value = await runDbBackup()
    } catch (e) {
      backupResult.value = { ok: false, error: message(e) }
    } finally {
      backingUp.value = false
    }
  }

  watch(isActive, (active) => {
    if (active) {
      void load()
      void tryBotStore()?.refreshStatus()
    }
  }, { immediate: true })

  return {
    rows,
    backupRows,
    agentRows,
    skillsRows,
    botToggleLocked,
    values,
    loading,
    saving,
    backingUp,
    error,
    dirty,
    backupResult,
    load,
    setValue,
    save,
    backupNow,
    modelSuggestions,
  }
}
