import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, ref, type Ref } from 'vue'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { useLutLibrary } from './useLutLibrary'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

function jsonRes(body: unknown, ok = true) {
  return { ok, json: async () => body }
}

let wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.forEach(w => w.unmount())
  wrappers = []
  fetchMock.mockReset()
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
  it('loads the list on mount and selects the first LUT when none chosen', async () => {
    fetchMock.mockResolvedValue(jsonRes({ luts: ['a.cube', 'b.cube'] }))
    const { api, lutFile } = setup()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/comfytv/luts')
    expect(api.luts.value).toEqual(['a.cube', 'b.cube'])
    expect(lutFile.value).toBe('a.cube')
  })

  it('keeps the current selection when one exists', async () => {
    fetchMock.mockResolvedValue(jsonRes({ luts: ['a.cube', 'b.cube'] }))
    const { lutFile } = setup('b.cube')
    await flushPromises()
    expect(lutFile.value).toBe('b.cube')
  })

  it('leaves the list untouched on a non-ok response', async () => {
    fetchMock.mockResolvedValue(jsonRes({}, false))
    const { api, lutFile } = setup()
    await flushPromises()
    expect(api.luts.value).toEqual([])
    expect(lutFile.value).toBe('')
  })

  it('tolerates a missing luts field and network errors', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({}))
    const { api } = setup()
    await flushPromises()
    expect(api.luts.value).toEqual([])

    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await api.refreshLuts()
    expect(api.luts.value).toEqual([])
  })

  it('uploads a picked file, refreshes, and selects it', async () => {
    fetchMock.mockResolvedValue(jsonRes({ luts: [] }))
    const { api, lutFile } = setup()
    await flushPromises()

    fetchMock.mockReset()
    fetchMock
      .mockResolvedValueOnce(jsonRes({ name: 'new.cube' }))
      .mockResolvedValueOnce(jsonRes({ luts: ['new.cube'] }))
    const { e, input } = pickEvent(new File(['x'], 'new.cube'))
    await api.onFilePicked(e)

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/comfytv/luts',
      expect.objectContaining({ method: 'POST' }))
    expect(api.luts.value).toEqual(['new.cube'])
    expect(lutFile.value).toBe('new.cube')
    expect(input.value).toBe('')
  })

  it('resets the input even when the upload fails', async () => {
    fetchMock.mockResolvedValue(jsonRes({ luts: [] }))
    const { api, lutFile } = setup()
    await flushPromises()

    fetchMock.mockReset()
    fetchMock.mockResolvedValueOnce(jsonRes({}, false))
    const { e } = pickEvent(new File(['x'], 'bad.cube'))
    await api.onFilePicked(e)
    expect(lutFile.value).toBe('')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does nothing when no file is picked', async () => {
    fetchMock.mockResolvedValue(jsonRes({ luts: [] }))
    const { api } = setup()
    await flushPromises()

    fetchMock.mockReset()
    const { e } = pickEvent(null)
    await api.onFilePicked(e)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
