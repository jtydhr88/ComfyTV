import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiFetch = vi.fn()
vi.mock('@/api', () => ({ apiFetch: (...a: any[]) => apiFetch(...a) }))

const getStageMeta = vi.fn()
vi.mock('@/composables/stages/stageMeta', () => ({
  getStageMeta: (...a: any[]) => getStageMeta(...a),
}))

const getWidget = vi.fn()
vi.mock('@/utils/widget', () => ({ getWidget: (...a: any[]) => getWidget(...a) }))

let bindingsVersion = 0
vi.mock('@/stores/selectionStore', () => ({
  useSelectionStore: () => ({ bindingsVersion }),
}))

import {
  assetChipLabel,
  fetchImageSlotOptions,
  fetchImageSlotOptionsCached,
  imageSlotsFromConfig,
  type ImageSlotOption,
  injectImageRefs,
  missingRequiredImageSlots,
  nodeAcceptsAutogrowImages,
  refCoveredImageSlots,
  refSlotWarnings,
  type ResolvedImageRef,
  wiredImageSlots,
  workflowRefOfNode,
} from './assetSlots'

beforeEach(() => {
  apiFetch.mockReset()
  getStageMeta.mockReset()
  getWidget.mockReset()
  bindingsVersion = 0
})

function bw(stage_binding: string | null, title = '', type = 'LoadImage') {
  return { node_title: title, node_type: type, stage_binding }
}

function opt(slot: number): ImageSlotOption {
  return { slot, nodeTitles: [`LoadImage ${slot}`] }
}

function ref(over: Partial<ResolvedImageRef> = {}): ResolvedImageRef {
  return { id: 1, url: '/view?a.png', slot: 0, ...over }
}

describe('assetChipLabel', () => {
  it('prefers the asset name, falls back to a stable id label', () => {
    expect(assetChipLabel({ name: 'hero' } as any, 7)).toBe('hero')
    expect(assetChipLabel({ name: '' } as any, 7)).toBe('asset:7')
    expect(assetChipLabel(undefined, 7)).toBe('asset:7')
  })
})

describe('nodeAcceptsAutogrowImages', () => {
  it('detects an images autogrow group', () => {
    expect(nodeAcceptsAutogrowImages({ inputs: [{ name: 'images.image0' }] })).toBe(true)
    expect(nodeAcceptsAutogrowImages({ inputs: [{ name: 'texts.text0' }] })).toBe(false)
    expect(nodeAcceptsAutogrowImages({ inputs: [] })).toBe(false)
    expect(nodeAcceptsAutogrowImages(null)).toBe(false)
    expect(nodeAcceptsAutogrowImages({})).toBe(false)
  })
})

describe('wiredImageSlots', () => {
  it('returns only the connected image slots', () => {
    const node = {
      inputs: [
        { name: 'images.image0', link: 12 },
        { name: 'images.image1', link: null },
        { name: 'images.image2', link: 3 },
        { name: 'texts.text0', link: 5 },
      ],
    }
    expect(wiredImageSlots(node)).toEqual([0, 2])
    expect(wiredImageSlots(null)).toEqual([])
  })
})

describe('injectImageRefs', () => {
  it('does nothing for an empty ref list', () => {
    const inputs: Record<string, unknown> = {}
    expect(injectImageRefs(inputs, [])).toEqual([])
    expect(inputs).toEqual({})
  })

  it('writes each reference to its pinned slot', () => {
    const inputs: Record<string, unknown> = {}
    injectImageRefs(inputs, [ref({ url: '/a', slot: 0 }), ref({ url: '/b', slot: 1 })])
    expect(inputs).toEqual({ 'images.image0': '/a', 'images.image1': '/b' })
  })

  it('writes a reference to its slot regardless of which other slots are wired', () => {
    const inputs: Record<string, unknown> = { 'images.image0': '/wired' }
    injectImageRefs(inputs, [ref({ url: '/a', slot: 1 })])
    expect(inputs['images.image1']).toBe('/a')
    expect(inputs['images.image0']).toBe('/wired')
  })

  it('a pinned ref overrides an upstream connection and warns', () => {
    const inputs: Record<string, unknown> = { 'images.image0': '/wired' }
    const warnings = injectImageRefs(inputs, [ref({ url: '/pin', slot: 0 })])
    expect(inputs['images.image0']).toBe('/pin')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/override/i)
  })

  it('two refs pinned to the same slot warn, last one wins', () => {
    const inputs: Record<string, unknown> = {}
    const warnings = injectImageRefs(inputs, [
      ref({ url: '/first', slot: 0 }),
      ref({ url: '/second', slot: 0 }),
    ])
    expect(inputs['images.image0']).toBe('/second')
    expect(warnings.some(w => /later one wins/i.test(w))).toBe(true)
  })
})

describe('refCoveredImageSlots', () => {
  it('returns the slots the references are pinned to', () => {
    expect([...refCoveredImageSlots([{ slot: 2 }, { slot: 0 }, { slot: 1 }])].sort())
      .toEqual([0, 1, 2])
  })

  it('is empty for no refs', () => {
    expect([...refCoveredImageSlots([])]).toEqual([])
  })
})

describe('missingRequiredImageSlots', () => {
  it('flags required slots covered by neither a wire nor a ref', () => {
    expect(missingRequiredImageSlots([0, 1, 2], [0], [2])).toEqual([1])
  })

  it('returns nothing when every required slot has a source', () => {
    expect(missingRequiredImageSlots([0, 1], [0], [1])).toEqual([])
  })

  it('honors non-contiguous required slots', () => {
    expect(missingRequiredImageSlots([0, 2], [0], [])).toEqual([2])
  })

  it('is empty when nothing is required', () => {
    expect(missingRequiredImageSlots([], [], [])).toEqual([])
  })
})

describe('refSlotWarnings', () => {
  it('returns nothing for no refs', () => {
    expect(refSlotWarnings([], [], [opt(0)])).toEqual([])
  })

  it('flags a slot pinned by two refs', () => {
    const w = refSlotWarnings([{ slot: 0 }, { slot: 0 }], [], null)
    expect(w).toContainEqual({ kind: 'duplicate', slot: 0 })
  })

  it('flags a pinned ref that overrides a wired slot', () => {
    const w = refSlotWarnings([{ slot: 1 }], [1], null)
    expect(w).toContainEqual({ kind: 'override', slot: 1 })
  })

  it('skips consumability checks when options are unknown (null)', () => {
    expect(refSlotWarnings([{ slot: 0 }], [], null)).toEqual([])
  })

  it('warns noSlots when the workflow binds no image slot but refs exist', () => {
    expect(refSlotWarnings([{ slot: 0 }], [], [])).toEqual([{ kind: 'noSlots' }])
  })

  it('warns overflow when a ref sits on a slot the workflow does not bind', () => {
    const w = refSlotWarnings([{ slot: 0 }, { slot: 1 }], [], [opt(0)])
    expect(w).toContainEqual({ kind: 'overflow', count: 1, total: 1 })
  })

  it('no overflow when every ref lands on a bound slot', () => {
    const w = refSlotWarnings([{ slot: 0 }, { slot: 1 }], [], [opt(0), opt(1)])
    expect(w.some(x => x.kind === 'overflow')).toBe(false)
    expect(w.some(x => x.kind === 'noSlots')).toBe(false)
  })
})

describe('imageSlotsFromConfig', () => {
  it('groups binding widgets by slot and dedups node titles, sorted by slot', () => {
    const widgets = [
      bw('upstream_image:value[0]', 'Load A'),
      bw('upstream_image:annotated[0]', ''), // empty title falls back to node_type
      bw('upstream_image:masked[2]', 'Load B'),
      bw(null, 'ignored'),
      bw('not-a-binding', 'ignored'),
    ]
    expect(imageSlotsFromConfig(widgets as any)).toEqual([
      { slot: 0, nodeTitles: ['Load A', 'LoadImage'] },
      { slot: 2, nodeTitles: ['Load B'] },
    ])
  })

  it('is empty when no widget carries a slot binding', () => {
    expect(imageSlotsFromConfig([bw(null), bw('other')] as any)).toEqual([])
  })
})

describe('workflowRefOfNode', () => {
  it('returns null when the node is not a mapped stage', () => {
    getStageMeta.mockReturnValue(undefined)
    expect(workflowRefOfNode({ comfyClass: 'X' })).toBeNull()
  })

  it('returns null when the workflow widget is empty', () => {
    getStageMeta.mockReturnValue({ workflow_kind: 'image' })
    getWidget.mockReturnValue({ value: '' })
    expect(workflowRefOfNode({ comfyClass: 'ImageStage' })).toBeNull()
  })

  it('returns kind and label for a bound stage node', () => {
    getStageMeta.mockReturnValue({ workflow_kind: 'image' })
    getWidget.mockReturnValue({ value: 'MyWorkflow' })
    expect(workflowRefOfNode({ comfyClass: 'ImageStage' }))
      .toEqual({ kind: 'image', label: 'MyWorkflow' })
    expect(getStageMeta).toHaveBeenCalledWith('ImageStage')
  })
})

describe('wiredImageSlots edge cases', () => {
  it('skips inputs whose name is not a string', () => {
    expect(wiredImageSlots({ inputs: [{ link: 3 }, { name: 42, link: 1 }] })).toEqual([])
  })
})

describe('fetchImageSlotOptions', () => {
  it('fetches the workflow config and derives slot options', async () => {
    apiFetch.mockResolvedValue({
      exposed_widgets: [bw('upstream_image:value[0]', 'A')],
    })
    const opts = await fetchImageSlotOptions('image', 'wf')
    expect(apiFetch).toHaveBeenCalledTimes(1)
    const [path] = apiFetch.mock.calls[0]
    expect(path).toContain('kind=image')
    expect(path).toContain('label=wf')
    expect(opts).toEqual([{ slot: 0, nodeTitles: ['A'] }])
  })
})

describe('fetchImageSlotOptionsCached', () => {
  it('dedups concurrent calls for the same key', async () => {
    apiFetch.mockResolvedValue({ exposed_widgets: [] })
    const p1 = fetchImageSlotOptionsCached('k1', 'l1')
    const p2 = fetchImageSlotOptionsCached('k1', 'l1')
    expect(p1).toBe(p2)
    await Promise.all([p1, p2])
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })

  it('evicts the key when the fetch rejects so a retry re-fetches', async () => {
    apiFetch.mockRejectedValueOnce(new Error('down'))
    await expect(fetchImageSlotOptionsCached('k2', 'l2')).rejects.toThrow('down')
    apiFetch.mockResolvedValueOnce({ exposed_widgets: [] })
    await expect(fetchImageSlotOptionsCached('k2', 'l2')).resolves.toEqual([])
    expect(apiFetch).toHaveBeenCalledTimes(2)
  })

  it('invalidates the cache when bindingsVersion changes', async () => {
    apiFetch.mockResolvedValue({ exposed_widgets: [] })
    await fetchImageSlotOptionsCached('k3', 'l3')
    const before = apiFetch.mock.calls.length
    bindingsVersion = 1
    await fetchImageSlotOptionsCached('k3', 'l3')
    expect(apiFetch.mock.calls.length).toBe(before + 1)
  })
})
