import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, ref, type Ref } from 'vue'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'

const listResources = vi.fn()
const uploadResource = vi.fn()
vi.mock('@/api', () => ({
  listResources: (...a: any[]) => listResources(...a),
  uploadResource: (...a: any[]) => uploadResource(...a),
}))

import { useLutLibrary } from './useLutLibrary'

function lutRow(filename: string, missing = false) {
  return {
    id: 1,
    kind: 'lut',
    name: filename.replace(/\.\w+$/, ''),
    filename,
    subfolder: 'comfytv-luts',
    size: 10,
    sha256: null,
    created_at: null,
    url: `/view?filename=${filename}&subfolder=comfytv-luts&type=input`,
    missing,
  }
}

let wrappers: VueWrapper[] = []
beforeEach(() => {
  vi.clearAllMocks()
  listResources.mockResolvedValue({ resources: [] })
})
afterEach(() => {
  wrappers.forEach(w => w.unmount())
  wrappers = []
})

function setup(initial = '') {
  const lutFile = ref(initial)
  let api!: ReturnType<typeof useLutLibrary>
  const wrapper = mount(defineComponent({
    setup() {
      api = useLutLibrary(lutFile as Ref<string>)
      return () => null
    },
  }))
  wrappers.push(wrapper)
  return { api, lutFile }
}

function pickEvent(file: File | null): { e: Event; input: HTMLInputElement } {
  const input = document.createElement('input')
  input.type = 'file'
  Object.defineProperty(input, 'files', {
    value: file ? [file] : [],
    configurable: true,
  })
  input.value = ''
  return { e: { target: input } as unknown as Event, input }
}

describe('useLutLibrary', () => {
  it('loads lut resources on mount and selects the first when none chosen', async () => {
    listResources.mockResolvedValue({ resources: [lutRow('b.cube'), lutRow('a.cube')] })
    const { api, lutFile } = setup()
    await flushPromises()
    expect(listResources).toHaveBeenCalledWith('lut')
    expect(api.luts.value).toEqual(['a.cube', 'b.cube'])
    expect(lutFile.value).toBe('a.cube')
  })

  it('keeps the current selection when one exists', async () => {
    listResources.mockResolvedValue({ resources: [lutRow('a.cube'), lutRow('b.cube')] })
    const { lutFile } = setup('b.cube')
    await flushPromises()
    expect(lutFile.value).toBe('b.cube')
  })

  it('excludes resources whose file is missing on disk', async () => {
    listResources.mockResolvedValue({ resources: [
      lutRow('gone.cube', true),
      lutRow('here.cube'),
    ] })
    const { api, lutFile } = setup()
    await flushPromises()
    expect(api.luts.value).toEqual(['here.cube'])
    expect(lutFile.value).toBe('here.cube')
  })

  it('tolerates list failures', async () => {
    listResources.mockRejectedValue(new Error('offline'))
    const { api, lutFile } = setup()
    await flushPromises()
    expect(api.luts.value).toEqual([])
    expect(lutFile.value).toBe('')

    await api.refreshLuts()
    expect(api.luts.value).toEqual([])
  })

  it('uploads a picked file, refreshes, and selects it', async () => {
    const { api, lutFile } = setup()
    await flushPromises()

    uploadResource.mockResolvedValue({ ok: true, resource: lutRow('new.cube') })
    listResources.mockResolvedValue({ resources: [lutRow('new.cube')] })
    const file = new File(['x'], 'new.cube')
    const { e, input } = pickEvent(file)
    await api.onFilePicked(e)

    expect(uploadResource).toHaveBeenCalledWith('lut', file)
    expect(api.luts.value).toEqual(['new.cube'])
    expect(lutFile.value).toBe('new.cube')
    expect(input.value).toBe('')
  })

  it('resets the input even when the upload fails', async () => {
    const { api, lutFile } = setup()
    await flushPromises()

    listResources.mockClear()
    uploadResource.mockRejectedValue(new Error('bad extension'))
    const { e, input } = pickEvent(new File(['x'], 'bad.cube'))
    await api.onFilePicked(e)
    expect(lutFile.value).toBe('')
    expect(listResources).not.toHaveBeenCalled()
    expect(input.value).toBe('')
  })

  it('does nothing when no file is picked', async () => {
    const { api } = setup()
    await flushPromises()

    uploadResource.mockClear()
    const { e } = pickEvent(null)
    await api.onFilePicked(e)
    expect(uploadResource).not.toHaveBeenCalled()
  })
})
