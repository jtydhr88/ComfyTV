import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const store = {
  forKind: vi.fn(() => []),
  create: vi.fn(async (p: any) => ({ id: 1, ...p })),
  remove: vi.fn(async () => true),
  ensureHydrated: vi.fn(),
  installWebSocketSync: vi.fn(),
}
vi.mock('@/stores/stageParamStore', () => ({ useStageParamStore: () => store }))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@vueuse/core', () => ({
  useStorage: (_key: string, initial: unknown) => ref(initial),
}))

const askConfirm = vi.fn(async (..._a: unknown[]) => true)
vi.mock('@/composables/dialog/useConfirmDialog', () => ({
  askConfirm: (...a: any[]) => askConfirm(...a),
}))

import { FALLBACK_STAGE_KINDS, useStageKindSelection, useStageParamForm } from './useStageParamForm'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useStageKindSelection', () => {
  it('falls back to the built-in kind list until the backend reports', () => {
    const sel = useStageKindSelection()
    expect(sel.activeKind.value).toBe(FALLBACK_STAGE_KINDS[0])
    expect(sel.kindOptions.value.map(o => o.value)).toEqual(FALLBACK_STAGE_KINDS)
    sel.onKinds(['image', 'video'])
    expect(sel.kindOptions.value).toEqual([
      { value: 'image', label: 'image' },
      { value: 'video', label: 'video' },
    ])
  })
})

describe('useStageParamForm', () => {
  const activeKind = ref('image')

  function make() {
    return useStageParamForm(activeKind)
  }

  it('hydrates the store and lists rows for the active kind', () => {
    const f = make()
    expect(store.ensureHydrated).toHaveBeenCalled()
    expect(store.installWebSocketSync).toHaveBeenCalled()
    void f.rows.value
    expect(store.forKind).toHaveBeenCalledWith('image')
  })

  it('requires a label before creating', async () => {
    const f = make()
    await f.onCreate()
    expect(f.error.value).toBe('stageParams.sidebar.labelRequired')
    expect(store.create).not.toHaveBeenCalled()
  })

  it('clears the error when the type changes', async () => {
    const f = make()
    await f.onCreate()
    expect(f.error.value).not.toBe('')
    f.form.type = 'int'
    await nextTick()
    expect(f.error.value).toBe('')
  })

  it('creates a float param with only the provided numeric config', async () => {
    const f = make()
    f.form.label = ' Denoise '
    f.form.type = 'float'
    f.form.numDefault = 0.5
    f.form.min = 0
    f.form.step = 0.05
    await f.onCreate()
    expect(store.create).toHaveBeenCalledWith({
      kind: 'image',
      label: 'Denoise',
      type: 'float',
      default: 0.5,
      config: { min: 0, step: 0.05 },
    })
    expect(f.form.label).toBe('')
    expect(f.form.min).toBeNull()
  })

  it('truncates int defaults and keeps null when unset', async () => {
    const f = make()
    f.form.label = 'Steps'
    f.form.type = 'int'
    f.form.numDefault = 7.9
    await f.onCreate()
    expect(store.create.mock.calls[0][0].default).toBe(7)
    f.form.label = 'Steps'
    f.form.type = 'int'
    f.form.numDefault = null
    await f.onCreate()
    expect(store.create.mock.calls[1][0].default).toBeNull()
  })

  it('builds combo options from the comma list and defaults to the first', async () => {
    const f = make()
    f.form.label = 'Mode'
    f.form.type = 'combo'
    f.form.options = ' a , b ,, c '
    expect(f.comboDefaultOptions.value).toEqual(['a', 'b', 'c'])
    await f.onCreate()
    expect(store.create).toHaveBeenCalledWith(expect.objectContaining({
      default: 'a',
      config: { options: ['a', 'b', 'c'] },
    }))
  })

  it('uses the boolean toggle and the string placeholder config', async () => {
    const f = make()
    f.form.label = 'Flag'
    f.form.type = 'boolean'
    f.form.boolDefault = true
    await f.onCreate()
    expect(store.create.mock.calls[0][0]).toMatchObject({ default: true, config: {} })
    f.form.label = 'Note'
    f.form.type = 'string'
    f.form.default = 'hi'
    f.form.placeholder = 'type here'
    await f.onCreate()
    expect(store.create.mock.calls[1][0]).toMatchObject({
      default: 'hi',
      config: { placeholder: 'type here' },
    })
  })

  it('keeps the form when the store rejects the create', async () => {
    store.create.mockResolvedValueOnce(null as any)
    const f = make()
    f.form.label = 'Kept'
    await f.onCreate()
    expect(f.form.label).toBe('Kept')
  })

  it('deletes only after confirmation', async () => {
    const f = make()
    askConfirm.mockResolvedValueOnce(false)
    await f.onDelete({ id: 3 } as any)
    expect(store.remove).not.toHaveBeenCalled()
    await f.onDelete({ id: 3 } as any)
    expect(store.remove).toHaveBeenCalledWith(3)
  })
})
