import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

vi.mock('@/composables/stages/stageActions', () => ({
  ACTIONS_BY_KIND: {
    'image-batch': [
      { id: 'plain' },
      { id: 'withpresets', presets: [{ id: 'p1' }, { id: 'p2' }] },
    ],
  },
}))

import { formatSlot, parsePoolCount, progressPercentOf, useStageCard } from './useStageCard'

const PLAIN = { id: 'plain' } as any
const WITH_PRESETS = { id: 'withpresets', presets: [{ id: 'p1' }, { id: 'p2' }] } as any

function state(over: Record<string, unknown> = {}) {
  return {
    kind: 'image-batch',
    inputs: [],
    pool: null,
    mainPrompt: '',
    preparingWorkflow: false,
    progress: null,
    ...over,
  } as any
}

describe('formatSlot', () => {
  it('formats namespaced indexed slots, passes others through', () => {
    expect(formatSlot('images.image0')).toBe('image #0')
    expect(formatSlot('texts.text12')).toBe('text #12')
    expect(formatSlot('plain')).toBe('plain')
    expect(formatSlot('a.bare')).toBe('bare')
  })
})

describe('parsePoolCount', () => {
  it('counts images, tolerates bad input', () => {
    expect(parsePoolCount(JSON.stringify({ images: [1, 2, 3] }))).toBe(3)
    expect(parsePoolCount('{bad')).toBe(0)
    expect(parsePoolCount(null)).toBe(0)
    expect(parsePoolCount('{"images":5}')).toBe(0)
  })
})

describe('progressPercentOf', () => {
  it('clamps 0..100, 0 when no max', () => {
    expect(progressPercentOf({ value: 1, max: 4 })).toBe(25)
    expect(progressPercentOf({ value: 9, max: 4 })).toBe(100)
    expect(progressPercentOf(null)).toBe(0)
    expect(progressPercentOf({ value: 1, max: 0 })).toBe(0)
  })
})

describe('useStageCard — action/preset menu', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exposes the actions for the stage kind', () => {
    const c = useStageCard(() => state(), vi.fn())
    expect(c.stageActions.value.map((a: any) => a.id)).toEqual(['plain', 'withpresets'])
  })

  it('a preset-less action fires onAction immediately', () => {
    const onAction = vi.fn()
    const c = useStageCard(() => state(), onAction)
    c.onActionClick(PLAIN)
    expect(onAction).toHaveBeenCalledWith('plain')
    expect(c.openActionId.value).toBeNull()
  })

  it('a preset action toggles the open menu instead of firing', () => {
    const onAction = vi.fn()
    const c = useStageCard(() => state(), onAction)
    c.onActionClick(WITH_PRESETS)
    expect(onAction).not.toHaveBeenCalled()
    expect(c.openActionId.value).toBe('withpresets')
    expect(c.openPresets.value.map((p: any) => p.id)).toEqual(['p1', 'p2'])
    c.onActionClick(WITH_PRESETS)
    expect(c.openActionId.value).toBeNull()
  })

  it('picking a preset fires the composed action id and closes the menu', () => {
    const onAction = vi.fn()
    const c = useStageCard(() => state(), onAction)
    c.onActionClick(WITH_PRESETS)
    c.onPresetClick({ id: 'p2' } as any)
    expect(onAction).toHaveBeenCalledWith('withpresets:p2')
    expect(c.openActionId.value).toBeNull()
  })

  it('onPresetClick is a no-op when no menu is open', () => {
    const onAction = vi.fn()
    const c = useStageCard(() => state(), onAction)
    c.onPresetClick({ id: 'p1' } as any)
    expect(onAction).not.toHaveBeenCalled()
  })
})

describe('useStageCard — run gating + inputs', () => {
  it('canRun: false only while preparing, otherwise true even without a prompt', () => {
    expect(useStageCard(() => state({ preparingWorkflow: true, mainPrompt: 'x' }), vi.fn()).canRun.value).toBe(false)
    expect(useStageCard(() => state({ mainPrompt: '  hi ' }), vi.fn()).canRun.value).toBe(true)
    expect(useStageCard(() => state({ mainPrompt: '   ' }), vi.fn()).canRun.value).toBe(true)
    expect(useStageCard(() => state({ inputs: [{ slot: 'x', source: 'upstream' }] }), vi.fn()).canRun.value).toBe(true)
  })

  it('connectedInputs keeps only upstream / upstream-pending', () => {
    const c = useStageCard(() => state({ inputs: [
      { slot: 'a', source: 'upstream' },
      { slot: 'b', source: 'empty' },
      { slot: 'c', source: 'upstream-pending' },
    ] }), vi.fn())
    expect(c.connectedInputs.value.map((i: any) => i.slot)).toEqual(['a', 'c'])
  })

  it('pool derives from state.pool then the batch input; count parses images', () => {
    const c = useStageCard(() => state({
      pool: JSON.stringify({ images: [1, 2] }),
      inputs: [{ slot: 'batch', source: 'upstream', content: 'ignored' }],
    }), vi.fn())
    expect(c.poolCount.value).toBe(2)
    expect(c.pickerSource.value).toBe('upstream')
  })

  it('upstreamBatchUrls lists the urls of the live upstream batch', () => {
    const batch = JSON.stringify({ images: [
      { index: '1', image_url: '/a.png' },
      { index: '2', image_url: '/b.png' },
    ] })
    const c = useStageCard(() => state({
      inputs: [{ slot: 'batch', source: 'upstream', content: batch }],
    }), vi.fn())
    expect(c.upstreamBatchUrls.value).toEqual(['/a.png', '/b.png'])
  })

  it('upstreamBatchUrls handles a single upstream image url', () => {
    const c = useStageCard(() => state({
      inputs: [{ slot: 'batch', source: 'upstream', content: '/single.png' }],
    }), vi.fn())
    expect(c.upstreamBatchUrls.value).toEqual(['/single.png'])
  })

  it('upstreamBatchUrls is empty when nothing is connected upstream', () => {
    const c = useStageCard(() => state({
      inputs: [{ slot: 'batch', source: 'empty', content: null }],
    }), vi.fn())
    expect(c.upstreamBatchUrls.value).toEqual([])
  })

  it('confirmingClear resets when the pool empties', async () => {
    const st = ref(state({ pool: JSON.stringify({ images: [1] }) }))
    const c = useStageCard(() => st.value, vi.fn())
    c.confirmingClear.value = true
    st.value = state({ pool: JSON.stringify({ images: [] }) })
    await nextTick()
    expect(c.confirmingClear.value).toBe(false)
  })
})
