import { useStorage } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { fetchSettings, runDbBackup, saveSettings } from '@/api'
import type { BackupResult, SettingRow, SettingValue } from '@/api'
import { fetchBlenderStatus } from '@/api/blender'
import { fetchEagleStatus } from '@/api/eagle'
import { syncBotTab } from '@/composables/sidebar/botTab'
import { app } from '@/lib/comfyApp'
import { useBotStore } from '@/stores/botStore'

type Values = Record<string, SettingValue>
export type ProbeState = 'checking' | 'online' | 'offline'

export interface SettingSection {
  id: string
  master: SettingRow | null
  rows: SettingRow[]
  experimental: boolean
  dirty: boolean
  probe: ProbeState | null
}

const SECTION_ORDER = ['general', 'backup', 'agent', 'eagle', 'blender', 'collab']
const MASTER: Record<string, string> = {
  agent: 'enable-mcp',
  eagle: 'enable-eagle',
  collab: 'enable-collab',
}
const MASTER_KEYS = new Set(Object.values(MASTER))
const HIDDEN_KEYS = new Set(['skills-disabled'])
const AGENT_TOGGLE_KEYS = new Set(['enable-mcp', 'enable-bot'])
const MODEL_KEY_PREFIX = 'bot-model-'
const COLLAPSED_STORAGE_KEY = 'comfytv:sidebar:settings:collapsed'

const PARENT: Record<string, string> = {
  'enable-bot': 'enable-mcp',
  'enable-skills': 'enable-mcp',
  'bot-comfy-mcp-command': 'bot-enable-comfy-mcp',
  'bot-model-local-llm': 'bot-local-llm-url',
}

const PROBES: Record<string, () => Promise<boolean>> = {
  eagle: async () => {
    const s = await fetchEagleStatus(true)
    return s.online === true || s.mode === 'api'
  },
  blender: async () => (await fetchBlenderStatus(true)).online,
}

export function sectionOf(key: string): string {
  if (key === 'enable-db-backup' || key.startsWith('db-backup-')) return 'backup'
  if (AGENT_TOGGLE_KEYS.has(key) || key === 'enable-skills' || key.startsWith('bot-')) return 'agent'
  if (key === 'enable-eagle' || key.startsWith('eagle-')) return 'eagle'
  if (key.startsWith('blender-')) return 'blender'
  if (key === 'enable-collab') return 'collab'
  return 'general'
}

function parentOf(key: string): string | undefined {
  if (PARENT[key]) return PARENT[key]
  if (key.startsWith('bot-')) return 'enable-bot'
  if (key.startsWith('eagle-')) return 'enable-eagle'
  return undefined
}

function satisfied(key: string, v: Values): boolean {
  const x = v[key]
  return typeof x === 'string' ? x.trim() !== '' : x === true
}

export function isSettingVisible(key: string, v: Values): boolean {
  const p = parentOf(key)
  return p === undefined || (satisfied(p, v) && isSettingVisible(p, v))
}

export function depthOf(key: string): number {
  let d = 0
  for (let p = parentOf(key); p !== undefined; p = parentOf(p)) {
    if (!MASTER_KEYS.has(p)) d++
  }
  return d
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

export function useSettingsPanel(
  isActive: () => boolean | undefined,
  textOf: (key: string) => string = () => '',
) {
  const rows = ref<SettingRow[]>([])
  const values = ref<Values>({})
  const query = ref('')
  const loading = ref(false)
  const saving = ref(false)
  const backingUp = ref(false)
  const error = ref('')
  const backupResult = ref<BackupResult | null>(null)
  const probes = ref<Record<string, ProbeState>>({})
  const collapsedStore = useStorage<Record<string, boolean>>(COLLAPSED_STORAGE_KEY, {})

  function modelSuggestions(key: string): string[] {
    if (!key.startsWith(MODEL_KEY_PREFIX)) return []
    const providerId = key.slice(MODEL_KEY_PREFIX.length)
    return tryBotStore()?.providers.find((p) => p.id === providerId)?.models
      ?? []
  }

  const changedKeys = computed(() =>
    rows.value.filter((r) => values.value[r.key] !== r.value).map((r) => r.key))
  const dirtyCount = computed(() => changedKeys.value.length)
  const dirty = computed(() => dirtyCount.value > 0)
  function isDirty(key: string): boolean {
    return changedKeys.value.includes(key)
  }

  const normalizedQuery = computed(() => query.value.trim().toLowerCase())
  function matches(key: string): boolean {
    const q = normalizedQuery.value
    return !q || textOf(key).toLowerCase().includes(q)
  }

  const sections = computed<SettingSection[]>(() => {
    const v = values.value
    const byId = new Map<string, SettingRow[]>()
    for (const r of rows.value) {
      if (HIDDEN_KEYS.has(r.key)) continue
      const id = sectionOf(r.key)
      const list = byId.get(id) ?? []
      list.push(r)
      byId.set(id, list)
    }
    const out: SettingSection[] = []
    for (const id of SECTION_ORDER) {
      const all = byId.get(id) ?? []
      if (!all.length) continue
      const master = all.find((r) => r.key === MASTER[id]) ?? null
      const body = all.filter((r) =>
        r !== master && isSettingVisible(r.key, v) && matches(r.key))
      if (normalizedQuery.value && !body.length && !(master && matches(master.key))) continue
      out.push({
        id,
        master,
        rows: body,
        experimental: master?.experimental === true,
        dirty: all.some((r) => isDirty(r.key)),
        probe: probes.value[id] ?? null,
      })
    }
    return out
  })

  const skillsVisible = computed(() =>
    rows.value.some((r) => r.key === 'enable-skills')
    && isSettingVisible('enable-skills', values.value)
    && values.value['enable-skills'] === true)

  function isCollapsed(id: string): boolean {
    if (normalizedQuery.value) return false
    const stored = collapsedStore.value[id]
    if (stored !== undefined) return stored
    const m = MASTER[id]
    return m !== undefined && values.value[m] !== true
  }

  function toggleCollapsed(id: string): void {
    collapsedStore.value = { ...collapsedStore.value, [id]: !isCollapsed(id) }
  }

  function syncValues(): void {
    values.value = Object.fromEntries(rows.value.map((r) => [r.key, r.value]))
  }

  async function refreshProbes(): Promise<void> {
    await Promise.all(Object.entries(PROBES).map(async ([id, probe]) => {
      const m = MASTER[id]
      if (m && rows.value.find((r) => r.key === m)?.value !== true) {
        const { [id]: _gone, ...rest } = probes.value
        probes.value = rest
        return
      }
      probes.value = { ...probes.value, [id]: 'checking' }
      let ok = false
      try {
        ok = await probe()
      } catch {
        ok = false
      }
      probes.value = { ...probes.value, [id]: ok ? 'online' : 'offline' }
    }))
  }

  async function load(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      rows.value = (await fetchSettings()).settings
      syncValues()
      void refreshProbes()
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

  function resetToDefault(key: string): void {
    const row = rows.value.find((r) => r.key === key)
    if (row) setValue(key, row.default)
  }

  async function save(): Promise<void> {
    if (!dirty.value || saving.value) return
    const changed = Object.fromEntries(
      changedKeys.value.map((k) => [k, values.value[k]!]))
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
      void refreshProbes()
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
    values,
    query,
    sections,
    skillsVisible,
    loading,
    saving,
    backingUp,
    error,
    dirty,
    dirtyCount,
    backupResult,
    isDirty,
    isCollapsed,
    toggleCollapsed,
    load,
    refreshProbes,
    setValue,
    resetToDefault,
    save,
    backupNow,
    modelSuggestions,
  }
}
