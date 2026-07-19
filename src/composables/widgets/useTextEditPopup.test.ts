import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const listResources = vi.fn()
vi.mock('@/api', () => ({
  listResources: (...a: any[]) => listResources(...a),
}))

import type { LayerEditorController } from './useLayerEditorStage'
import {
  clampNumber,
  fontRefToValue,
  parseFontValue,
  useTextEditPopup,
} from './useTextEditPopup'

function fontResource(id: number, name: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    kind: 'font',
    name,
    filename: `${name}.ttf`,
    subfolder: 'comfytv-fonts',
    size: 10,
    sha256: null,
    created_at: null,
    url: `/view?filename=${name}.ttf&subfolder=comfytv-fonts&type=input`,
    missing: false,
    ...extra,
  }
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  vi.clearAllMocks()
  listResources.mockResolvedValue({ resources: [] })
})

function makeEditor() {
  const textLayer = {
    id: 't1',
    type: 'text',
    fontRef: { kind: 'builtin', id: 'sans' },
    fontSize: 32,
  }
  const rasterLayer = { id: 'r1', type: 'raster' }
  const editor = {
    state: ref({ width: 512, height: 512, layers: [textLayer, rasterLayer] }),
    editingTextId: ref<string | null>(null),
    updateTextLayer: vi.fn(),
    fontStore: {
      builtins: vi.fn(() => [
        { id: 'sans', name: 'Sans' },
        { id: 'serif', name: 'Serif' },
      ]),
      hasFailed: vi.fn(() => false),
    },
  }
  return { editor: editor as unknown as LayerEditorController, raw: editor }
}

describe('clampNumber', () => {
  it('clamps into the range and falls back to min for NaN', () => {
    expect(clampNumber(10, 4, 2048)).toBe(10)
    expect(clampNumber(1, 4, 2048)).toBe(4)
    expect(clampNumber(99999, 4, 2048)).toBe(2048)
    expect(clampNumber(Number.NaN, 4, 2048)).toBe(4)
  })
})

describe('font value codec', () => {
  it('encodes builtin and url font refs', () => {
    expect(fontRefToValue({ kind: 'builtin', id: 'sans' })).toBe('builtin:sans')
    expect(fontRefToValue({ kind: 'url', url: 'http://x/f.ttf' } as never)).toBe('url:http://x/f.ttf')
  })

  it('parses builtin and url values and rejects anything else', () => {
    expect(parseFontValue('builtin:serif')).toEqual({ kind: 'builtin', id: 'serif' })
    expect(parseFontValue('url:http://x')).toEqual({ kind: 'url', url: 'http://x' })
    expect(parseFontValue(null)).toBeNull()
    expect(parseFontValue(42)).toBeNull()
    expect(parseFontValue('nope')).toBeNull()
  })
})

describe('useTextEditPopup', () => {
  it('resolves the edited text layer, ignoring non-text ids', () => {
    const { editor, raw } = makeEditor()
    const api = useTextEditPopup(editor, ref(null))
    expect(api.layer.value).toBeNull()
    raw.editingTextId.value = 't1'
    expect(api.layer.value?.id).toBe('t1')
    raw.editingTextId.value = 'r1'
    expect(api.layer.value).toBeNull()
    raw.editingTextId.value = 'missing'
    expect(api.layer.value).toBeNull()
  })

  it('close clears the editing id', () => {
    const { editor, raw } = makeEditor()
    const api = useTextEditPopup(editor, ref(null))
    raw.editingTextId.value = 't1'
    api.close()
    expect(raw.editingTextId.value).toBeNull()
  })

  it('patch forwards to updateTextLayer only when a layer is active', () => {
    const { editor, raw } = makeEditor()
    const api = useTextEditPopup(editor, ref(null))
    api.patch({ fontSize: 40 })
    expect(raw.updateTextLayer).not.toHaveBeenCalled()
    raw.editingTextId.value = 't1'
    api.patch({ fontSize: 40 })
    expect(raw.updateTextLayer).toHaveBeenCalledWith('t1', { fontSize: 40 })
  })

  it('clampNum reads and clamps the input value', () => {
    const { editor } = makeEditor()
    const api = useTextEditPopup(editor, ref(null))
    const e = { target: { value: '9999' } } as unknown as Event
    expect(api.clampNum(e, 4, 2048)).toBe(2048)
  })

  it('builds font options from the builtin list', async () => {
    const { editor } = makeEditor()
    const api = useTextEditPopup(editor, ref(null))
    await flush()
    expect(api.fontOptions.value).toEqual([
      { label: 'Sans', value: 'builtin:sans' },
      { label: 'Serif', value: 'builtin:serif' },
    ])
  })

  it('appends non-missing resource fonts to the options', async () => {
    listResources.mockResolvedValue({ resources: [
      fontResource(1, 'CoolFont'),
      fontResource(2, 'GoneFont', { missing: true }),
    ] })
    const { editor } = makeEditor()
    const api = useTextEditPopup(editor, ref(null))
    await flush()
    expect(listResources).toHaveBeenCalledWith('font')
    expect(api.fontOptions.value).toEqual([
      { label: 'Sans', value: 'builtin:sans' },
      { label: 'Serif', value: 'builtin:serif' },
      { label: 'CoolFont', value: 'url:/view?filename=CoolFont.ttf&subfolder=comfytv-fonts&type=input' },
    ])
  })

  it('keeps only builtin options when the resource list fails', async () => {
    listResources.mockRejectedValue(new Error('offline'))
    const { editor } = makeEditor()
    const api = useTextEditPopup(editor, ref(null))
    await flush()
    expect(api.fontOptions.value).toEqual([
      { label: 'Sans', value: 'builtin:sans' },
      { label: 'Serif', value: 'builtin:serif' },
    ])
  })

  it('reflects the active layer font value and failure state', () => {
    const { editor, raw } = makeEditor()
    const api = useTextEditPopup(editor, ref(null))
    expect(api.fontValue.value).toBe('')
    expect(api.fontFailed.value).toBe(false)
    raw.editingTextId.value = 't1'
    expect(api.fontValue.value).toBe('builtin:sans')
    raw.fontStore.hasFailed.mockReturnValue(true)
    expect(api.fontFailed.value).toBe(true)
  })

  it('applies builtin and url font changes and ignores malformed values', async () => {
    listResources.mockResolvedValue({ resources: [fontResource(1, 'CoolFont')] })
    const { editor, raw } = makeEditor()
    raw.editingTextId.value = 't1'
    const api = useTextEditPopup(editor, ref(null))
    await flush()
    api.onFontChange('builtin:serif')
    expect(raw.updateTextLayer).toHaveBeenCalledWith('t1', {
      fontRef: { kind: 'builtin', id: 'serif' },
    })
    raw.updateTextLayer.mockClear()
    api.onFontChange('url:/view?filename=CoolFont.ttf&subfolder=comfytv-fonts&type=input')
    expect(raw.updateTextLayer).toHaveBeenCalledWith('t1', {
      fontRef: {
        kind: 'url',
        url: '/view?filename=CoolFont.ttf&subfolder=comfytv-fonts&type=input',
        name: 'CoolFont',
      },
    })
    raw.updateTextLayer.mockClear()
    api.onFontChange('url:http://unknown/f.ttf')
    expect(raw.updateTextLayer).toHaveBeenCalledWith('t1', {
      fontRef: { kind: 'url', url: 'http://unknown/f.ttf' },
    })
    raw.updateTextLayer.mockClear()
    api.onFontChange('nope')
    expect(raw.updateTextLayer).not.toHaveBeenCalled()
  })

  it('focuses the textarea when editing starts', async () => {
    const { editor, raw } = makeEditor()
    const focus = vi.fn()
    const textareaEl = ref({ focus } as unknown as HTMLTextAreaElement)
    useTextEditPopup(editor, textareaEl)
    raw.editingTextId.value = 't1'
    await nextTick()
    await nextTick()
    expect(focus).toHaveBeenCalled()
  })
})
