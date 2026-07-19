import { describe, it, expect, vi } from 'vitest'
import { reactive } from 'vue'
import type { ResolvedInput, StageState } from '@/stores/stageStore'
import { fxChainRowsFromInputs, parseFxSpec, useFxChain } from './useFxChain'

function specJson(label: string, domain: 'video' | 'audio' = 'video', kind = 'ComfyTV.GlowStage') {
  return JSON.stringify({ v: 1, kind, label, domain, specs: [['glow', { r: 2 }]] })
}

function fxInput(n: number, patch: Partial<ResolvedInput> = {}): ResolvedInput {
  return {
    slot: `fx_specs.fx_spec${n}`,
    type: 'COMFYTV_FXSPEC',
    source: 'upstream',
    content: specJson(`FX ${n}`),
    ...patch,
  }
}

function makeState(inputs: ResolvedInput[] = []): StageState {
  return reactive({
    kind: 'video',
    variant: 'generator',
    outputType: 'COMFYTV_VIDEO',
    output: null,
    outputs: [null],
    running: false,
    inputs,
    mainPrompt: '',
  }) as StageState
}

function makeNode(chainOrder = '') {
  return {
    id: 1,
    widgets: [{ name: 'chain_order', value: chainOrder, callback: vi.fn() }],
    onConfigure: null,
  } as any
}

function setup(chainOrder = '', inputs: ResolvedInput[] = []) {
  const node = makeNode(chainOrder)
  const state = makeState(inputs)
  const api = useFxChain(node, () => state)
  return { node, state, api }
}

describe('parseFxSpec', () => {
  it('parses kind, label, domain and spec count', () => {
    expect(parseFxSpec(specJson('Glow', 'audio'))).toEqual({
      kind: 'ComfyTV.GlowStage',
      label: 'Glow',
      domain: 'audio',
      specCount: 1,
    })
  })
  it('falls back to kind when label is missing', () => {
    const raw = JSON.stringify({ v: 1, kind: 'ComfyTV.OldFilmStage', domain: 'video', specs: [] })
    expect(parseFxSpec(raw)?.label).toBe('ComfyTV.OldFilmStage')
  })
  it('defaults unknown domains to video', () => {
    const raw = JSON.stringify({ v: 1, kind: 'X', label: 'X', domain: 'weird', specs: [] })
    expect(parseFxSpec(raw)?.domain).toBe('video')
  })
  it('returns null for empty, invalid JSON, or shapeless payloads', () => {
    expect(parseFxSpec(null)).toBeNull()
    expect(parseFxSpec('')).toBeNull()
    expect(parseFxSpec('oops')).toBeNull()
    expect(parseFxSpec('[1,2]')).toBeNull()
    expect(parseFxSpec('{}')).toBeNull()
  })
})

describe('fxChainRowsFromInputs', () => {
  it('keeps connected fx_spec slots with 1-based ordinals', () => {
    const rows = fxChainRowsFromInputs([
      { slot: 'video', type: 'COMFYTV_VIDEO', source: 'upstream', content: '/v.mp4' },
      fxInput(1),
      fxInput(2, { content: specJson('Echo', 'audio') }),
      fxInput(3, { source: 'empty', content: null }),
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ slot: 'fx_specs.fx_spec1', ordinal: 1, label: 'FX 1', domain: 'video', known: true })
    expect(rows[1]).toMatchObject({ ordinal: 2, label: 'Echo', domain: 'audio' })
  })
  it('marks pending or unparseable slots as unknown rows', () => {
    const rows = fxChainRowsFromInputs([
      fxInput(1, { source: 'upstream-pending', content: null }),
      fxInput(2, { content: 'not json' }),
    ])
    expect(rows.map(r => r.known)).toEqual([false, false])
    expect(rows.map(r => r.ordinal)).toEqual([1, 2])
  })
})

describe('useFxChain', () => {
  it('displays rows in natural order with an empty chain_order', () => {
    const { api } = setup('', [fxInput(1), fxInput(2)])
    expect(api.orderedRows.value.map(r => r.label)).toEqual(['FX 1', 'FX 2'])
    expect(api.orderedSummary.value).toBe('FX 1 → FX 2')
  })

  it('applies a saved chain_order to the display sequence', () => {
    const { api } = setup('[2,1]', [fxInput(1), fxInput(2)])
    expect(api.orderedRows.value.map(r => r.label)).toEqual(['FX 2', 'FX 1'])
  })

  it('normalizes stale and missing ordinals against the connected count', () => {
    const { api } = setup('[3,9,2]', [fxInput(1), fxInput(2), fxInput(3)])
    expect(api.order.value).toEqual([3, 2, 1])
  })

  it('onMoveUp writes the swapped order to the widget', () => {
    const { api, node } = setup('', [fxInput(1), fxInput(2), fxInput(3)])
    api.onMoveUp(1)
    expect(node.widgets[0].value).toBe('[2,1,3]')
    expect(api.orderedRows.value.map(r => r.ordinal)).toEqual([2, 1, 3])
  })

  it('onMoveDown writes the swapped order to the widget', () => {
    const { api, node } = setup('', [fxInput(1), fxInput(2)])
    api.onMoveDown(0)
    expect(node.widgets[0].value).toBe('[2,1]')
  })

  it('serializes back to "" when moves restore the natural order', () => {
    const { api, node } = setup('[2,1]', [fxInput(1), fxInput(2)])
    api.onMoveUp(1)
    expect(node.widgets[0].value).toBe('')
    expect(api.orderedRows.value.map(r => r.ordinal)).toEqual([1, 2])
  })

  it('ignores moves at the ends', () => {
    const { api, node } = setup('', [fxInput(1), fxInput(2)])
    api.onMoveUp(0)
    api.onMoveDown(1)
    expect(node.widgets[0].value).toBe('')
  })

  it('reflects input disconnects by dropping stale ordinals', () => {
    const { api, state } = setup('[3,1,2]', [fxInput(1), fxInput(2), fxInput(3)])
    expect(api.order.value).toEqual([3, 1, 2])
    state.inputs = [fxInput(1), fxInput(2)]
    expect(api.order.value).toEqual([1, 2])
  })

  it('uses ? in the summary for unknown rows', () => {
    const { api } = setup('', [fxInput(1), fxInput(2, { content: 'garbage' })])
    expect(api.orderedSummary.value).toBe('FX 1 → ?')
  })
})
