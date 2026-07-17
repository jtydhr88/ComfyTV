import { nextTick, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  uploadBlobNamed: vi.fn(),
  uploadCanvas: vi.fn(),
  isConvertibleModelFile: vi.fn(() => false),
  convertModelFileToGlb: vi.fn(),
  toastLoaderUploadFailed: vi.fn(),
}))

vi.mock('@/utils/uploadCanvas', () => ({
  uploadBlobNamed: mocks.uploadBlobNamed,
  uploadCanvas: mocks.uploadCanvas,
}))

vi.mock('@/widgets/three/convertToGlb', () => ({
  isConvertibleModelFile: mocks.isConvertibleModelFile,
  convertModelFileToGlb: mocks.convertModelFileToGlb,
}))

vi.mock('@/composables/stages/useLoaderFileDrop', () => ({
  toastLoaderUploadFailed: mocks.toastLoaderUploadFailed,
  useLoaderFileDrop: vi.fn(),
}))

import type { StageState } from '@/stores/stageStore'
import {
  baseName,
  computeMaterialSlots,
  computePartMaterials,
  inputFileUrl,
  menuPanelStyle,
  parseBindings,
  useModelLoader,
} from './useModelLoader'

interface FakeWidget {
  name: string
  type?: string
  value?: unknown
  hidden?: boolean
  options?: { values?: string[] }
  callback?: (v: unknown) => void
}

function makeNode(over: { value?: string; values?: string[]; bindings?: string } = {}) {
  const widgets: FakeWidget[] = [
    {
      name: 'model',
      type: 'combo',
      value: over.value ?? '',
      options: { values: over.values ?? ['3d/beta.glb', '3d/alpha.glb'] },
      callback: vi.fn(),
    },
    { name: 'choose file', type: 'button' },
    { name: 'material_bindings', type: 'text', value: over.bindings ?? '' },
    { name: 'project_id', type: 'text', value: '' },
  ]
  return { widgets } as any
}

function makeState(over: Partial<StageState> = {}): StageState {
  return reactive({
    kind: 'model',
    variant: 'loader',
    outputType: 'COMFYTV_MODEL',
    output: null,
    outputs: [null],
    running: false,
    inputs: [],
    mainPrompt: '',
    ...over,
  }) as StageState
}

const materialInput = (slot: string, color: string) => ({
  slot,
  type: 'COMFYTV_MATERIAL' as const,
  source: 'upstream' as const,
  content: JSON.stringify({ version: 1, color }),
})

function makeLoader(over: {
  node?: any
  state?: StageState
  captureCanvas?: () => HTMLCanvasElement | null
  onSelected?: () => void
} = {}) {
  const node = over.node ?? makeNode()
  const state = over.state ?? makeState()
  const onAction = vi.fn()
  const loader = useModelLoader(node, {
    getState: () => state,
    onAction,
    captureCanvas: over.captureCanvas ?? (() => null),
    onSelected: over.onSelected,
  })
  return { loader, node, state, onAction }
}

beforeEach(() => {
  mocks.uploadBlobNamed.mockReset()
  mocks.uploadCanvas.mockReset()
  mocks.isConvertibleModelFile.mockReset().mockReturnValue(false)
  mocks.convertModelFileToGlb.mockReset()
  mocks.toastLoaderUploadFailed.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('parseBindings', () => {
  it('keeps only non-empty string values', () => {
    expect(parseBindings('{"a":"s1","b":"","c":3,"d":"s2"}')).toEqual({ a: 's1', d: 's2' })
  })

  it('returns an empty record for invalid or non-object JSON', () => {
    expect(parseBindings('')).toEqual({})
    expect(parseBindings('not json')).toEqual({})
    expect(parseBindings('["a"]')).toEqual({})
    expect(parseBindings('null')).toEqual({})
  })
})

describe('inputFileUrl', () => {
  it('builds a /view url with subfolder', () => {
    expect(inputFileUrl('3d/sub/mesh.glb'))
      .toBe('/view?filename=mesh.glb&type=input&subfolder=3d%2Fsub')
  })

  it('omits the subfolder for bare names', () => {
    expect(inputFileUrl('mesh.glb')).toBe('/view?filename=mesh.glb&type=input')
  })

  it('returns empty for empty input', () => {
    expect(inputFileUrl('')).toBe('')
  })
})

describe('baseName', () => {
  it('strips directories', () => {
    expect(baseName('3d/sub/mesh.glb')).toBe('mesh.glb')
    expect(baseName('mesh.glb')).toBe('mesh.glb')
  })
})

describe('menuPanelStyle', () => {
  it('places the panel under the trigger', () => {
    expect(menuPanelStyle({ left: 100, bottom: 50 }, 1200, 800))
      .toEqual({ left: '100px', top: '54px' })
  })

  it('clamps to the viewport edges', () => {
    expect(menuPanelStyle({ left: 1100, bottom: 780 }, 1200, 800))
      .toEqual({ left: '812px', top: '420px' })
    expect(menuPanelStyle({ left: -50, bottom: -600 }, 1200, 800))
      .toEqual({ left: '8px', top: '8px' })
  })
})

describe('computeMaterialSlots', () => {
  it('numbers upstream material inputs and extracts their colors', () => {
    const slots = computeMaterialSlots([
      materialInput('m.a', '#ff0000'),
      { slot: 'img', type: 'COMFYTV_IMAGE', source: 'upstream', content: 'x' } as any,
      { ...materialInput('m.b', '#00ff00'), source: 'manual' } as any,
      { ...materialInput('m.c', '#0000ff'), content: null },
      materialInput('m.d', '#00ff00'),
    ])
    expect(slots).toEqual([
      { slot: 'm.a', label: 'M1', color: '#ff0000' },
      { slot: 'm.d', label: 'M2', color: '#00ff00' },
    ])
  })
})

describe('computePartMaterials', () => {
  it('maps bound parts to parsed materials and null for missing slots', () => {
    const out = computePartMaterials(
      [materialInput('m.a', '#ff0000')],
      { body: 'm.a', arm: 'm.gone' },
    )
    expect(out.body?.color).toBe('#ff0000')
    expect(out.arm).toBeNull()
  })
})

describe('useModelLoader', () => {
  it('init hides the model and button widgets and seeds sorted files', () => {
    const { loader, node } = makeLoader()
    loader.init()
    const byName = Object.fromEntries(node.widgets.map((w: FakeWidget) => [w.name, w]))
    expect(byName['model'].hidden).toBe(true)
    expect(byName['choose file'].hidden).toBe(true)
    expect(byName['project_id'].hidden).toBeUndefined()
    expect(loader.files.value).toEqual(['3d/alpha.glb', '3d/beta.glb'])
  })

  it('init restores the saved selection and registers it when missing', () => {
    const { loader } = makeLoader({ node: makeNode({ value: '3d/saved.glb', values: [] }) })
    loader.init()
    expect(loader.selected.value).toBe('3d/saved.glb')
    expect(loader.files.value).toEqual(['3d/saved.glb'])
  })

  it('filters files by the query', () => {
    const { loader } = makeLoader()
    loader.init()
    loader.query.value = 'ALPHA'
    expect(loader.filteredFiles.value).toEqual(['3d/alpha.glb'])
  })

  it('onPick writes the widget, fires its callback and notifies onSelected', () => {
    const onSelected = vi.fn()
    const { loader, node } = makeLoader({ onSelected })
    loader.onPick('3d/alpha.glb')
    const w = node.widgets.find((x: FakeWidget) => x.name === 'model')
    expect(w.value).toBe('3d/alpha.glb')
    expect(w.callback).toHaveBeenCalledWith('3d/alpha.glb')
    expect(onSelected).toHaveBeenCalled()
    expect(loader.selected.value).toBe('3d/alpha.glb')
  })

  it('modelSrc prefers the stage output over the selected input file', () => {
    const state = makeState()
    const { loader } = makeLoader({ state })
    loader.selected.value = '3d/mesh.glb'
    expect(loader.modelSrc.value).toBe('/view?filename=mesh.glb&type=input&subfolder=3d')
    state.output = '/view?filename=out.glb'
    expect(loader.modelSrc.value).toBe('/view?filename=out.glb')
  })

  it('uploads files into input/3d, registers and selects the last one', async () => {
    mocks.uploadBlobNamed.mockResolvedValue({ name: 'new.glb', subfolder: '3d', type: 'input', url: '/u' })
    const { loader, node } = makeLoader()
    loader.init()
    const file = new File(['glb'], 'new.glb')
    await loader.uploadModelFiles([file])
    expect(mocks.uploadBlobNamed).toHaveBeenCalledWith(file, { subfolder: '3d', filename: 'new.glb' })
    expect(loader.selected.value).toBe('3d/new.glb')
    expect(loader.files.value).toContain('3d/new.glb')
    const w = node.widgets.find((x: FakeWidget) => x.name === 'model')
    expect(w.options.values).toContain('3d/new.glb')
    expect(loader.uploading.value).toBe(false)
  })

  it('converts convertible files to GLB before uploading', async () => {
    mocks.isConvertibleModelFile.mockReturnValue(true)
    const converted = new File(['glb'], 'mesh.glb')
    mocks.convertModelFileToGlb.mockResolvedValue(converted)
    mocks.uploadBlobNamed.mockResolvedValue({ name: 'mesh.glb', subfolder: '3d', type: 'input', url: '/u' })
    const { loader } = makeLoader()
    const source = new File(['obj'], 'mesh.obj')
    await loader.uploadModelFiles([source])
    expect(mocks.convertModelFileToGlb).toHaveBeenCalledWith(source)
    expect(mocks.uploadBlobNamed).toHaveBeenCalledWith(converted, { subfolder: '3d', filename: 'mesh.glb' })
  })

  it('surfaces upload failures and toasts', async () => {
    mocks.uploadBlobNamed.mockRejectedValue(new Error('disk full'))
    const { loader } = makeLoader()
    await loader.uploadModelFiles([new File(['x'], 'bad.glb')])
    expect(loader.uploadError.value).toContain('disk full')
    expect(mocks.toastLoaderUploadFailed).toHaveBeenCalled()
    expect(loader.uploading.value).toBe(false)
  })

  it('persists bindings to the material_bindings widget', async () => {
    const { loader, node } = makeLoader()
    loader.selectedPart.value = 'body'
    loader.bindSelected('m.a')
    await nextTick()
    const w = node.widgets.find((x: FakeWidget) => x.name === 'material_bindings')
    expect(w.value).toBe('{"body":"m.a"}')
    loader.unbind('body')
    await nextTick()
    expect(w.value).toBe('')
  })

  it('reloads bindings and clears the selection on node configure', () => {
    const node = makeNode({ bindings: '{"body":"m.a"}' })
    const { loader } = makeLoader({ node })
    expect(loader.bindings.value).toEqual({ body: 'm.a' })
    loader.selectedPart.value = 'body'
    node.widgets.find((x: FakeWidget) => x.name === 'material_bindings').value = '{"arm":"m.b"}'
    node.onConfigure({})
    expect(loader.bindings.value).toEqual({ arm: 'm.b' })
    expect(loader.selectedPart.value).toBeNull()
  })

  it('drops a stale part selection when the part list changes', () => {
    const { loader } = makeLoader()
    loader.onPartPick('body')
    expect(loader.selectedPart.value).toBe('body')
    loader.onPartsChanged(['arm'])
    expect(loader.partKeys.value).toEqual(['arm'])
    expect(loader.selectedPart.value).toBeNull()
    loader.onPartPick('arm')
    loader.onPartsChanged(['arm', 'leg'])
    expect(loader.selectedPart.value).toBe('arm')
  })

  it('captures the preview after the settle delay and fires the action', async () => {
    vi.useFakeTimers()
    const canvas = document.createElement('canvas')
    mocks.uploadCanvas.mockResolvedValue('/view?filename=cap.png')
    const { loader, onAction } = makeLoader({ captureCanvas: () => canvas })
    loader.scheduleCapture()
    loader.scheduleCapture()
    await vi.advanceTimersByTimeAsync(699)
    expect(mocks.uploadCanvas).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(mocks.uploadCanvas).toHaveBeenCalledTimes(1)
    expect(mocks.uploadCanvas.mock.calls[0][1]).toMatchObject({ subfolder: 'model3d-view' })
    expect(onAction).toHaveBeenCalledWith('model-capture-view', { imageUrl: '/view?filename=cap.png' })
  })

  it('teardown cancels a pending capture and a null canvas skips upload', async () => {
    vi.useFakeTimers()
    const { loader, onAction } = makeLoader({ captureCanvas: () => null })
    loader.scheduleCapture()
    await vi.advanceTimersByTimeAsync(700)
    expect(mocks.uploadCanvas).not.toHaveBeenCalled()
    expect(onAction).not.toHaveBeenCalled()

    const canvas = document.createElement('canvas')
    mocks.uploadCanvas.mockResolvedValue('/u')
    const second = makeLoader({ captureCanvas: () => canvas })
    second.loader.scheduleCapture()
    second.loader.teardown()
    await vi.advanceTimersByTimeAsync(700)
    expect(mocks.uploadCanvas).not.toHaveBeenCalled()
  })
})
