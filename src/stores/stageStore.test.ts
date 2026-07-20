import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const autoProxyOutput = vi.fn(async () => {})
vi.mock('@/composables/widgets/useProxiedVideoUrl', () => ({
  autoProxyOutput: (...a: unknown[]) => (autoProxyOutput as (...x: unknown[]) => unknown)(...a),
}))

import { useStageStore, computePickedImageUrl, computePickedFromBatch, imagePoolCount, mergeImagePool, toImagePoolJson, removeImageFromPool, type StageState } from './stageStore'

function freshState(overrides: Partial<StageState> = {}): StageState {
  return {
    kind: 'image',
    variant: 'generator',
    outputType: 'COMFYTV_IMAGE',
    output: null,
    outputs: [null],
    running: false,
    inputs: [],
    mainPrompt: '',
    ...overrides,
  } as StageState
}

describe('stageStore.registerStage', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('creates state keyed on node object', () => {
    const store = useStageStore()
    const node = {}
    const state = store.registerStage(node, 'image', 'generator')
    expect(state.kind).toBe('image')
    expect(state.outputType).toBe('COMFYTV_IMAGE')
    expect(state.variant).toBe('generator')
    expect(store.getStage(node)).toBe(state)
  })

  it('maps kind→outputType correctly for all kinds', () => {
    const store = useStageStore()
    const cases: Array<[any, any]> = [
      ['text', 'COMFYTV_TEXT'],
      ['image', 'COMFYTV_IMAGE'],
      ['video', 'COMFYTV_VIDEO'],
      ['audio', 'COMFYTV_AUDIO'],
      ['panorama', 'COMFYTV_PANORAMA'],
      ['storyboard', 'COMFYTV_STORYBOARD'],
      ['image-batch', 'COMFYTV_IMAGES'],
      ['image-picker', 'COMFYTV_IMAGE'],
      ['timeline', 'COMFYTV_TIMELINE'],
    ]
    for (const [kind, expected] of cases) {
      const node = {}
      const state = store.registerStage(node, kind)
      expect(state.outputType).toBe(expected)
    }
  })

  it('defaults variant to generator', () => {
    const store = useStageStore()
    const node = {}
    const state = store.registerStage(node, 'image')
    expect(state.variant).toBe('generator')
  })

  it('unregisters via node ref', () => {
    const store = useStageStore()
    const node = {}
    store.registerStage(node, 'image')
    store.unregisterStage(node)
    expect(store.getStage(node)).toBeUndefined()
  })
})

describe('stageStore.bumpStateTick + notifyDownstream', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('increments stateTick', () => {
    const store = useStageStore()
    const before = store.stateTick
    store.bumpStateTick()
    expect(store.stateTick).toBe(before + 1)
  })

  it('notifyDownstream bumps the tick', () => {
    const store = useStageStore()
    const before = store.stateTick
    store.notifyDownstream()
    expect(store.stateTick).toBe(before + 1)
  })
})

describe('stageStore.refreshStageInputs', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('marks unconnected inputs as empty', () => {
    const store = useStageStore()
    const node: any = { inputs: [{ name: 'image', type: 'COMFYTV_IMAGE', link: null }] }
    const state = freshState()
    store.refreshStageInputs(node, state, { graph: { links: new Map() } })
    expect(state.inputs).toEqual([
      { slot: 'image', type: 'COMFYTV_IMAGE', source: 'empty', content: null },
    ])
  })

  it('resolves upstream from another stage output', () => {
    const store = useStageStore()
    const upstreamNode = {}
    const upstreamState = store.registerStage(upstreamNode, 'image')
    upstreamState.output = '/view?filename=a.png'

    const links = new Map([[1, { origin_id: 'u1' }]])
    const downNode: any = { inputs: [{ name: 'image', type: 'COMFYTV_IMAGE', link: 1 }] }
    const state = freshState()
    store.refreshStageInputs(downNode, state, {
      graph: {
        links,
        getNodeById: (id: string) => (id === 'u1' ? upstreamNode : null),
      },
    })
    expect(state.inputs[0]).toEqual({
      slot: 'image', type: 'COMFYTV_IMAGE', source: 'upstream',
      content: '/view?filename=a.png',
    })
  })

  it('marks upstream-pending when source has empty output', () => {
    const store = useStageStore()
    const upstreamNode = {}
    store.registerStage(upstreamNode, 'image')

    const links = new Map([[1, { origin_id: 'u1' }]])
    const downNode: any = { inputs: [{ name: 'image', type: 'COMFYTV_IMAGE', link: 1 }] }
    const state = freshState()
    store.refreshStageInputs(downNode, state, {
      graph: { links, getNodeById: () => upstreamNode },
    })
    expect(state.inputs[0].source).toBe('upstream-pending')
    expect(state.inputs[0].content).toBeNull()
  })

  it('falls back to object link map when not a Map', () => {
    const store = useStageStore()
    const upstreamNode = {}
    const upstreamState = store.registerStage(upstreamNode, 'image')
    upstreamState.output = 'url'

    const downNode: any = { inputs: [{ name: 'image', type: 'COMFYTV_IMAGE', link: 2 }] }
    const state = freshState()
    store.refreshStageInputs(downNode, state, {
      graph: {
        links: { 2: { origin_id: 'u2' } },
        getNodeById: () => upstreamNode,
      },
    })
    expect(state.inputs[0].source).toBe('upstream')
  })

  it('defaults type to COMFYTV_TEXT when missing', () => {
    const store = useStageStore()
    const node: any = { inputs: [{ name: 'x', link: null }] }
    const state = freshState()
    store.refreshStageInputs(node, state, { graph: { links: new Map() } })
    expect(state.inputs[0].type).toBe('COMFYTV_TEXT')
  })
})

describe('stageStore.refreshStageInputs (output-slot resolution)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('reads upstream from the outputs[] slot when populated', () => {
    const store = useStageStore()
    const up = {}
    const upState = store.registerStage(up, 'image')
    upState.outputs = ['slot0url']

    const links = new Map([[1, { origin_id: 'u1', origin_slot: 0 }]])
    const down: any = { inputs: [{ name: 'image', type: 'COMFYTV_IMAGE', link: 1 }] }
    const state = freshState()
    store.refreshStageInputs(down, state, {
      graph: { links, getNodeById: () => up },
    })
    expect(state.inputs[0]).toEqual({
      slot: 'image', type: 'COMFYTV_IMAGE', source: 'upstream', content: 'slot0url',
    })
  })
})

describe('stageStore.applyExecutedPayload', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    autoProxyOutput.mockClear()
  })

  it('auto-requests a proxy for video outputs', () => {
    const store = useStageStore()
    const state = freshState({ kind: 'video', outputType: 'COMFYTV_VIDEO' })
    store.applyExecutedPayload(state, { output: ['/view?filename=out.mp4'] })
    expect(autoProxyOutput).toHaveBeenCalledWith('/view?filename=out.mp4')
  })

  it('does not auto-proxy pickers, loaders or non-video outputs', () => {
    const store = useStageStore()
    store.applyExecutedPayload(
      freshState({ kind: 'video-picker', outputType: 'COMFYTV_VIDEO' }),
      { output: ['/view?filename=out.mp4'] })
    store.applyExecutedPayload(
      freshState({ kind: 'video', outputType: 'COMFYTV_VIDEO', variant: 'loader' }),
      { output: ['/view?filename=out.mp4'] })
    store.applyExecutedPayload(
      freshState(),
      { output: ['/view?filename=out.png'] })
    expect(autoProxyOutput).not.toHaveBeenCalled()
  })

  it('stores picked into slot 1 and picked_index (grows an empty outputs array)', () => {
    const store = useStageStore()
    const state = freshState({ outputs: [] })
    store.applyExecutedPayload(state, {
      output: ['main'], picked: ['pickedurl'], picked_index: ['3'],
    })
    expect(state.outputs[0]).toBe('main')
    expect(state.outputs[1]).toBe('pickedurl')
    expect(state.pickedIndex).toBe(3)
  })

  it('coerces scalar picked to string and numeric picked_index', () => {
    const store = useStageStore()
    const state = freshState()
    store.applyExecutedPayload(state, { output: 'm', picked: 42, picked_index: 2 })
    expect(state.outputs[1]).toBe('42')
    expect(state.pickedIndex).toBe(2)
  })

  it('ignores picked_index below 1', () => {
    const store = useStageStore()
    const state = freshState({ pickedIndex: 5 })
    store.applyExecutedPayload(state, { output: ['m'], picked_index: ['0'] })
    expect(state.pickedIndex).toBe(5)
  })

  it('copies payload string into state.output', () => {
    const store = useStageStore()
    const state = freshState({ running: true })
    store.applyExecutedPayload(state, { output: ['/view?filename=a.png'] })
    expect(state.output).toBe('/view?filename=a.png')
    expect(state.running).toBe(false)
    expect(state.progress).toBeNull()
  })

  it('clears prior error on success', () => {
    const store = useStageStore()
    const state = freshState({ error: { message: 'old' } })
    store.applyExecutedPayload(state, { output: ['ok'] })
    expect(state.error).toBeNull()
  })

  it('stamps outputId from msg', () => {
    const store = useStageStore()
    const state = freshState()
    store.applyExecutedPayload(state, { output: ['ok'], output_id: [42] })
    expect(state.outputId).toBe(42)
  })

  it('handles scalar (non-array) output/output_id', () => {
    const store = useStageStore()
    const state = freshState()
    store.applyExecutedPayload(state, { output: 'x', output_id: 7 })
    expect(state.output).toBe('x')
    expect(state.outputId).toBe(7)
  })

  it('skips output when payload is null', () => {
    const store = useStageStore()
    const state = freshState({ output: 'previous' })
    store.applyExecutedPayload(state, { output: [null] })
    expect(state.output).toBe('previous')
    expect(state.running).toBe(false)
  })

  it('converts non-string payload to string', () => {
    const store = useStageStore()
    const state = freshState()
    store.applyExecutedPayload(state, { output: [123] })
    expect(state.output).toBe('123')
  })

  it('outputId nulls out when missing', () => {
    const store = useStageStore()
    const state = freshState({ outputId: 5 })
    store.applyExecutedPayload(state, { output: ['ok'] })
    expect(state.outputId).toBeNull()
  })

  it('outputId nulls out when empty string', () => {
    const store = useStageStore()
    const state = freshState({ outputId: 5 })
    store.applyExecutedPayload(state, { output: ['ok'], output_id: [''] })
    expect(state.outputId).toBeNull()
  })

  it('bumps stateTick for downstream propagation', () => {
    const store = useStageStore()
    const state = freshState()
    const before = store.stateTick
    store.applyExecutedPayload(state, { output: ['ok'] })
    expect(store.stateTick).toBe(before + 1)
  })
})

describe('stageStore.applyExecutionError + clearError', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('attaches error and clears running', () => {
    const store = useStageStore()
    const state = freshState({ running: true, progress: { value: 0, max: 1 } })
    store.applyExecutionError(state, { message: 'oops' })
    expect(state.running).toBe(false)
    expect(state.progress).toBeNull()
    expect(state.error).toEqual({ message: 'oops' })
  })

  it('clearError nulls the error', () => {
    const store = useStageStore()
    const state = freshState({ error: { message: 'old' } })
    store.clearError(state)
    expect(state.error).toBeNull()
  })
})

describe('computePickedImageUrl', () => {
  function makeState(batch: string | null, pickedIndex?: number): StageState {
    return freshState({
      kind: 'image-picker',
      outputType: 'COMFYTV_IMAGE',
      inputs: [{ slot: 'batch', type: 'COMFYTV_IMAGES', source: 'upstream', content: batch }],
      pickedIndex,
    })
  }

  it('returns null when no upstream', () => {
    expect(computePickedImageUrl(makeState(null))).toBeNull()
  })

  it('picks by exact index match', () => {
    const batch = JSON.stringify({ images: [
      { index: '1', image_url: 'url1' },
      { index: '5', image_url: 'url5' },
    ]})
    expect(computePickedImageUrl(makeState(batch, 5))).toBe('url5')
  })

  it('falls back to position when no index match', () => {
    const batch = JSON.stringify({ images: [
      { index: 'a', image_url: 'u1' },
      { index: 'b', image_url: 'u2' },
    ]})
    expect(computePickedImageUrl(makeState(batch, 2))).toBe('u2')
  })

  it('defaults pickedIndex to 1', () => {
    const batch = JSON.stringify({ images: [{ index: '1', image_url: 'u1' }]})
    expect(computePickedImageUrl(makeState(batch))).toBe('u1')
  })

  it('treats a non-JSON string as a single image url', () => {
    // A single COMFYTV_IMAGE input arrives as a plain url, not batch JSON.
    expect(computePickedImageUrl(makeState('/view?filename=a.png'))).toBe('/view?filename=a.png')
  })

  it('returns null when no batch slot', () => {
    const state = freshState({ inputs: [] })
    expect(computePickedImageUrl(state)).toBeNull()
  })

  it('handles missing images array', () => {
    expect(computePickedImageUrl(makeState('{}'))).toBeNull()
  })

  it('prefers the pool over the live upstream batch', () => {
    const pool = JSON.stringify({ images: [{ index: '1', image_url: 'pooled' }] })
    const batch = JSON.stringify({ images: [{ index: '1', image_url: 'live' }] })
    const state = freshState({
      kind: 'image-picker',
      pool,
      inputs: [{ slot: 'batch', type: 'COMFYTV_IMAGES', source: 'upstream', content: batch }],
      pickedIndex: 1,
    })
    expect(computePickedImageUrl(state)).toBe('pooled')
  })
})

describe('mergeImagePool', () => {
  const img = (url: string) => ({ index: '1', image_url: url, label: url })
  const pool = (...urls: string[]) => JSON.stringify({ images: urls.map(img) })
  const urls = (json: string) =>
    (JSON.parse(json).images as Array<{ image_url: string }>).map(i => i.image_url)
  const indices = (json: string) =>
    (JSON.parse(json).images as Array<{ index: string }>).map(i => i.index)

  it('prepends fresh images so the newest sit at the front', () => {
    const merged = mergeImagePool(pool('a', 'b'), pool('c'))
    expect(urls(merged)).toEqual(['c', 'a', 'b'])
  })

  it('dedupes by image_url, only fresh ones move to the front', () => {
    const merged = mergeImagePool(pool('a', 'b'), pool('b', 'c'))
    expect(urls(merged)).toEqual(['c', 'a', 'b'])
  })

  it('keeps incoming batch order within the prepended block', () => {
    const merged = mergeImagePool(pool('a', 'b'), pool('c', 'd'))
    expect(urls(merged)).toEqual(['c', 'd', 'a', 'b'])
    expect(indices(merged)).toEqual(['1', '2', '3', '4'])
  })

  it('seeds an empty pool from the incoming batch', () => {
    expect(urls(mergeImagePool(null, pool('a', 'b')))).toEqual(['a', 'b'])
    expect(urls(mergeImagePool('', pool('a')))).toEqual(['a'])
  })

  it('ignores entries without an image_url and bad JSON', () => {
    const incoming = JSON.stringify({ images: [{ index: '1' }, img('a')] })
    expect(urls(mergeImagePool('not json', incoming))).toEqual(['a'])
  })

  it('is idempotent when the same batch arrives twice', () => {
    const first = mergeImagePool(pool('a'), pool('b'))
    const second = mergeImagePool(first, pool('b'))
    expect(second).toBe(first)
  })

  it('merges a single image url (COMFYTV_IMAGE) into the pool', () => {
    const merged = mergeImagePool(pool('a', 'b'), toImagePoolJson('/view?filename=c.png'))
    expect(urls(merged)).toEqual(['/view?filename=c.png', 'a', 'b'])
  })
})

describe('removeImageFromPool', () => {
  const img = (url: string) => ({ index: '1', image_url: url, label: url })
  const pool = (...urls: string[]) => JSON.stringify({ images: urls.map(img) })
  const urls = (json: string) =>
    (JSON.parse(json).images as Array<{ image_url: string }>).map(i => i.image_url)
  const indices = (json: string) =>
    (JSON.parse(json).images as Array<{ index: string }>).map(i => i.index)

  it('drops the matching image and re-indexes the survivors', () => {
    const next = removeImageFromPool(pool('a', 'b', 'c'), 'b')
    expect(urls(next)).toEqual(['a', 'c'])
    expect(indices(next)).toEqual(['1', '2'])
  })

  it('is a no-op when the url is not in the pool', () => {
    expect(urls(removeImageFromPool(pool('a', 'b'), 'z'))).toEqual(['a', 'b'])
  })

  it('yields an empty pool when the last image is removed', () => {
    expect(urls(removeImageFromPool(pool('a'), 'a'))).toEqual([])
  })

  it('tolerates empty / malformed pool json', () => {
    expect(urls(removeImageFromPool(null, 'a'))).toEqual([])
    expect(urls(removeImageFromPool('not json', 'a'))).toEqual([])
  })
})

describe('toImagePoolJson', () => {
  const parse = (json: string) => JSON.parse(json).images as Array<Record<string, any>>

  it('passes a batch through unchanged', () => {
    const batch = JSON.stringify({ images: [{ index: '1', image_url: 'a' }] })
    expect(toImagePoolJson(batch)).toBe(batch)
  })

  it('wraps a single image url as a one-item batch', () => {
    expect(parse(toImagePoolJson('/view?filename=a.png'))).toEqual([
      { index: '1', image_url: '/view?filename=a.png' },
    ])
  })

  it('returns an empty batch for nullish, blank, or non-batch JSON', () => {
    expect(parse(toImagePoolJson(null))).toEqual([])
    expect(parse(toImagePoolJson(''))).toEqual([])
    expect(parse(toImagePoolJson('   '))).toEqual([])
    expect(parse(toImagePoolJson('{}'))).toEqual([])
  })
})

describe('stageStore.setPickerPool', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('stores the pool, mirrors it onto the widget, and bumps the tick', () => {
    const store = useStageStore()
    const w = { name: 'pool', value: '' }
    const node = { widgets: [w] }
    const state = freshState()
    const before = store.stateTick
    store.setPickerPool(node, state, '{"images":[]}')
    expect(state.pool).toBe('{"images":[]}')
    expect(w.value).toBe('{"images":[]}')
    expect(store.stateTick).toBe(before + 1)
  })

  it('is a no-op when the pool is unchanged', () => {
    const store = useStageStore()
    const state = freshState({ pool: 'same' })
    const before = store.stateTick
    store.setPickerPool({}, state, 'same')
    expect(store.stateTick).toBe(before)
  })

  it('tolerates a node without a pool widget', () => {
    const store = useStageStore()
    const state = freshState()
    store.setPickerPool({ widgets: [] }, state, 'x')
    expect(state.pool).toBe('x')
  })
})

describe('stageStore.clearPickerPool', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('resets pool, pickedIndex, the selected_index widget, and slot 0', () => {
    const store = useStageStore()
    const poolW = { name: 'pool', value: 'stuff' }
    const idxW = { name: 'selected_index', value: 9 }
    const node = { widgets: [poolW, idxW] }
    const state = freshState({ pool: 'stuff', pickedIndex: 4, outputs: ['x'], output: 'x' })
    store.clearPickerPool(node, state)
    expect(state.pool).toBe('')
    expect(poolW.value).toBe('')
    expect(state.pickedIndex).toBe(1)
    expect(idxW.value).toBe(1)
    expect(state.outputs[0]).toBeNull()
    expect(state.output).toBeNull()
  })

  it('works without a selected_index widget', () => {
    const store = useStageStore()
    const state = freshState({ pickedIndex: 3 })
    store.clearPickerPool({ widgets: [] }, state)
    expect(state.pickedIndex).toBe(1)
  })
})

describe('stageStore.setOutputSlot', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('grows outputs, sets slot 0 mirror on output, and bumps the tick', () => {
    const store = useStageStore()
    const state = freshState({ outputs: [] })
    const before = store.stateTick
    store.setOutputSlot(state, 0, 'v0')
    expect(state.outputs[0]).toBe('v0')
    expect(state.output).toBe('v0')
    expect(store.stateTick).toBe(before + 1)
  })

  it('extends to a higher slot without touching output', () => {
    const store = useStageStore()
    const state = freshState()
    store.setOutputSlot(state, 2, 'v2')
    expect(state.outputs).toEqual([null, null, 'v2'])
    expect(state.output).toBeNull()
  })

  it('is a no-op when the value is unchanged', () => {
    const store = useStageStore()
    const state = freshState({ outputs: ['same'] })
    const before = store.stateTick
    store.setOutputSlot(state, 0, 'same')
    expect(store.stateTick).toBe(before)
  })
})

describe('imagePoolCount', () => {
  it('counts the images in a batch', () => {
    expect(imagePoolCount(JSON.stringify({ images: [{}, {}] }))).toBe(2)
  })

  it('returns 0 for nullish or blank input', () => {
    expect(imagePoolCount(null)).toBe(0)
    expect(imagePoolCount(undefined)).toBe(0)
    expect(imagePoolCount('')).toBe(0)
  })

  it('returns 0 when there is no images array', () => {
    expect(imagePoolCount('{}')).toBe(0)
  })

  it('returns 0 on malformed JSON', () => {
    expect(imagePoolCount('not json')).toBe(0)
  })
})

describe('computePickedFromBatch', () => {
  it('returns null for an empty batch', () => {
    expect(computePickedFromBatch(null, 1)).toBeNull()
    expect(computePickedFromBatch('', 1)).toBeNull()
  })

  it('returns null on malformed JSON', () => {
    expect(computePickedFromBatch('not json', 1)).toBeNull()
  })

  it('matches by explicit index', () => {
    const batch = JSON.stringify({ images: [{ index: '2', image_url: 'u2' }] })
    expect(computePickedFromBatch(batch, 2)).toBe('u2')
  })

  it('prefers the clips list when present', () => {
    const batch = JSON.stringify({
      images: [{ index: 1, image_url: 'frame1.png' }, { index: 2, image_url: 'frame2.png' }],
      clips: [{ index: 1, image_url: 'clip1.mp4' }, { index: 2, image_url: 'clip2.mp4' }],
    })
    expect(computePickedFromBatch(batch, 2)).toBe('clip2.mp4')
  })
})
