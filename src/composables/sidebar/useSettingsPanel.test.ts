import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const fetchSettings = vi.fn()
const saveSettings = vi.fn()
const runDbBackup = vi.fn()
const fetchEagleStatus = vi.fn()
const fetchBlenderStatus = vi.fn()
vi.mock('@/api', () => ({
  fetchSettings: (...a: any[]) => fetchSettings(...a),
  saveSettings: (...a: any[]) => saveSettings(...a),
  runDbBackup: (...a: any[]) => runDbBackup(...a),
}))
vi.mock('@/api/eagle', () => ({ fetchEagleStatus: (...a: any[]) => fetchEagleStatus(...a) }))
vi.mock('@/api/blender', () => ({ fetchBlenderStatus: (...a: any[]) => fetchBlenderStatus(...a) }))

import { depthOf, isSettingVisible, sectionOf, useSettingsPanel } from './useSettingsPanel'

function row(key: string, type: 'boolean' | 'int' | 'string', value: any, extra: Record<string, any> = {}) {
  return { key, type, value, default: value, ...extra }
}

function rows(): any[] {
  return [
    row('enable-db-backup', 'boolean', true),
    row('db-backup-max-count', 'int', 10),
    row('db-backup-path', 'string', ''),
  ]
}

function fullRows(): any[] {
  return [
    row('enable-v2', 'boolean', false, { experimental: true }),
    ...rows(),
    row('enable-mcp', 'boolean', false),
    row('enable-bot', 'boolean', false),
    row('bot-local-llm-url', 'string', ''),
    row('bot-model-local-llm', 'string', ''),
    row('bot-enable-comfy-mcp', 'boolean', false),
    row('bot-comfy-mcp-command', 'string', ''),
    row('enable-skills', 'boolean', true),
    row('skills-disabled', 'string', '[]'),
    row('enable-collab', 'boolean', false, { experimental: true }),
    row('enable-eagle', 'boolean', false),
    row('eagle-api-url', 'string', 'http://127.0.0.1:41595'),
    row('blender-bridge-url', 'string', 'http://127.0.0.1:7684', { experimental: true }),
  ]
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

const LABELS: Record<string, string> = {
  'enable-v2': 'Enable ComfyTV V2 nodes',
  'db-backup-path': 'Backup location',
  'enable-eagle': 'Enable Eagle integration',
  'eagle-api-url': 'Eagle API URL',
}

function installLocalStorage() {
  const store: Record<string, string> = {}
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
    setItem: (k: string, v: string) => { store[k] = String(v) },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { for (const k of Object.keys(store)) delete store[k] },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  installLocalStorage()
  fetchSettings.mockResolvedValue({ settings: rows() })
  fetchEagleStatus.mockResolvedValue({ enabled: true, mode: 'api', online: true, pending: 0 })
  fetchBlenderStatus.mockResolvedValue({ online: false })
})

describe('useSettingsPanel', () => {
  it('loads only when the panel becomes active', async () => {
    const active = ref(false)
    const p = useSettingsPanel(() => active.value)
    await flush()
    expect(fetchSettings).not.toHaveBeenCalled()
    active.value = true
    await flush()
    expect(fetchSettings).toHaveBeenCalled()
    expect(p.rows.value).toHaveLength(3)
    expect(p.values.value['db-backup-max-count']).toBe(10)
  })

  it('tracks dirty state and count per edited value', async () => {
    const p = useSettingsPanel(() => true)
    await flush()
    expect(p.dirty.value).toBe(false)
    p.setValue('db-backup-max-count', 5)
    p.setValue('db-backup-path', 'X:/bk')
    expect(p.dirtyCount.value).toBe(2)
    expect(p.isDirty('db-backup-path')).toBe(true)
    p.setValue('db-backup-max-count', 10)
    expect(p.dirtyCount.value).toBe(1)
    p.resetToDefault('db-backup-path')
    expect(p.dirty.value).toBe(false)
  })

  it('save sends only changed values and resyncs from response', async () => {
    const updated = rows()
    updated[1] = { ...updated[1]!, value: 5 }
    saveSettings.mockResolvedValue({ ok: true, settings: updated })
    const p = useSettingsPanel(() => true)
    await flush()
    p.setValue('db-backup-max-count', 5)
    await p.save()
    expect(saveSettings).toHaveBeenCalledWith({ 'db-backup-max-count': 5 })
    expect(p.dirty.value).toBe(false)
    expect(p.values.value['db-backup-max-count']).toBe(5)
  })

  it('save is a no-op when nothing is dirty', async () => {
    const p = useSettingsPanel(() => true)
    await flush()
    await p.save()
    expect(saveSettings).not.toHaveBeenCalled()
  })

  it('save failure surfaces the error and keeps edits', async () => {
    saveSettings.mockRejectedValue(new Error('boom'))
    const p = useSettingsPanel(() => true)
    await flush()
    p.setValue('enable-db-backup', false)
    await p.save()
    expect(p.error.value).toBe('boom')
    expect(p.values.value['enable-db-backup']).toBe(false)
    expect(p.dirty.value).toBe(true)
  })

  it('backupNow reports success', async () => {
    runDbBackup.mockResolvedValue({ ok: true, path: 'X:/db-backup/20260805-093000/comfytv' })
    const p = useSettingsPanel(() => true)
    await flush()
    await p.backupNow()
    expect(p.backupResult.value).toEqual({ ok: true, path: 'X:/db-backup/20260805-093000/comfytv' })
  })

  it('backupNow reports failure from a thrown error', async () => {
    runDbBackup.mockRejectedValue(new Error('disk full'))
    const p = useSettingsPanel(() => true)
    await flush()
    await p.backupNow()
    expect(p.backupResult.value).toEqual({ ok: false, error: 'disk full' })
  })

  it('load failure clears rows and sets error', async () => {
    fetchSettings.mockRejectedValue(new Error('offline'))
    const p = useSettingsPanel(() => true)
    await flush()
    expect(p.rows.value).toEqual([])
    expect(p.error.value).toBe('offline')
  })

  it('groups rows into ordered sections with masters and hides bookkeeping keys', async () => {
    fetchSettings.mockResolvedValue({ settings: fullRows() })
    const p = useSettingsPanel(() => true)
    await flush()
    const s = p.sections.value
    expect(s.map((x) => x.id)).toEqual(['general', 'backup', 'agent', 'eagle', 'blender', 'collab'])
    expect(s.find((x) => x.id === 'general')!.rows.map((r) => r.key)).toEqual(['enable-v2'])
    expect(s.find((x) => x.id === 'blender')!.rows.map((r) => r.key)).toEqual(['blender-bridge-url'])
    expect(s.find((x) => x.id === 'agent')!.master?.key).toBe('enable-mcp')
    expect(s.find((x) => x.id === 'collab')!.master?.key).toBe('enable-collab')
    expect(s.find((x) => x.id === 'collab')!.experimental).toBe(true)
    expect(s.find((x) => x.id === 'general')!.experimental).toBe(false)
    expect(s.flatMap((x) => x.rows.map((r) => r.key))).not.toContain('skills-disabled')
    expect(s.flatMap((x) => x.rows.map((r) => r.key))).not.toContain('enable-mcp')
  })

  it('hides dependent rows until their prerequisite chain is satisfied', async () => {
    fetchSettings.mockResolvedValue({ settings: fullRows() })
    const p = useSettingsPanel(() => true)
    await flush()
    const agent = () => p.sections.value.find((x) => x.id === 'agent')!.rows.map((r) => r.key)
    expect(agent()).toEqual([])
    expect(p.skillsVisible.value).toBe(false)

    p.setValue('enable-mcp', true)
    expect(agent()).toEqual(['enable-bot', 'enable-skills'])
    expect(p.skillsVisible.value).toBe(true)

    p.setValue('enable-bot', true)
    expect(agent()).toEqual([
      'enable-bot', 'bot-local-llm-url', 'bot-enable-comfy-mcp', 'enable-skills'])
    p.setValue('bot-local-llm-url', 'http://127.0.0.1:1234/v1')
    p.setValue('bot-enable-comfy-mcp', true)
    expect(agent()).toContain('bot-model-local-llm')
    expect(agent()).toContain('bot-comfy-mcp-command')

    p.setValue('enable-mcp', false)
    expect(p.values.value['enable-bot']).toBe(false)
    expect(agent()).toEqual([])

    const eagle = () => p.sections.value.find((x) => x.id === 'eagle')!.rows.map((r) => r.key)
    expect(eagle()).toEqual([])
    p.setValue('enable-eagle', true)
    expect(eagle()).toEqual(['eagle-api-url'])
  })

  it('computes indent depth from the parent chain, skipping section masters', () => {
    expect(depthOf('enable-bot')).toBe(0)
    expect(depthOf('enable-skills')).toBe(0)
    expect(depthOf('bot-model-claude-code')).toBe(1)
    expect(depthOf('bot-model-local-llm')).toBe(2)
    expect(depthOf('bot-comfy-mcp-command')).toBe(2)
    expect(depthOf('eagle-api-url')).toBe(0)
    expect(depthOf('enable-v2')).toBe(0)
  })

  it('isSettingVisible and sectionOf default sensibly for keys without prerequisites', () => {
    expect(isSettingVisible('enable-db-backup', {})).toBe(true)
    expect(isSettingVisible('blender-bridge-url', {})).toBe(true)
    expect(sectionOf('enable-v2')).toBe('general')
    expect(sectionOf('blender-bridge-url')).toBe('blender')
    expect(sectionOf('db-backup-path')).toBe('backup')
  })

  it('collapses sections with an off master by default and remembers toggles', async () => {
    fetchSettings.mockResolvedValue({ settings: fullRows() })
    const p = useSettingsPanel(() => true)
    await flush()
    expect(p.isCollapsed('general')).toBe(false)
    expect(p.isCollapsed('agent')).toBe(true)
    p.setValue('enable-mcp', true)
    expect(p.isCollapsed('agent')).toBe(false)
    p.toggleCollapsed('general')
    expect(p.isCollapsed('general')).toBe(true)
    await nextTick()
    expect(JSON.parse(localStorage.getItem('comfytv:sidebar:settings:collapsed')!)).toEqual({ general: true })
    p.query.value = 'v2'
    expect(p.isCollapsed('general')).toBe(false)
  })

  it('search filters rows and drops sections without matches', async () => {
    fetchSettings.mockResolvedValue({ settings: fullRows() })
    const p = useSettingsPanel(() => true, (k) => LABELS[k] ?? k)
    await flush()
    p.setValue('enable-eagle', true)
    p.query.value = 'eagle'
    expect(p.sections.value.map((x) => x.id)).toEqual(['eagle'])
    p.query.value = 'backup location'
    expect(p.sections.value.map((x) => x.id)).toEqual(['backup'])
    expect(p.sections.value[0]!.rows.map((r) => r.key)).toEqual(['db-backup-path'])
    p.query.value = 'zzz'
    expect(p.sections.value).toEqual([])
    p.query.value = ''
    expect(p.sections.value).toHaveLength(6)
  })

  it('marks sections dirty and probes integrations only when enabled', async () => {
    const all = fullRows()
    all.find((r) => r.key === 'enable-eagle')!.value = true
    fetchSettings.mockResolvedValue({ settings: all })
    const p = useSettingsPanel(() => true)
    await flush()
    await flush()
    const byId = (id: string) => p.sections.value.find((x) => x.id === id)!
    expect(fetchEagleStatus).toHaveBeenCalledWith(true)
    expect(fetchBlenderStatus).toHaveBeenCalledWith(true)
    expect(byId('eagle').probe).toBe('online')
    expect(byId('blender').probe).toBe('offline')
    expect(byId('collab').probe).toBeNull()
    p.setValue('enable-v2', true)
    expect(byId('general').dirty).toBe(true)
    expect(byId('backup').dirty).toBe(false)
  })

  it('skips the eagle probe while the master is off', async () => {
    fetchSettings.mockResolvedValue({ settings: fullRows() })
    const p = useSettingsPanel(() => true)
    await flush()
    await flush()
    expect(fetchEagleStatus).not.toHaveBeenCalled()
    expect(p.sections.value.find((x) => x.id === 'eagle')!.probe).toBeNull()
  })
})
