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
  mediaBindingWarnings,
  mentionWorkflowRef,
  missingRequiredPositions,
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

describe('assetChipLabel', () => {
  it('prefers the asset name, falls back to a stable id label', () => {
    expect(assetChipLabel({ name: 'hero' } as any, 7)).toBe('hero')
    expect(assetChipLabel({ name: '' } as any, 7)).toBe('asset:7')
    expect(assetChipLabel(undefined, 7)).toBe('asset:7')
  })
})

describe('missingRequiredPositions', () => {
  it('flags required binding indexes beyond the media count', () => {
    expect(missingRequiredPositions([0, 1, 2], 1)).toEqual([1, 2])
    expect(missingRequiredPositions([0, 2], 2)).toEqual([2])
  })

  it('returns nothing when every required index is covered', () => {
    expect(missingRequiredPositions([0, 1], 2)).toEqual([])
    expect(missingRequiredPositions([], 0)).toEqual([])
  })
})

describe('mediaBindingWarnings', () => {
  it('returns nothing for no media or unknown bindings', () => {
    expect(mediaBindingWarnings(0, [opt(0)])).toEqual([])
    expect(mediaBindingWarnings(2, null)).toEqual([])
  })

  it('warns noSlots when the workflow binds no image slot but media exist', () => {
    expect(mediaBindingWarnings(1, [])).toEqual([{ kind: 'noSlots' }])
  })

  it('warns overflow when more media than bound slots', () => {
    expect(mediaBindingWarnings(3, [opt(0)])).toEqual([{ kind: 'overflow', count: 2, total: 1 }])
    expect(mediaBindingWarnings(2, [opt(0), opt(1)])).toEqual([])
  })
})

describe('imageSlotsFromConfig', () => {
  it('groups binding widgets by slot and dedups node titles, sorted by slot', () => {
    const widgets = [
      bw('upstream_image:value[0]', 'Load A'),
      bw('upstream_image:annotated[0]', ''),
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

describe('mentionWorkflowRef', () => {
  it('falls back to the first downstream consumer with a workflow', () => {
    getStageMeta.mockImplementation((cls: string) =>
      cls === 'VideoStage' ? { workflow_kind: 'video' } : undefined)
    getWidget.mockReturnValue({ value: 'H3 R2V' })
    const consumer = { comfyClass: 'VideoStage' }
    const graph = {
      links: { 7: { target_id: 42 } },
      getNodeById: (id: unknown) => (id === 42 ? consumer : null),
    }
    const builder = { comfyClass: 'TextLoaderStage', outputs: [{ links: [7] }] }
    expect(mentionWorkflowRef(builder, graph)).toEqual({ kind: 'video', label: 'H3 R2V' })
  })

  it('prefers the node own workflow and tolerates missing graph', () => {
    getStageMeta.mockReturnValue({ workflow_kind: 'image' })
    getWidget.mockReturnValue({ value: 'Own' })
    expect(mentionWorkflowRef({ comfyClass: 'ImageStage' }, undefined))
      .toEqual({ kind: 'image', label: 'Own' })
    getStageMeta.mockReturnValue(undefined)
    expect(mentionWorkflowRef({ comfyClass: 'X', outputs: [{ links: [1] }] }, undefined)).toBeNull()
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
