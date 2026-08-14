import { computed, ref, watch } from 'vue'

import { fetchSettings, runDbBackup, saveSettings } from '@/api'
import type { BackupResult, SettingRow, SettingValue } from '@/api'
import { syncBotTab } from '@/composables/sidebar/botTab'
import { app } from '@/lib/comfyApp'
import { useBotStore } from '@/stores/botStore'

const AGENT_KEYS = new Set(['enable-mcp', 'enable-bot'])

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function useSettingsPanel(isActive: () => boolean | undefined) {
  const rows = ref<SettingRow[]>([])
  const values = ref<Record<string, SettingValue>>({})
  const loading = ref(false)
  const saving = ref(false)
  const backingUp = ref(false)
  const error = ref('')
  const backupResult = ref<BackupResult | null>(null)

  const dirty = computed(() =>
    rows.value.some((r) => values.value[r.key] !== r.value))
  const backupRows = computed(() =>
    rows.value.filter((r) => !AGENT_KEYS.has(r.key)))
  const agentRows = computed(() =>
    rows.value.filter((r) => AGENT_KEYS.has(r.key)))
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
      if (Object.keys(changed).some((k) => AGENT_KEYS.has(k))) {
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
    if (active) void load()
  }, { immediate: true })

  return {
    rows,
    backupRows,
    agentRows,
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
  }
}
