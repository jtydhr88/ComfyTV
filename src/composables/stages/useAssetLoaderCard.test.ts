import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'

const { fakeAssetStore, fakeStageStore, importAssetFiles } = vi.hoisted(() => ({
  fakeAssetStore: {
    ensureHydrated: vi.fn(),
    installWebSocketSync: vi.fn(),
    hydrate: vi.fn(async () => {}),
    listByCategory: vi.fn((_f: unknown): any[] => []),
    byId: vi.fn((_id: number): any => undefined),
    byPayloadUrl: vi.fn((_url: string): any => undefined),
    categories: [] as any[],
  },
  fakeStageStore: { setOutputSlot: vi.fn() },
  importAssetFiles: vi.fn(async (..._a: unknown[]): Promise<any[]> => []),
}))
vi.mock('@/stores/assetStore', () => ({
  useAssetStore: () => fakeAssetStore,
}))
vi.mock('@/stores/stageStore', () => ({
  useStageStore: () => fakeStageStore,
}))
vi.mock('@/composables/sidebar/assetImport', () => ({ importAssetFiles }))

import {
  assetTooltipOf,
  loaderMediaTypeOf,
  parseCategoryFilter,
  useAssetLoaderCard,
} from './useAssetLoaderCard'

const IMG_ASSET = {
  id: 1, name: 'pic', media_type: 'image', payload_url: '/a/pic.png',
  width: 640, height: 480, category_ids: [],
} as any
const VID_ASSET = {
  id: 2, name: 'clip', media_type: 'video', payload_url: '/a/clip.mp4',
  category_ids: [],
} as any

function makeNode(over: Record<string, unknown> = {}) {
  return {
    widgets: [
      { name: 'category', value: over.category ?? 'all', callback: undefined as any },
      { name: 'asset_url', value: over.asset_url ?? '', callback: undefined as any },
      { name: 'asset_id', value: over.asset_id ?? 0, callback: undefined as any },
    ],
  } as any
}

function widgetValue(node: any, name: string) {
  return node.widgets.find((w: any) => w.name === name).value
}

let wrappers: VueWrapper[] = []

async function setup(node = makeNode(), kind = 'image') {
  const state = { kind } as any
  let api!: ReturnType<typeof useAssetLoaderCard>
  const wrapper = mount(defineComponent({
    setup() {
      api = useAssetLoaderCard(node, () => state)
      return () => null
    },
  }))
  wrappers.push(wrapper)
  await vi.waitFor(() => expect(fakeAssetStore.hydrate).toHaveBeenCalled())
  return { api, node, state }
}

beforeEach(() => {
  vi.clearAllMocks()
  fakeAssetStore.listByCategory.mockReturnValue([IMG_ASSET, VID_ASSET])
  fakeAssetStore.byId.mockReturnValue(undefined)
  fakeAssetStore.byPayloadUrl.mockReturnValue(undefined)
  importAssetFiles.mockResolvedValue([])
})

afterEach(() => {
  wrappers.forEach(w => w.unmount())
  wrappers = []
})

describe('pure helpers', () => {
  it('loaderMediaTypeOf maps stage kinds, defaults to image', () => {
    expect(loaderMediaTypeOf('video')).toBe('video')
    expect(loaderMediaTypeOf('audio')).toBe('audio')
    expect(loaderMediaTypeOf('model')).toBe('model')
    expect(loaderMediaTypeOf('image')).toBe('image')
    expect(loaderMediaTypeOf('anything')).toBe('image')
  })

  it('parseCategoryFilter accepts all/none/positive ids', () => {
    expect(parseCategoryFilter('all')).toBe('all')
    expect(parseCategoryFilter('none')).toBe('none')
    expect(parseCategoryFilter('3')).toBe(3)
    expect(parseCategoryFilter('0')).toBe('all')
    expect(parseCategoryFilter('junk')).toBe('all')
  })

  it('assetTooltipOf appends dimensions when known', () => {
    expect(assetTooltipOf(IMG_ASSET)).toBe('pic · 640×480')
    expect(assetTooltipOf(VID_ASSET)).toBe('clip')
    expect(assetTooltipOf({ name: '', category_ids: [] } as any)).toBe('—')
  })
})

describe('useAssetLoaderCard — listing', () => {
  it('filters visible assets and counts by the stage media type', async () => {
    const { api } = await setup(makeNode(), 'image')
    expect(api.mediaType.value).toBe('image')
    expect(api.visibleAssets.value).toEqual([IMG_ASSET])
    expect(api.mediaCount('all')).toBe(1)
  })

  it('video stages only see video assets', async () => {
    const { api } = await setup(makeNode(), 'video')
    expect(api.visibleAssets.value).toEqual([VID_ASSET])
  })
})

describe('useAssetLoaderCard — selection', () => {
  it('selectAsset persists widgets and pushes the output slot', async () => {
    const { api, node, state } = await setup()
    api.selectAsset(IMG_ASSET)
    expect(api.selectedId.value).toBe(1)
    expect(widgetValue(node, 'asset_url')).toBe('/a/pic.png')
    expect(widgetValue(node, 'asset_id')).toBe(1)
    expect(fakeStageStore.setOutputSlot).toHaveBeenCalledWith(state, 0, '/a/pic.png')
  })

  it('selectedAsset resolves through the store', async () => {
    fakeAssetStore.byId.mockImplementation((id: number) => (id === 1 ? IMG_ASSET : undefined))
    const { api } = await setup()
    expect(api.selectedAsset.value).toBeNull()
    api.selectAsset(IMG_ASSET)
    expect(api.selectedAsset.value).toEqual(IMG_ASSET)
  })

  it('setFilter writes the category widget', async () => {
    const { api, node } = await setup()
    api.setFilter(4)
    expect(api.activeFilter.value).toBe(4)
    expect(widgetValue(node, 'category')).toBe('4')
  })
})

describe('useAssetLoaderCard — mount restore', () => {
  it('restores the saved asset by id and heals a stale url', async () => {
    fakeAssetStore.byId.mockImplementation((id: number) => (id === 1 ? IMG_ASSET : undefined))
    const node = makeNode({ asset_id: 1, asset_url: '/stale.png', category: '2' })
    const { api, state } = await setup(node)
    expect(api.selectedId.value).toBe(1)
    expect(api.activeFilter.value).toBe(2)
    expect(widgetValue(node, 'asset_url')).toBe('/a/pic.png')
    expect(fakeStageStore.setOutputSlot).toHaveBeenCalledWith(state, 0, '/a/pic.png')
  })

  it('falls back to a payload-url lookup when no id is saved', async () => {
    fakeAssetStore.byPayloadUrl.mockImplementation((url: string) =>
      url === '/a/pic.png' ? IMG_ASSET : undefined)
    const { api } = await setup(makeNode({ asset_url: '/a/pic.png' }))
    expect(api.selectedId.value).toBe(1)
  })

  it('keeps an unmatched saved url as the output without selecting', async () => {
    const { api, state } = await setup(makeNode({ asset_url: '/gone.png' }))
    expect(api.selectedId.value).toBeNull()
    expect(fakeStageStore.setOutputSlot).toHaveBeenCalledWith(state, 0, '/gone.png')
  })

  it('does nothing without saved data', async () => {
    await setup()
    expect(fakeStageStore.setOutputSlot).not.toHaveBeenCalled()
  })
})

describe('useAssetLoaderCard — file drop import', () => {
  function dropEvent(files: File[]) {
    return {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: {
        types: ['Files'],
        items: files.map(() => ({ kind: 'file', type: 'image/png' })),
        files,
        dropEffect: '',
        getData: () => '',
      },
    } as unknown as DragEvent
  }

  it('imports dropped files into the active numeric category and selects the last', async () => {
    const created = { ...IMG_ASSET, id: 9, payload_url: '/a/new.png' }
    importAssetFiles.mockResolvedValue([created])
    const { api } = await setup()
    api.setFilter(5)
    api.fileDrop.onDrop(dropEvent([new File([''], 'new.png', { type: 'image/png' })]))
    await vi.waitFor(() => expect(importAssetFiles).toHaveBeenCalledTimes(1))
    expect(importAssetFiles.mock.calls[0][1]).toEqual({ categoryIds: [5] })
    await vi.waitFor(() => expect(api.selectedId.value).toBe(9))
  })

  it('non-numeric filters import without category bindings', async () => {
    importAssetFiles.mockResolvedValue([])
    const { api } = await setup()
    api.fileDrop.onDrop(dropEvent([new File([''], 'new.png', { type: 'image/png' })]))
    await vi.waitFor(() => expect(importAssetFiles).toHaveBeenCalledTimes(1))
    expect(importAssetFiles.mock.calls[0][1]).toEqual({ categoryIds: [] })
  })
})
