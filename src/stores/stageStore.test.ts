import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

import { useStageStore, computePickedImageUrl, type StageState } from './stageStore'

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

describe('stageStore.applyExecutedPayload', () => {
  beforeEach(() => setActivePinia(createPinia()))

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

  it('returns null on bad JSON', () => {
    expect(computePickedImageUrl(makeState('not json'))).toBeNull()
  })

  it('returns null when no batch slot', () => {
    const state = freshState({ inputs: [] })
    expect(computePickedImageUrl(state)).toBeNull()
  })

  it('handles missing images array', () => {
    expect(computePickedImageUrl(makeState('{}'))).toBeNull()
  })
})
