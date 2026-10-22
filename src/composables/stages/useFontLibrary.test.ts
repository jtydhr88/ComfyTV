import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'

const listResources = vi.fn()
vi.mock('@/api', () => ({
  listResources: (...a: any[]) => listResources(...a),
}))

import { notifyFontsChanged, useFontLibrary } from './useFontLibrary'

function fontRow(name: string, filename: string, missing = false) {
  return {
    id: 1,
    kind: 'font',
    name,
    filename,
    subfolder: 'comfytv/fonts',
    size: 10,
    sha256: null,
    created_at: null,
    url: `/view?filename=${filename}&subfolder=comfytv/fonts&type=input`,
    missing,
  }
}

const BUILTIN = ['Inter-Regular', 'NotoSansSC-Regular', 'msyh', 'arial']

let wrappers: VueWrapper[] = []
beforeEach(() => {
  vi.clearAllMocks()
  listResources.mockResolvedValue({ resources: [] })
})
afterEach(() => {
  wrappers.forEach(w => w.unmount())
  wrappers = []
})

function setup() {
  let api!: ReturnType<typeof useFontLibrary>
  wrappers.push(mount(defineComponent({
    setup() {
      api = useFontLibrary()
      return () => null
    },
  })))
  return api
}

const values = (api: ReturnType<typeof useFontLibrary>) =>
  api.fontOptions.value.map((o) => o.value)

describe('useFontLibrary', () => {
  it('offers only the built-in fonts when nothing is uploaded', async () => {
    const api = setup()
    await flushPromises()
    expect(listResources).toHaveBeenCalledWith('font')
    expect(values(api)).toEqual(BUILTIN)
  })

  it('lists uploaded renderable fonts first by resource name', async () => {
    listResources.mockResolvedValue({ resources: [
      fontRow('Zed', 'zed.otf'),
      fontRow('BrandSans', 'BrandSans.ttf'),
      fontRow('WebOnly', 'web.woff2'),
      fontRow('Gone', 'gone.ttf', true),
    ] })
    const api = setup()
    await flushPromises()
    expect(values(api)).toEqual(['BrandSans', 'Zed', ...BUILTIN])
  })

  it('does not duplicate a built-in name shadowed by an upload', async () => {
    listResources.mockResolvedValue({ resources: [fontRow('arial', 'my-arial.ttf')] })
    const api = setup()
    await flushPromises()
    expect(values(api)).toEqual(['arial', 'Inter-Regular', 'NotoSansSC-Regular', 'msyh'])
  })

  it('refetches mounted pickers when fonts change elsewhere', async () => {
    const api = setup()
    await flushPromises()
    listResources.mockResolvedValue({ resources: [fontRow('BrandSans', 'BrandSans.ttf')] })
    notifyFontsChanged()
    await flushPromises()
    expect(values(api)[0]).toBe('BrandSans')
  })

  it('keeps the built-in fonts when listing fails', async () => {
    listResources.mockRejectedValue(new Error('offline'))
    const api = setup()
    await flushPromises()
    expect(values(api)).toEqual(BUILTIN)
  })
})
