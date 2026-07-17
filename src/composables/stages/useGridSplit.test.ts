import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import type { ResolvedInput, StageState } from '@/stores/stageStore'
import { useStageStore } from '@/stores/stageStore'

import { displayedImageRect, dividerBands, dividerCenters, useGridSplit } from './useGridSplit'

vi.mock('@/utils/uploadCanvas', () => ({
  uploadCanvas: vi.fn(async () => 'https://x/out.png'),
}))
import { uploadCanvas } from '@/utils/uploadCanvas'

let imageCtorCount = 0

class FakeImage {
  onload: (() => void) | null = null
  onerror: ((e?: unknown) => void) | null = null
  crossOrigin = ''
  naturalWidth = 100
  naturalHeight = 100
  complete = false
  private _src = ''
  constructor() { imageCtorCount++ }
  get src() { return this._src }
  set src(v: string) {
    this._src = v
    queueMicrotask(() => {
      if (v.includes('fail')) {
        this.onerror?.(new Error('img load failed'))
      } else {
        this.complete = true
        this.onload?.()
      }
    })
  }
}
;(globalThis as any).Image = FakeImage as any

HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as any

function makeWidget(name: string, value: any = 0) {
  return { name, value, callback: vi.fn() }
}

function makeNode(widgets: any[] = []): any {
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

  it('setBorder rounds, coerces non-finite to 0 and clamps at 0', () => {
    const node = makeNode([makeWidget('border', 0)])
    const { border, setBorder } = useGridSplit(node, makeState('/u'))
    setBorder(3.7)
    expect(border.value).toBe(4)
    setBorder(-5)
    expect(border.value).toBe(0)
    setBorder(Number.NaN)
    expect(border.value).toBe(0)
  })

  it('setOuterBorder coerces to boolean', () => {
    const node = makeNode([makeWidget('outer_border', false)])
    const { outerBorder, setOuterBorder } = useGridSplit(node, makeState('/u'))
    setOuterBorder(true)
    expect(outerBorder.value).toBe(true)
    setOuterBorder(0 as unknown as boolean)
    expect(outerBorder.value).toBe(false)
  })

  it('external border/cols widget callbacks keep refs in sync', () => {
    const wCols = makeWidget('cols', 2)
    const wBorder = makeWidget('border', 0)
    const node = makeNode([makeWidget('rows', 2), wCols, wBorder])
    const { cols, border } = useGridSplit(node, makeState('/u'))
    wCols.callback?.(3)
    expect(cols.value).toBe(3)
    wBorder.callback?.(9)
    expect(border.value).toBe(9)
    wBorder.callback?.(-2)
    expect(border.value).toBe(0)
  })

  it('external outer_border widget callback flips the ref', () => {
    const wOuter = makeWidget('outer_border', false)
    const node = makeNode([makeWidget('rows', 2), makeWidget('cols', 2), wOuter])
    const { outerBorder } = useGridSplit(node, makeState('/u'))
    wOuter.callback?.(true)
    expect(outerBorder.value).toBe(true)
    wOuter.callback?.(0)
    expect(outerBorder.value).toBe(false)
  })

  it('onConfigure re-reads border + outer_border on workflow reload', () => {
    const wBorder = makeWidget('border', 0)
    const wOuter = makeWidget('outer_border', false)
    const node = makeNode([makeWidget('rows', 2), makeWidget('cols', 2), wBorder, wOuter])
    const { border, outerBorder } = useGridSplit(node, makeState('/u'))
    wBorder.value = 7
    wOuter.value = true
    node.onConfigure?.({})
    expect(border.value).toBe(7)
    expect(outerBorder.value).toBe(true)
  })
})

describe('useGridSplit — async run()/schedule()', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    imageCtorCount = 0
    ;(uploadCanvas as any).mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounced schedule splits an upstream image into R*C cells', async () => {
    const store = useStageStore()
    const spy = vi.spyOn(store, 'applyExecutedPayload')
    const node = makeNode([makeWidget('rows', 2), makeWidget('cols', 3)])
    const state = makeState('/img.png')

    useGridSplit(node, state)

    await vi.advanceTimersByTimeAsync(300)

    expect(spy).toHaveBeenCalledTimes(1)
    const [, msg] = spy.mock.calls[0]
    const parsed = JSON.parse((msg as any).output[0])
    expect(parsed.images).toHaveLength(6)
    expect(parsed.images[0].label).toBe('R1C1')
    expect(parsed.images[5].label).toBe('R2C3')
    expect(parsed.images.map((i: any) => i.index)).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(uploadCanvas).toHaveBeenCalledTimes(6)
  })

  it('debounces rapid changes into a single run and toggles splitting', async () => {
    const store = useStageStore()
    const spy = vi.spyOn(store, 'applyExecutedPayload')
    const node = makeNode([makeWidget('rows', 2), makeWidget('cols', 2)])
    const { setGrid, splitting } = useGridSplit(node, makeState('/img.png'))

    setGrid(3, 3)
    setGrid(2, 2)
    await nextTick()

    await vi.advanceTimersByTimeAsync(300)

    expect(splitting.value).toBe(false)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(JSON.parse((spy.mock.calls[0][1] as any).output[0]).images).toHaveLength(4)
  })

  it('caches the decoded source image across runs (same url)', async () => {
    const node = makeNode([makeWidget('rows', 2), makeWidget('cols', 2)])
    const { setBorder } = useGridSplit(node, makeState('/same.png'))

    await vi.advanceTimersByTimeAsync(300)
    expect(imageCtorCount).toBe(1)

    setBorder(1)
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)

    expect(imageCtorCount).toBe(1)
  })

  it('does nothing when there is no upstream image', async () => {
    const store = useStageStore()
    const spy = vi.spyOn(store, 'applyExecutedPayload')
    const node = makeNode([makeWidget('rows', 2), makeWidget('cols', 2)])
    useGridSplit(node, makeState(null))

    await vi.advanceTimersByTimeAsync(300)

    expect(spy).not.toHaveBeenCalled()
    expect(imageCtorCount).toBe(0)
  })

  it('bails out when a cell would be smaller than 1px', async () => {
    const store = useStageStore()
    const spy = vi.spyOn(store, 'applyExecutedPayload')
    const node = makeNode([makeWidget('rows', 10), makeWidget('cols', 10), makeWidget('border', 50)])
    useGridSplit(node, makeState('/img.png'))

    await vi.advanceTimersByTimeAsync(300)

    expect(spy).not.toHaveBeenCalled()
    expect(uploadCanvas).not.toHaveBeenCalled()
  })

  it('swallows a source-image load error via the catch branch', async () => {
    const store = useStageStore()
    const spy = vi.spyOn(store, 'applyExecutedPayload')
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const node = makeNode([makeWidget('rows', 2), makeWidget('cols', 2)])
    const { splitting } = useGridSplit(node, makeState('/fail.png'))

    await vi.advanceTimersByTimeAsync(300)

    expect(spy).not.toHaveBeenCalled()
    expect(errSpy).toHaveBeenCalled()
    expect(splitting.value).toBe(false)
    errSpy.mockRestore()
  })

  it('throws + is caught when the 2d context is unavailable', async () => {
    const store = useStageStore()
    const spy = vi.spyOn(store, 'applyExecutedPayload')
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const getCtx = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as any
    try {
      const node = makeNode([makeWidget('rows', 2), makeWidget('cols', 2)])
      useGridSplit(node, makeState('/img.png'))
      await vi.advanceTimersByTimeAsync(300)
      expect(spy).not.toHaveBeenCalled()
      expect(errSpy).toHaveBeenCalled()
    } finally {
      HTMLCanvasElement.prototype.getContext = getCtx
      errSpy.mockRestore()
    }
  })
})

describe('displayedImageRect', () => {
  it('returns null for degenerate inputs', () => {
    expect(displayedImageRect(0, 100, 200, 200)).toBeNull()
    expect(displayedImageRect(100, 0, 200, 200)).toBeNull()
    expect(displayedImageRect(100, 100, 0, 200)).toBeNull()
    expect(displayedImageRect(100, 100, 200, 0)).toBeNull()
  })

  it('letterboxes a wide image', () => {
    expect(displayedImageRect(400, 200, 200, 200))
      .toEqual({ w: 200, h: 100, ox: 0, oy: 50, scale: 0.5 })
  })

  it('pillarboxes a tall image', () => {
    expect(displayedImageRect(100, 200, 200, 200))
      .toEqual({ w: 100, h: 200, ox: 50, oy: 0, scale: 1 })
  })
})

describe('dividerCenters', () => {
  it('places inner dividers between equal cells without border', () => {
    expect(dividerCenters(2, 100, 0, false)).toEqual([50])
    expect(dividerCenters(4, 100, 0, false)).toEqual([25, 50, 75])
  })

  it('accounts for border thickness between cells', () => {
    expect(dividerCenters(2, 100, 10, false)).toEqual([50])
    expect(dividerCenters(3, 96, 3, false)).toEqual([31.5, 64.5])
  })

  it('adds outer divider centers when outer border is on', () => {
    const centers = dividerCenters(2, 100, 10, true)
    expect(centers[0]).toBe(5)
    expect(centers[centers.length - 1]).toBe(95)
    expect(centers).toHaveLength(3)
  })

  it('skips outer centers when the border is zero', () => {
    expect(dividerCenters(2, 100, 0, true)).toEqual([50])
  })
})

describe('dividerBands', () => {
  const d = { w: 200, h: 100, ox: 0, oy: 50, scale: 0.5 }

  it('builds vertical band styles spanning the displayed height', () => {
    const bands = dividerBands('v', d, 400, 2, 8, false)
    expect(bands).toEqual([
      { left: '98px', top: '50px', width: '4px', height: '100px' },
    ])
  })

  it('builds horizontal band styles spanning the displayed width', () => {
    const bands = dividerBands('h', d, 200, 2, 8, false)
    expect(bands).toEqual([
      { left: '0px', top: '98px', width: '200px', height: '4px' },
    ])
  })

  it('enforces the minimum visible line thickness', () => {
    const bands = dividerBands('v', d, 400, 2, 0, false)
    expect(bands[0].width).toBe('2px')
  })

  it('clamps negative borders to zero', () => {
    const bands = dividerBands('v', d, 400, 2, -10, false)
    expect(bands).toHaveLength(1)
    expect(bands[0].width).toBe('2px')
  })
})
