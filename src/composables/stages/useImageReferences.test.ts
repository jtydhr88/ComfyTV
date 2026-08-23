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
  fetchWorkflowMetaCached: vi.fn(),
}

const { importAssetFiles } = vi.hoisted(() => ({
  importAssetFiles: vi.fn(async (..._a: unknown[]): Promise<any[]> => []),
}))
vi.mock('@/composables/sidebar/assetImport', () => ({ importAssetFiles }))

vi.mock('@/stores/assetStore', () => ({ useAssetStore: () => store }))
vi.mock('@/stores/selectionStore', () => ({ useSelectionStore: () => selection }))
vi.mock('@/stores/stageStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/stageStore')>()
  return {
    ...actual,
    useStageStore: () => ({
      stateTick: 0,
      resolveUpstreamValue: vi.fn(() => null),
    }),
  }
})
vi.mock('@/stores/projectStore', () => ({
  useProjectStore: () => ({ currentProjectId: 'p1' }),
}))
const pinned = {
  list: vi.fn((_pid: string): any[] => []),
  byId: vi.fn((_pid: string, _id: string): any => undefined),
  refresh: vi.fn((..._a: unknown[]) => false),
  unpin: vi.fn(),
}
vi.mock('@/stores/pinnedBatchStore', () => ({
  usePinnedBatchStore: () => pinned,
}))
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k: string, p?: any) => (p ? `${k}:${JSON.stringify(p)}` : k) }),
}))
vi.mock('@/i18n', () => ({ t: (k: string) => k }))
// Keep the real pure helpers (nodeAcceptsAutogrowImages, wiredImageSlots,
// refSlotWarnings, assetChipLabel) but stub the network-backed lookups.
vi.mock('@/composables/stages/assetSlots', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./assetSlots')>()
  return {
    ...actual,
    workflowRefOfNode: (...a: any[]) => asMock.workflowRefOfNode(...a),
    fetchImageSlotOptions: (...a: any[]) => asMock.fetchImageSlotOptions(...a),
    fetchImageSlotOptionsCached: (...a: any[]) => asMock.fetchImageSlotOptionsCached(...a),
    fetchWorkflowMetaCached: (...a: any[]) => asMock.fetchWorkflowMetaCached(...a),
  }
})

import { app } from '@/lib/comfyApp'

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

const toastAdd = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  store.byId.mockImplementation((id: number) => ({ id, name: `a${id}`, payload_url: `/u${id}`, category_ids: [] }))
  // Reset implementations (clearAllMocks only clears call history) to safe defaults.
  asMock.workflowRefOfNode.mockReset().mockReturnValue(null)
  asMock.fetchImageSlotOptions.mockReset().mockResolvedValue([])
  asMock.fetchImageSlotOptionsCached.mockReset().mockResolvedValue([])
  asMock.fetchWorkflowMetaCached.mockReset().mockResolvedValue({})
  pinned.list.mockReset().mockReturnValue([])
  pinned.byId.mockReset().mockReturnValue(undefined)
  pinned.refresh.mockReset().mockReturnValue(false)
  pinned.unpin.mockReset()
  ;(app as any).extensionManager = { toast: { add: toastAdd } }
})

describe('useImageReferences', () => {
  it('initializes refs from node.properties', () => {
    const node = { ...IMAGES_NODE, properties: { comfytv_image_refs: [{ asset_id: 5, slot: 1 }] } }
    const ir = useImageReferences(() => node, rootElStub())
    expect(ir.refs.value).toEqual([{ asset_id: 5, slot: 1 }])
  })

  it('syncs refs when an external writeImageRefs lands on the node', async () => {
    const node = { ...IMAGES_NODE, properties: { comfytv_image_refs: [{ asset_id: 5, slot: 1 }] } }
    const ir = useImageReferences(() => node, rootElStub())
    const { writeImageRefs } = await import('@/composables/stages/imageRefs')
    writeImageRefs(node, [{ asset_id: 9, slot: 0, type: 'video' }])
    expect(ir.refs.value).toEqual([{ asset_id: 9, slot: 0, type: 'video' }])
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

  it('importFiles pins every created asset as a reference', async () => {
    importAssetFiles.mockResolvedValue([{ id: 21 }, { id: 22 }])
    const node = { ...IMAGES_NODE, properties: {} as any }
    const ir = useImageReferences(() => node, rootElStub())
    await ir.importFiles([new File([''], 'a.png', { type: 'image/png' })])
    expect(ir.refs.value).toEqual([{ asset_id: 21, slot: 0 }, { asset_id: 22, slot: 1 }])
  })

  it('fileDrop imports dropped image files and pins them', async () => {
    importAssetFiles.mockResolvedValue([{ id: 31 }])
    const node = { ...IMAGES_NODE, properties: {} as any }
    const ir = useImageReferences(() => node, rootElStub())
    const files = [new File([''], 'a.png', { type: 'image/png' })]
    ir.fileDrop.onDrop({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: {
        types: ['Files'],
        items: [{ kind: 'file', type: 'image/png' }],
        files,
        dropEffect: '',
        getData: () => '',
      },
    } as unknown as DragEvent)
    await vi.waitFor(() => expect(ir.refs.value).toEqual([{ asset_id: 31, slot: 0 }]))
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

  it('suppresses noSlots for mention-style workflows with dynamic image inputs', async () => {
    const node = {
      comfyClass: 'Test', inputs: [],
      properties: { comfytv_image_refs: [{ asset_id: 1, slot: 0 }, { asset_id: 2, slot: 0 }] },
    }
    asMock.workflowRefOfNode.mockReturnValue({ kind: 'video', label: 'h3' })
    asMock.fetchImageSlotOptionsCached.mockResolvedValue([])
    asMock.fetchWorkflowMetaCached.mockResolvedValue({ mention_style: 'minimax_tags' })
    const ir = useImageReferences(() => node, rootElStub())
    ir.init()
    await vi.waitFor(
      () => expect(ir.slotWarnings.value).toEqual(['imageRefs.warnDuplicate:{"n":0}']),
      { timeout: 2000 },
    )
    expect(ir.slotWarnings.value.join('|')).not.toContain('warnNoSlots')
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

  it('forceTypes overrides node capability detection', () => {
    const node = { inputs: [], properties: {} }
    const ir = useImageReferencesImpl(() => node as any, rootElStub() as any, {
      forceTypes: ['video', 'audio'],
    })
    expect(ir.accepts.value).toBe(true)
    expect(ir.acceptedMediaTypes.value).toEqual(['video', 'audio'])
  })

  it('acceptedMediaTypes reflects the node autogrow groups', () => {
    const node = { inputs: [{ name: 'images.image0' }, { name: 'audio' }], properties: {} }
    const ir = useImageReferences(() => node, rootElStub())
    expect(ir.acceptedMediaTypes.value).toEqual(['image', 'audio'])
  })

  it('exposes pinned batches as batch groups', () => {
    pinned.list.mockReturnValue([
      { id: 'b1', label: 'Batch 1', urls: ['/1'], source_uid: 'u1' },
      { id: 'b2', label: 'Batch 2', urls: [], source_uid: null },
    ])
    const ir = useImageReferences(() => IMAGES_NODE, rootElStub())
    expect(ir.batchGroups.value).toEqual([
      { id: 'b1', label: 'Batch 1', urls: ['/1'], canRefresh: true },
      { id: 'b2', label: 'Batch 2', urls: [], canRefresh: false },
    ])
    expect(pinned.list).toHaveBeenCalledWith('p1')
  })

  it('batchUrlOf resolves urls through the pinned store', () => {
    pinned.byId.mockImplementation((_pid: string, id: string) =>
      id === 'b1' ? { urls: ['/a', '/b'] } : undefined)
    const ir = useImageReferences(() => IMAGES_NODE, rootElStub())
    expect(ir.batchUrlOf({ asset_id: 1, slot: 0 })).toBeNull()
    expect(ir.batchUrlOf({ batch_index: 0, slot: 0 })).toBeNull()
    expect(ir.batchUrlOf({ batch_id: 'b1', batch_index: 1, slot: 0 })).toBe('/b')
    expect(ir.batchUrlOf({ batch_id: 'b1', batch_index: 9, slot: 0 })).toBeNull()
    expect(ir.batchUrlOf({ batch_id: 'gone', batch_index: 0, slot: 0 })).toBeNull()
  })

  it('onRefreshBatch toasts when the refresh fails', () => {
    pinned.refresh.mockReturnValue(false)
    const ir = useImageReferences(() => IMAGES_NODE, rootElStub())
    ir.onRefreshBatch('b1')
    expect(pinned.refresh).toHaveBeenCalledWith('p1', 'b1', expect.anything())
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'warn',
      summary: 'imageRefs.refreshFailed',
    }))
  })

  it('onRefreshBatch stays quiet when the refresh succeeds', () => {
    pinned.refresh.mockReturnValue(true)
    const ir = useImageReferences(() => IMAGES_NODE, rootElStub())
    ir.onRefreshBatch('b1')
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('onUnpinBatch delegates to the pinned store', () => {
    const ir = useImageReferences(() => IMAGES_NODE, rootElStub())
    ir.onUnpinBatch('b2')
    expect(pinned.unpin).toHaveBeenCalledWith('p1', 'b2')
  })

  it('labels batch refs with their group and ordinal', () => {
    pinned.byId.mockImplementation((_pid: string, id: string) =>
      id === 'b1' ? { label: 'Batch 1', urls: [] } : undefined)
    const ir = useImageReferences(() => IMAGES_NODE, rootElStub())
    expect(ir.assetLabel({ batch_index: 1, slot: 0 })).toBe('imageRefs.batchItem:{"n":2}')
    expect(ir.assetLabel({ batch_id: 'b1', batch_index: 0, slot: 0 }))
      .toBe('Batch 1 · imageRefs.batchItem:{"n":1}')
    expect(ir.assetLabel({ batch_id: 'gone', batch_index: 2, slot: 0 }))
      .toBe('imageRefs.batchItem:{"n":3}')
  })

  it('onAddBatchImage pins batch items with dedup and capability gating', () => {
    const node = { ...IMAGES_NODE, properties: {} as any }
    const ir = useImageReferences(() => node, rootElStub())
    ir.onAddBatchImage('g1', 0)
    ir.onAddBatchImage('g1', 0)
    ir.onAddBatchImage('g1', 1)
    expect(ir.refs.value).toEqual([
      { batch_index: 0, batch_id: 'g1', slot: 0 },
      { batch_index: 1, batch_id: 'g1', slot: 1 },
    ])
    const noImages = { inputs: [{ name: 'texts.text0' }], properties: {} as any }
    const ir2 = useImageReferences(() => noImages, rootElStub())
    ir2.onAddBatchImage('g1', 0)
    expect(ir2.refs.value).toEqual([])
  })

  it('importFiles surfaces failures without touching refs', async () => {
    importAssetFiles.mockRejectedValue(new Error('disk full'))
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const node = { ...IMAGES_NODE, properties: {} as any }
      const ir = useImageReferences(() => node, rootElStub())
      await ir.importFiles([new File([''], 'a.png', { type: 'image/png' })])
      expect(ir.refs.value).toEqual([])
      expect(err).toHaveBeenCalled()
      expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' }))
    } finally {
      err.mockRestore()
    }
  })

  it('offers fixed slot lists for video and audio refs', () => {
    const node = {
      inputs: [{ name: 'videos.video0' }, { name: 'audio' }],
      properties: {
        comfytv_image_refs: [
          { asset_id: 1, slot: 0, type: 'video' },
          { asset_id: 2, slot: 1, type: 'audio' },
        ],
      },
    }
    const ir = useImageReferences(() => node, rootElStub())
    ir.openSlotPicker(0, tileEvent(10, 20))
    expect(ir.slotPicker.value?.loading).toBe(false)
    expect(ir.slotPicker.value?.error).toBeNull()
    expect(ir.slotPicker.value?.options.map(o => o.slot)).toEqual([0, 1, 2, 3])
    ir.closeSlotPicker()
    ir.openSlotPicker(1, tileEvent(10, 20))
    expect(ir.slotPicker.value?.options.map(o => o.slot)).toEqual([0, 1, 2])
    expect(asMock.fetchImageSlotOptions).not.toHaveBeenCalled()
  })
})
