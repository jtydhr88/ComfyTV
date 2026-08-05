import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const fetchSettings = vi.fn()
const saveSettings = vi.fn()
const runDbBackup = vi.fn()
vi.mock('@/api', () => ({
  fetchSettings: (...a: any[]) => fetchSettings(...a),
  saveSettings: (...a: any[]) => saveSettings(...a),
  runDbBackup: (...a: any[]) => runDbBackup(...a),
}))

import { useSettingsPanel } from './useSettingsPanel'

function rows(): any[] {
  return [
    { key: 'enable-db-backup', type: 'boolean', value: true, default: true },
    { key: 'db-backup-max-count', type: 'int', value: 10, default: 10 },
    { key: 'db-backup-path', type: 'string', value: '', default: '' },
  ]
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchSettings.mockResolvedValue({ settings: rows() })
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

  it('tracks dirty state per edited value', async () => {
    const p = useSettingsPanel(() => true)
    await flush()
    expect(p.dirty.value).toBe(false)
    p.setValue('db-backup-max-count', 5)
    expect(p.dirty.value).toBe(true)
    p.setValue('db-backup-max-count', 10)
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
})
