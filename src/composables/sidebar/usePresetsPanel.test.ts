import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const listStagePresets = vi.fn()
const updateStagePreset = vi.fn()
const deleteStagePreset = vi.fn()
const fetchStageDefaults = vi.fn()
const saveStagePreset = vi.fn()
vi.mock('@/api', () => ({
  listStagePresets: (...a: any[]) => listStagePresets(...a),
  updateStagePreset: (...a: any[]) => updateStagePreset(...a),
  deleteStagePreset: (...a: any[]) => deleteStagePreset(...a),
  fetchStageDefaults: (...a: any[]) => fetchStageDefaults(...a),
  saveStagePreset: (...a: any[]) => saveStagePreset(...a),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, args?: Record<string, unknown>) =>
      args ? `${key}:${JSON.stringify(args)}` : key,
  }),
}))

const askText = vi.fn()
vi.mock('@/composables/dialog/useTextInputDialog', () => ({
  askText: (...a: any[]) => askText(...a),
}))

const askConfirm = vi.fn()
vi.mock('@/composables/dialog/useConfirmDialog', () => ({
  askConfirm: (...a: any[]) => askConfirm(...a),
}))

const localeMock = vi.hoisted(() => ({ value: 'en' }))
vi.mock('@/i18n', () => ({
  i18n: { global: { locale: localeMock } },
  t: (key: string) => key,
}))

import { bumpStagePresetsRevision } from '@/composables/stages/useStagePresets'

import { stageDisplayName, usePresetsPanel } from './usePresetsPanel'

function preset(id: number, kind: string, name: string) {
  return { id, kind, name, config: { exposure: 0.5 }, builtin: false, created_at: null }
}

function builtinPreset(kind: string, name: string) {
  return {
    id: `builtin:${kind}:${name}`,
    kind,
    name,
    config: { preset: 'none' },
    builtin: true,
    created_at: null,
  }
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  vi.clearAllMocks()
  localeMock.value = 'en'
  listStagePresets.mockResolvedValue({ presets: [] })
})

describe('stageDisplayName', () => {
  it('resolves the locale display name from nodeDefs', () => {
    expect(stageDisplayName('ComfyTV.VideoColorStage')).toBe('Video Color')
    localeMock.value = 'zh'
    expect(stageDisplayName('ComfyTV.VideoColorStage')).toBe('视频调色')
  })

  it('falls back to the node_id suffix for unknown kinds', () => {
    expect(stageDisplayName('ComfyTV.NopeStage')).toBe('NopeStage')
    expect(stageDisplayName('BareKind')).toBe('BareKind')
  })
})

describe('usePresetsPanel', () => {
  it('loads all presets when the panel becomes active', async () => {
    const active = ref(false)
    const p = usePresetsPanel(() => active.value)
    await flush()
    expect(listStagePresets).not.toHaveBeenCalled()
    active.value = true
    await flush()
    expect(listStagePresets).toHaveBeenCalledWith()
    expect(p.presets.value).toEqual([])
  })

  it('groups presets by kind with display-name labels, sorted', async () => {
    listStagePresets.mockResolvedValue({ presets: [
      preset(1, 'ComfyTV.VideoCurvesStage', 'soft'),
      preset(2, 'ComfyTV.VideoColorStage', 'warm'),
      preset(3, 'ComfyTV.VideoColorStage', 'cool'),
    ] })
    const p = usePresetsPanel(() => true)
    await flush()
    expect(p.groups.value.map((g) => g.label)).toEqual(['Video Color', 'Video Curves'])
    expect(p.groups.value[0]!.kind).toBe('ComfyTV.VideoColorStage')
    expect(p.groups.value[0]!.presets.map((r) => r.name)).toEqual(['warm', 'cool'])
  })

  it('toggleGroup collapses and expands a kind', async () => {
    const p = usePresetsPanel(() => true)
    await flush()
    expect(p.isCollapsed('ComfyTV.VideoColorStage')).toBe(false)
    p.toggleGroup('ComfyTV.VideoColorStage')
    expect(p.isCollapsed('ComfyTV.VideoColorStage')).toBe(true)
    p.toggleGroup('ComfyTV.VideoColorStage')
    expect(p.isCollapsed('ComfyTV.VideoColorStage')).toBe(false)
  })

  it('onRename patches the preset and refetches', async () => {
    listStagePresets.mockResolvedValue({ presets: [preset(1, 'ComfyTV.VideoColorStage', 'warm')] })
    updateStagePreset.mockResolvedValue({ ok: true, preset: preset(1, 'ComfyTV.VideoColorStage', 'warmer') })
    askText.mockResolvedValue(' warmer ')
    const p = usePresetsPanel(() => true)
    await flush()
    listStagePresets.mockClear()
    await p.onRename(preset(1, 'ComfyTV.VideoColorStage', 'warm') as any)
    expect(updateStagePreset).toHaveBeenCalledWith(1, { name: 'warmer' })
    expect(listStagePresets).toHaveBeenCalled()
  })

  it('onRename is a no-op when cancelled or unchanged', async () => {
    const p = usePresetsPanel(() => true)
    await flush()
    askText.mockResolvedValueOnce(null)
    await p.onRename(preset(1, 'ComfyTV.VideoColorStage', 'warm') as any)
    askText.mockResolvedValueOnce('warm')
    await p.onRename(preset(1, 'ComfyTV.VideoColorStage', 'warm') as any)
    expect(updateStagePreset).not.toHaveBeenCalled()
  })

  it('onDelete removes only after confirmation and refetches', async () => {
    deleteStagePreset.mockResolvedValue({ ok: true })
    const p = usePresetsPanel(() => true)
    await flush()
    askConfirm.mockResolvedValueOnce(false)
    await p.onDelete(preset(1, 'ComfyTV.VideoColorStage', 'warm') as any)
    expect(deleteStagePreset).not.toHaveBeenCalled()
    listStagePresets.mockClear()
    askConfirm.mockResolvedValueOnce(true)
    await p.onDelete(preset(1, 'ComfyTV.VideoColorStage', 'warm') as any)
    expect(askConfirm).toHaveBeenCalledWith(expect.objectContaining({ danger: true }))
    expect(deleteStagePreset).toHaveBeenCalledWith(1)
    expect(listStagePresets).toHaveBeenCalled()
  })

  it('groups include builtin rows alongside user rows', async () => {
    listStagePresets.mockResolvedValue({ presets: [
      builtinPreset('ComfyTV.VideoCurvesStage', 'vintage'),
      preset(1, 'ComfyTV.VideoCurvesStage', 'mine'),
    ] })
    const p = usePresetsPanel(() => true)
    await flush()
    expect(p.groups.value).toHaveLength(1)
    expect(p.groups.value[0]!.presets.map((r) => [r.name, r.builtin]))
      .toEqual([['vintage', true], ['mine', false]])
  })

  it('onRename and onDelete are no-ops for builtin presets', async () => {
    const p = usePresetsPanel(() => true)
    await flush()
    const row = builtinPreset('ComfyTV.VideoCurvesStage', 'vintage')
    await p.onRename(row as any)
    await p.onDelete(row as any)
    expect(askText).not.toHaveBeenCalled()
    expect(askConfirm).not.toHaveBeenCalled()
    expect(updateStagePreset).not.toHaveBeenCalled()
    expect(deleteStagePreset).not.toHaveBeenCalled()
  })

  it('refetches when the shared revision is bumped elsewhere while active', async () => {
    const p = usePresetsPanel(() => true)
    await flush()
    listStagePresets.mockResolvedValue({ presets: [preset(4, 'ComfyTV.VideoColorStage', 'new')] })
    bumpStagePresetsRevision()
    await flush()
    expect(p.presets.value.map((r) => r.id)).toEqual([4])
  })
})
