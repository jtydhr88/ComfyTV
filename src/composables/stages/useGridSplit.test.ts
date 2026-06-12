import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import type { ResolvedInput, StageState } from '@/stores/stageStore'

import { useGridSplit } from './useGridSplit'

function makeWidget(name: string, value: any = 0) {
  return { name, value, callback: vi.fn() }
}

function makeNode(widgets: any[] = []) {
  return { id: 7, widgets, onConfigure: null as any }
}

function makeState(image: string | null): StageState {
  const inputs: ResolvedInput[] = image == null
    ? [{ slot: 'image', type: 'COMFYTV_IMAGE', source: 'empty', content: null }]
    : [{ slot: 'image', type: 'COMFYTV_IMAGE', source: 'upstream', content: image }]
  return reactive({
    kind: 'image', variant: 'transform',
    outputType: 'COMFYTV_IMAGES',
    output: null, outputs: [null],
    running: false, inputs, mainPrompt: '',
  }) as StageState
}

describe('useGridSplit — state + widget bridging', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('seeds rows/cols from widget values', () => {
    const node = makeNode([makeWidget('rows', 3), makeWidget('cols', 4)])
    const { rows, cols } = useGridSplit(node, makeState('/u'))
    expect(rows.value).toBe(3)
    expect(cols.value).toBe(4)
  })

  it('falls back to 2x2 when widgets are missing', () => {
    const node = makeNode([])
    const { rows, cols } = useGridSplit(node, makeState('/u'))
    expect(rows.value).toBe(2)
    expect(cols.value).toBe(2)
  })

  it('falls back to 2x2 when widget values are NaN', () => {
    const node = makeNode([makeWidget('rows', 'not-a-number'), makeWidget('cols', NaN)])
    const { rows, cols } = useGridSplit(node, makeState('/u'))
    expect(rows.value).toBe(2)
    expect(cols.value).toBe(2)
  })

  it('setGrid clamps to [1, 10]', () => {
    const node = makeNode([makeWidget('rows', 2), makeWidget('cols', 2)])
    const { rows, cols, setGrid } = useGridSplit(node, makeState('/u'))
    setGrid(0, 99)
    expect(rows.value).toBe(1)
    expect(cols.value).toBe(10)
    setGrid(-5, 100)
    expect(rows.value).toBe(1)
    expect(cols.value).toBe(10)
  })

  it('changing rows/cols writes through to the corresponding widgets', async () => {
    const wRows = makeWidget('rows', 2)
    const wCols = makeWidget('cols', 2)
    const node = makeNode([wRows, wCols])
    const { setGrid } = useGridSplit(node, makeState('/u'))
    setGrid(4, 5)
    await nextTick()
    expect(wRows.value).toBe(4)
    expect(wCols.value).toBe(5)
  })

  it('sourceImageUrl follows the upstream image slot; null when absent', () => {
    const w = useGridSplit(makeNode(), makeState('/foo'))
    expect(w.sourceImageUrl.value).toBe('/foo')
    const w2 = useGridSplit(makeNode(), makeState(null))
    expect(w2.sourceImageUrl.value).toBeNull()
  })

  it('external widget callback fires keep the composable refs in sync', () => {
    const wRows = makeWidget('rows', 2)
    const node = makeNode([wRows, makeWidget('cols', 2)])
    const { rows } = useGridSplit(node, makeState('/u'))
    wRows.value = 6
    wRows.callback?.(6)
    expect(rows.value).toBe(6)
  })

  it('onConfigure re-reads widget values into rows/cols (workflow reload)', () => {
    const wRows = makeWidget('rows', 2)
    const wCols = makeWidget('cols', 2)
    const node = makeNode([wRows, wCols])
    useGridSplit(node, makeState('/u'))
    wRows.value = 5
    wCols.value = 3
    node.onConfigure?.({})
    expect(wRows.value).toBe(5)
    expect(wCols.value).toBe(3)
  })

  it('splitting flag starts false', () => {
    const { splitting } = useGridSplit(makeNode(), makeState('/u'))
    expect(splitting.value).toBe(false)
  })
})
