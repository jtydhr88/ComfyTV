import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchStageDefaults = vi.fn()
const listStagePresets = vi.fn()
const saveStagePreset = vi.fn()
const deleteStagePreset = vi.fn()
vi.mock('@/api', () => ({
  fetchStageDefaults: (...a: any[]) => fetchStageDefaults(...a),
  listStagePresets: (...a: any[]) => listStagePresets(...a),
  saveStagePreset: (...a: any[]) => saveStagePreset(...a),
  deleteStagePreset: (...a: any[]) => deleteStagePreset(...a),
}))

import {
  bumpStagePresetsRevision,
  clearStageDefaultsCache,
  fetchStageDefaultsCached,
  useStagePresets,
  useStagePresetsRevision,
} from './useStagePresets'

interface FakeWidget {
  name: string
  value: unknown
  callback?: (v: unknown) => void
  spy: ReturnType<typeof vi.fn>
}

function widget(name: string, value: unknown): FakeWidget {
  const spy = vi.fn()
  return { name, value, callback: spy, spy }
}

function makeNode(widgets: FakeWidget[], comfyClass = 'ComfyTV.VideoColorStage') {
  return { comfyClass, widgets } as any
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

const DEFAULTS = { exposure: 0.0, temperature: 6500, preserve_lightness: true }

function preset(id: number, name: string, config: Record<string, unknown>) {
  return { id, kind: 'ComfyTV.VideoColorStage', name, config, builtin: false, created_at: null }
}

function builtinPreset(name: string, config: Record<string, unknown>) {
  return {
    id: `builtin:ComfyTV.VideoColorStage:${name}`,
    kind: 'ComfyTV.VideoColorStage',
    name,
    config,
    builtin: true,
    created_at: null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  clearStageDefaultsCache()
  fetchStageDefaults.mockResolvedValue({ defaults: DEFAULTS })
  listStagePresets.mockResolvedValue({ presets: [] })
})

describe('fetchStageDefaultsCached', () => {
  it('fetches once per kind', async () => {
    await fetchStageDefaultsCached('ComfyTV.VideoColorStage')
    await fetchStageDefaultsCached('ComfyTV.VideoColorStage')
    expect(fetchStageDefaults).toHaveBeenCalledTimes(1)
    await fetchStageDefaultsCached('ComfyTV.ColorGradeStage')
    expect(fetchStageDefaults).toHaveBeenCalledTimes(2)
  })

  it('drops the cache entry on failure so later calls retry', async () => {
    fetchStageDefaults.mockRejectedValueOnce(new Error('boom'))
    await expect(fetchStageDefaultsCached('ComfyTV.VideoColorStage')).rejects.toThrow('boom')
    await fetchStageDefaultsCached('ComfyTV.VideoColorStage')
    expect(fetchStageDefaults).toHaveBeenCalledTimes(2)
  })
})

describe('useStagePresets', () => {
  it('loads defaults for the node kind and reports hasConfig', async () => {
    const node = makeNode([widget('exposure', 0.5)])
    const s = useStagePresets(() => node)
    expect(s.hasConfig.value).toBe(false)
    await flush()
    expect(fetchStageDefaults).toHaveBeenCalledWith('ComfyTV.VideoColorStage')
    expect(s.hasConfig.value).toBe(true)
    expect(listStagePresets).toHaveBeenCalledWith('ComfyTV.VideoColorStage')
  })

  it('stays inert without a node and skips presets when defaults are empty', async () => {
    const none = useStagePresets(() => undefined)
    await flush()
    expect(none.hasConfig.value).toBe(false)
    expect(fetchStageDefaults).not.toHaveBeenCalled()

    fetchStageDefaults.mockResolvedValue({ defaults: {} })
    const s = useStagePresets(() => makeNode([], 'ComfyTV.ImagePickerStage'))
    await flush()
    expect(s.hasConfig.value).toBe(false)
    expect(listStagePresets).not.toHaveBeenCalled()
  })

  it('captureConfig reads exactly the default keys that exist as widgets', async () => {
    const node = makeNode([
      widget('exposure', 0.7),
      widget('temperature', 4200),
      widget('project_id', 'p1'),
    ])
    const s = useStagePresets(() => node)
    await flush()
    expect(s.captureConfig()).toEqual({ exposure: 0.7, temperature: 4200 })
  })

  it('applyConfig writes widgets, fires callbacks, and skips unknown keys', async () => {
    const exposure = widget('exposure', 0)
    const projectId = widget('project_id', 'p1')
    const node = makeNode([exposure, projectId])
    const s = useStagePresets(() => node)
    await flush()
    s.applyConfig({ exposure: 1.5, project_id: 'hacked', gone_key: 9 })
    expect(exposure.value).toBe(1.5)
    expect(exposure.spy).toHaveBeenCalledWith(1.5)
    expect(projectId.value).toBe('p1')
    expect(projectId.spy).not.toHaveBeenCalled()
  })

  it('resetToDefaults restores schema defaults and clears the selection', async () => {
    const exposure = widget('exposure', 2)
    const preserve = widget('preserve_lightness', false)
    const node = makeNode([exposure, preserve])
    listStagePresets.mockResolvedValue({ presets: [preset(1, 'warm', { exposure: 2 })] })
    const s = useStagePresets(() => node)
    await flush()
    s.applyPresetById(1)
    expect(s.selectedId.value).toBe(1)
    s.resetToDefaults()
    expect(exposure.value).toBe(0)
    expect(preserve.value).toBe(true)
    expect(preserve.spy).toHaveBeenCalledWith(true)
    expect(s.selectedId.value).toBeNull()
  })

  it('applyPresetById applies the stored config and selects the preset', async () => {
    const exposure = widget('exposure', 0)
    const node = makeNode([exposure])
    listStagePresets.mockResolvedValue({
      presets: [preset(7, 'punchy', { exposure: 1.2, gone_key: 3 })],
    })
    const s = useStagePresets(() => node)
    await flush()
    s.applyPresetById(7)
    expect(exposure.value).toBe(1.2)
    expect(s.selectedId.value).toBe(7)
    expect(s.selectedPreset.value?.name).toBe('punchy')
  })

  it('savePresetAs posts the captured config, reloads, and selects the row', async () => {
    const node = makeNode([widget('exposure', 0.9)])
    saveStagePreset.mockResolvedValue({ ok: true, preset: preset(3, 'mine', { exposure: 0.9 }) })
    const s = useStagePresets(() => node)
    await flush()
    listStagePresets.mockResolvedValue({ presets: [preset(3, 'mine', { exposure: 0.9 })] })
    await s.savePresetAs('mine')
    expect(saveStagePreset).toHaveBeenCalledWith({
      kind: 'ComfyTV.VideoColorStage',
      name: 'mine',
      config: { exposure: 0.9 },
    })
    expect(s.presets.value).toHaveLength(1)
    expect(s.selectedId.value).toBe(3)
  })

  it('deletePresetById removes the preset and clears a matching selection', async () => {
    const node = makeNode([widget('exposure', 0)])
    listStagePresets.mockResolvedValue({ presets: [preset(5, 'gone', {})] })
    deleteStagePreset.mockResolvedValue({ ok: true })
    const s = useStagePresets(() => node)
    await flush()
    s.applyPresetById(5)
    listStagePresets.mockResolvedValue({ presets: [] })
    await s.deletePresetById(5)
    expect(deleteStagePreset).toHaveBeenCalledWith(5)
    expect(s.selectedId.value).toBeNull()
    expect(s.presets.value).toEqual([])
  })

  it('swallows defaults fetch failures and keeps hasConfig false', async () => {
    fetchStageDefaults.mockRejectedValue(new Error('offline'))
    const s = useStagePresets(() => makeNode([]))
    await flush()
    expect(s.hasConfig.value).toBe(false)
    expect(listStagePresets).not.toHaveBeenCalled()
  })
})

describe('useStagePresets — custom state', () => {
  it('flips the selection back to custom on any manual widget change', async () => {
    const exposure = widget('exposure', 0)
    const node = makeNode([exposure])
    listStagePresets.mockResolvedValue({ presets: [preset(1, 'warm', { exposure: 2 })] })
    const s = useStagePresets(() => node)
    await flush()
    expect(s.selectedId.value).toBeNull()
    s.applyPresetById(1)
    expect(s.selectedId.value).toBe(1)
    exposure.callback!(0.9)
    expect(s.selectedId.value).toBeNull()
    expect(exposure.spy).toHaveBeenCalledWith(0.9)
  })

  it('suppresses dirty tracking while a config is applied programmatically', async () => {
    const exposure = widget('exposure', 0)
    const node = makeNode([exposure])
    listStagePresets.mockResolvedValue({ presets: [preset(1, 'warm', { exposure: 2 })] })
    const s = useStagePresets(() => node)
    await flush()
    s.applyPresetById(1)
    s.applyConfig({ exposure: 5 })
    expect(exposure.value).toBe(5)
    expect(s.selectedId.value).toBe(1)
  })

  it('resetToDefaults returns to custom without a dirty round-trip', async () => {
    const exposure = widget('exposure', 3)
    const node = makeNode([exposure])
    listStagePresets.mockResolvedValue({ presets: [preset(1, 'warm', { exposure: 2 })] })
    const s = useStagePresets(() => node)
    await flush()
    s.applyPresetById(1)
    s.resetToDefaults()
    expect(exposure.value).toBe(0)
    expect(s.selectedId.value).toBeNull()
    exposure.callback!(1.1)
    expect(s.selectedId.value).toBeNull()
  })

  it('applies a builtin preset by string id and flips to custom on tweak', async () => {
    const exposure = widget('exposure', 0)
    const node = makeNode([exposure])
    listStagePresets.mockResolvedValue({
      presets: [builtinPreset('vintage', { exposure: 2 })],
    })
    const s = useStagePresets(() => node)
    await flush()
    s.applyPresetById('builtin:ComfyTV.VideoColorStage:vintage')
    expect(exposure.value).toBe(2)
    expect(s.selectedId.value).toBe('builtin:ComfyTV.VideoColorStage:vintage')
    expect(s.selectedPreset.value?.builtin).toBe(true)
    exposure.callback!(0.4)
    expect(s.selectedId.value).toBeNull()
  })

  it('markCustom clears the selection without touching widgets', async () => {
    const exposure = widget('exposure', 0)
    const node = makeNode([exposure])
    listStagePresets.mockResolvedValue({ presets: [preset(1, 'warm', { exposure: 2 })] })
    const s = useStagePresets(() => node)
    await flush()
    s.applyPresetById(1)
    expect(exposure.value).toBe(2)
    s.markCustom()
    expect(s.selectedId.value).toBeNull()
    expect(exposure.value).toBe(2)
  })
})

describe('stage presets shared revision', () => {
  it('reloads the kind list when another surface bumps the revision', async () => {
    const node = makeNode([widget('exposure', 0)])
    const s = useStagePresets(() => node)
    await flush()
    expect(s.presets.value).toEqual([])
    listStagePresets.mockResolvedValue({ presets: [preset(9, 'ext', {})] })
    bumpStagePresetsRevision()
    await flush()
    expect(s.presets.value.map((p) => p.id)).toEqual([9])
    expect(listStagePresets).toHaveBeenLastCalledWith('ComfyTV.VideoColorStage')
  })

  it('notifies other subscribers on save and delete but skips its own bumps', async () => {
    const external = vi.fn()
    useStagePresetsRevision(external)
    const node = makeNode([widget('exposure', 0.9)])
    saveStagePreset.mockResolvedValue({ ok: true, preset: preset(3, 'mine', { exposure: 0.9 }) })
    deleteStagePreset.mockResolvedValue({ ok: true })
    const s = useStagePresets(() => node)
    await flush()
    await s.savePresetAs('mine')
    await flush()
    expect(external).toHaveBeenCalledTimes(1)
    await s.deletePresetById(3)
    await flush()
    expect(external).toHaveBeenCalledTimes(2)
  })
})
