import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const store = {
  byId: vi.fn(),
  addTag: vi.fn(),
  removeTag: vi.fn(),
  ensureHydrated: vi.fn(),
}
const selection = { bindingsVersion: 0, bumpBindings: vi.fn() }

const asMock = {
  workflowRefOfNode: vi.fn(),
  fetchImageSlotOptions: vi.fn(),
  fetchImageSlotOptionsCached: vi.fn(),
}

vi.mock('@/stores/assetStore', () => ({ useAssetStore: () => store }))
vi.mock('@/stores/selectionStore', () => ({ useSelectionStore: () => selection }))
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k: string, p?: any) => (p ? `${k}:${JSON.stringify(p)}` : k) }),
}))
// Keep the real pure helpers (nodeAcceptsAutogrowImages, wiredImageSlots,
// refSlotWarnings, assetChipLabel) but stub the network-backed lookups.
vi.mock('@/composables/stages/assetSlots', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./assetSlots')>()
  return {
    ...actual,
    workflowRefOfNode: (...a: any[]) => asMock.workflowRefOfNode(...a),
    fetchImageSlotOptions: (...a: any[]) => asMock.fetchImageSlotOptions(...a),
    fetchImageSlotOptionsCached: (...a: any[]) => asMock.fetchImageSlotOptionsCached(...a),
  }
})

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
  // Reset implementations (clearAllMocks only clears call history) to safe defaults.
  asMock.workflowRefOfNode.mockReset().mockReturnValue(null)
  asMock.fetchImageSlotOptions.mockReset().mockResolvedValue([])
  asMock.fetchImageSlotOptionsCached.mockReset().mockResolvedValue([])
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

  it('openSlotPicker is a no-op without a root element', () => {
    const node = { ...IMAGES_NODE, properties: { comfytv_image_refs: [{ asset_id: 1, slot: 0 }] } }
    const ir = useImageReferences(() => node, ref(null))
    ir.openSlotPicker(0, tileEvent(10, 20))
    expect(ir.slotPicker.value).toBeNull()
  })

  it('openSlotPicker loads slot options when the node maps to a workflow', async () => {
    const node = { ...IMAGES_NODE, properties: { comfytv_image_refs: [{ asset_id: 1, slot: 0 }] } }
    asMock.workflowRefOfNode.mockReturnValue({ kind: 'image', label: 'wf' })
    asMock.fetchImageSlotOptions.mockResolvedValue([{ slot: 0, nodeTitles: ['A'] }])
    const ir = useImageReferences(() => node, rootElStub())
    ir.openSlotPicker(0, tileEvent(10, 20))
    expect(ir.slotPicker.value?.loading).toBe(true)
    await vi.waitFor(() => {
      expect(ir.slotPicker.value?.loading).toBe(false)
      expect(ir.slotPicker.value?.options).toEqual([{ slot: 0, nodeTitles: ['A'] }])
    })
    expect(asMock.fetchImageSlotOptions).toHaveBeenCalledWith('image', 'wf')
  })

  it('openSlotPicker records an error when option loading fails', async () => {
    const node = { ...IMAGES_NODE, properties: { comfytv_image_refs: [{ asset_id: 1, slot: 0 }] } }
    asMock.workflowRefOfNode.mockReturnValue({ kind: 'image', label: 'wf' })
    asMock.fetchImageSlotOptions.mockRejectedValue(new Error('boom'))
    const ir = useImageReferences(() => node, rootElStub())
    ir.openSlotPicker(0, tileEvent(10, 20))
    await vi.waitFor(() => {
      expect(ir.slotPicker.value?.loading).toBe(false)
      expect(ir.slotPicker.value?.error).toBe('boom')
    })
  })

  it('onSlotPick is a no-op when no picker is open', () => {
    const node = { ...IMAGES_NODE, properties: { comfytv_image_refs: [{ asset_id: 1, slot: 0 }] } }
    const ir = useImageReferences(() => node, rootElStub())
    ir.onSlotPick(3)
    expect(ir.refs.value).toEqual([{ asset_id: 1, slot: 0 }])
    expect(ir.slotPicker.value).toBeNull()
  })

  it('onSlotPick ignores a stale picker whose ref no longer exists', () => {
    const node = { ...IMAGES_NODE, properties: { comfytv_image_refs: [{ asset_id: 1, slot: 0 }] } }
    const ir = useImageReferences(() => node, rootElStub())
    ir.openSlotPicker(0, tileEvent(10, 20))
    ir.removeRef(0)
    ir.onSlotPick(2)
    expect(ir.refs.value).toEqual([])
    expect(ir.slotPicker.value).toBeNull()
  })

  it('closeSlotPicker clears the open picker', () => {
    const node = { ...IMAGES_NODE, properties: { comfytv_image_refs: [{ asset_id: 1, slot: 0 }] } }
    const ir = useImageReferences(() => node, rootElStub())
    ir.openSlotPicker(0, tileEvent(10, 20))
    expect(ir.slotPicker.value).not.toBeNull()
    ir.closeSlotPicker()
    expect(ir.slotPicker.value).toBeNull()
  })

  it('recomputes slot warnings and maps them to i18n messages', async () => {
    const node = {
      comfyClass: 'Test',
      inputs: [{ name: 'images.image0', link: 9 }],
      properties: {
        comfytv_image_refs: [
          { asset_id: 1, slot: 0 }, { asset_id: 2, slot: 0 }, { asset_id: 3, slot: 5 },
        ],
      },
    }
    asMock.workflowRefOfNode.mockReturnValue({ kind: 'image', label: 'wf' })
    asMock.fetchImageSlotOptionsCached.mockResolvedValue([{ slot: 0, nodeTitles: ['A'] }])
    const ir = useImageReferences(() => node, rootElStub())
    ir.init()
    await vi.waitFor(
      () => expect(ir.slotWarnings.value.length).toBeGreaterThan(0),
      { timeout: 2000 },
    )
    const joined = ir.slotWarnings.value.join('|')
    expect(joined).toContain('imageRefs.warnDuplicate')
    expect(joined).toContain('imageRefs.warnOverride')
    expect(joined).toContain('imageRefs.warnOverflow')
  })

  it('warns noSlots when the workflow binds no image slots', async () => {
    const node = {
      comfyClass: 'Test', inputs: [],
      properties: { comfytv_image_refs: [{ asset_id: 1, slot: 0 }] },
    }
    asMock.workflowRefOfNode.mockReturnValue({ kind: 'image', label: 'wf' })
    asMock.fetchImageSlotOptionsCached.mockResolvedValue([])
    const ir = useImageReferences(() => node, rootElStub())
    ir.init()
    await vi.waitFor(
      () => expect(ir.slotWarnings.value).toEqual(['imageRefs.warnNoSlots']),
      { timeout: 2000 },
    )
  })

  it('falls back to null options (no consumability checks) when the slot fetch fails', async () => {
    const node = {
      comfyClass: 'Test', inputs: [],
      properties: { comfytv_image_refs: [{ asset_id: 1, slot: 0 }, { asset_id: 2, slot: 0 }] },
    }
    asMock.workflowRefOfNode.mockReturnValue({ kind: 'image', label: 'wf' })
    asMock.fetchImageSlotOptionsCached.mockRejectedValue(new Error('nope'))
    const ir = useImageReferences(() => node, rootElStub())
    ir.init()
    await vi.waitFor(
      () => expect(ir.slotWarnings.value).toEqual(['imageRefs.warnDuplicate:{"n":0}']),
      { timeout: 2000 },
    )
  })

  it('clears warnings when there are no refs', async () => {
    vi.useFakeTimers()
    try {
      const node = { comfyClass: 'Test', inputs: [], properties: {} }
      const ir = useImageReferences(() => node, rootElStub())
      ir.init()
      await vi.advanceTimersByTimeAsync(400)
      expect(ir.slotWarnings.value).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })
})
