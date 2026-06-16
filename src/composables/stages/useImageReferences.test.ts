import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const store = {
  byId: vi.fn(),
  addTag: vi.fn(),
  removeTag: vi.fn(),
  ensureHydrated: vi.fn(),
}
const selection = { bindingsVersion: 0, bumpBindings: vi.fn() }

vi.mock('@/stores/assetStore', () => ({ useAssetStore: () => store }))
vi.mock('@/stores/selectionStore', () => ({ useSelectionStore: () => selection }))
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k: string, p?: any) => (p ? `${k}:${JSON.stringify(p)}` : k) }),
}))

import { useImageReferences as useImageReferencesImpl } from './useImageReferences'

const useImageReferences = (getNode: () => any, rootEl: any) =>
  useImageReferencesImpl(getNode, rootEl)

const IMAGES_NODE = { comfyClass: 'Test', inputs: [{ name: 'images.image0' }], properties: {} as any }

function rootElStub() {
  return ref({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 400 }) } as any)
}
function tileEvent(left: number, bottom: number): MouseEvent {
  return { currentTarget: { getBoundingClientRect: () => ({ left, bottom }) } } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  store.byId.mockImplementation((id: number) => ({ id, name: `a${id}`, payload_url: `/u${id}`, category_ids: [] }))
})

describe('useImageReferences', () => {
  it('initializes refs from node.properties', () => {
    const node = { ...IMAGES_NODE, properties: { comfytv_image_refs: [{ asset_id: 5, slot: 1 }] } }
    const ir = useImageReferences(() => node, rootElStub())
    expect(ir.refs.value).toEqual([{ asset_id: 5, slot: 1 }])
  })

  it('accepts only nodes with an images autogrow group', () => {
    expect(useImageReferences(() => IMAGES_NODE, rootElStub()).accepts.value).toBe(true)
    const noImages = { inputs: [{ name: 'texts.text0' }], properties: {} }
    expect(useImageReferences(() => noImages, rootElStub()).accepts.value).toBe(false)
  })

  it('onAddAsset appends with an explicit lowest-free slot, dedups, and persists', () => {
    const node = { ...IMAGES_NODE, properties: {} as any }
    const ir = useImageReferences(() => node, rootElStub())
    ir.onAddAsset({ id: 7 } as any)
    ir.onAddAsset({ id: 7 } as any)
    ir.onAddAsset({ id: 8 } as any)
    expect(ir.refs.value).toEqual([{ asset_id: 7, slot: 0 }, { asset_id: 8, slot: 1 }])
    expect(node.properties.comfytv_image_refs).toEqual([
      { asset_id: 7, slot: 0 }, { asset_id: 8, slot: 1 },
    ])
  })

  it('onAddAsset skips slots already wired upstream', () => {
    const node = { inputs: [{ name: 'images.image0', link: 9 }], properties: {} as any }
    const ir = useImageReferences(() => node, rootElStub())
    ir.onAddAsset({ id: 5 } as any)
    expect(ir.refs.value).toEqual([{ asset_id: 5, slot: 1 }])
  })

  it('removeRef drops by index and persists', () => {
    const node = { ...IMAGES_NODE, properties: { comfytv_image_refs: [{ asset_id: 1, slot: 0 }, { asset_id: 2, slot: 1 }] } }
    const ir = useImageReferences(() => node, rootElStub())
    ir.removeRef(0)
    expect(ir.refs.value).toEqual([{ asset_id: 2, slot: 1 }])
  })

  it('openSlotPicker reports the ref slot, claimed and wired slots', () => {
    const node = { ...IMAGES_NODE, properties: { comfytv_image_refs: [{ asset_id: 1, slot: 0 }, { asset_id: 2, slot: 3 }] } }
    const ir = useImageReferences(() => node, rootElStub())
    ir.openSlotPicker(0, tileEvent(10, 20))
    const p = ir.slotPicker.value!
    expect(p.index).toBe(0)
    expect(p.currentSlot).toBe(0)
    expect(p.loading).toBe(false)
    expect(p.claimedSlots).toEqual([3])
  })

  it('onSlotPick re-pins the slot and persists', () => {
    const node = { ...IMAGES_NODE, properties: { comfytv_image_refs: [{ asset_id: 1, slot: 0 }] } }
    const ir = useImageReferences(() => node, rootElStub())
    ir.openSlotPicker(0, tileEvent(10, 20))
    ir.onSlotPick(2)
    expect(ir.refs.value).toEqual([{ asset_id: 1, slot: 2 }])
    expect(node.properties.comfytv_image_refs).toEqual([{ asset_id: 1, slot: 2 }])
    expect(ir.slotPicker.value).toBeNull()
  })

  it('assetLabel/tileTooltip resolve through the store', () => {
    const ir = useImageReferences(() => IMAGES_NODE, rootElStub())
    expect(ir.assetLabel({ asset_id: 3, slot: 0 })).toBe('a3')
    expect(ir.tileTooltip({ asset_id: 3, slot: 0 })).toContain('a3')
  })
})
