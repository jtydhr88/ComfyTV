import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import { app } from '@/lib/comfyApp'
import type { ResolvedInput, StageState } from '@/stores/stageStore'

import {
  DEFAULT_COLORS,
  MIN_WH,
  SIZE_PRESETS,
  applyDrag,
  cursorFor,
  elementProp,
  layoutColor,
  mergedElements,
  newElementDef,
  nextElementId,
  parseLayout,
  usePosterStage,
  type PosterElement,
} from './usePosterStage'

const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function makeWidget(name: string, value: unknown) {
  return { name, value, callback: vi.fn() }
}

function makeNode(overrides: Partial<{
  layout: Record<string, unknown>
  template: string
  width: number
  height: number
  inputs: Array<{ name: string; link: number | null }>
}> = {}): any {
  return {
    id: 7,
    widgets: [
      makeWidget('layout', JSON.stringify(overrides.layout ?? {})),
      makeWidget('template', overrides.template ?? 'hero'),
      makeWidget('width', overrides.width ?? 1240),
      makeWidget('height', overrides.height ?? 1754),
    ],
    inputs: overrides.inputs ?? [],
    graph: { change: vi.fn() },
  }
}

function makeState(inputs: ResolvedInput[] = []): StageState {
  return reactive({
    kind: 'image',
    variant: 'poster',
    outputType: 'COMFYTV_IMAGE',
    output: null,
    outputs: [null],
    running: false,
    inputs,
    mainPrompt: '',
  }) as unknown as StageState
}

const baseLayout = {
  __added__: [
    { id: 'a', type: 'text', text: 'hi', x: 0.1, y: 0.1, w: 0.2, h: 0.1 },
    { id: 'b', type: 'image', slot: 1, x: 0.5, y: 0.5, w: 0.2, h: 0.2 },
  ],
}

function widgetValue(node: any, name: string): unknown {
  return node.widgets.find((w: any) => w.name === name)?.value
}

describe('parseLayout', () => {
  it('parses a valid object', () => {
    expect(parseLayout('{"a":{"x":1}}')).toEqual({ a: { x: 1 } })
  })

  it('returns empty object for empty string', () => {
    expect(parseLayout('')).toEqual({})
  })

  it('returns empty object for invalid json', () => {
    expect(parseLayout('{oops')).toEqual({})
  })

  it('returns empty object for non-object json', () => {
    expect(parseLayout('"str"')).toEqual({})
    expect(parseLayout('null')).toEqual({})
    expect(parseLayout('42')).toEqual({})
  })
})

describe('mergedElements', () => {
  const tdefs: PosterElement[] = [
    { id: 't1', type: 'text' },
    { id: 't2', type: 'image' },
  ]

  it('combines template defs with added elements', () => {
    const out = mergedElements(tdefs, { __added__: [{ id: 'u1', type: 'shape' }] })
    expect(out.map(e => e.id)).toEqual(['t1', 't2', 'u1'])
  })

  it('filters removed template defs', () => {
    const out = mergedElements(tdefs, { __removed__: ['t1'] })
    expect(out.map(e => e.id)).toEqual(['t2'])
  })

  it('ignores non-array added and removed', () => {
    const out = mergedElements(tdefs, { __added__: 'x', __removed__: 5 })
    expect(out.map(e => e.id)).toEqual(['t1', 't2'])
  })
})

describe('layoutColor', () => {
  it('returns override when valid hex', () => {
    expect(layoutColor({ __colors__: { bg_color: '#112233' } }, 'bg_color')).toBe('#112233')
  })

  it('falls back to default for invalid values', () => {
    expect(layoutColor({ __colors__: { bg_color: 'red' } }, 'bg_color'))
      .toBe(DEFAULT_COLORS.bg_color)
    expect(layoutColor({}, 'accent_color')).toBe(DEFAULT_COLORS.accent_color)
  })
})

describe('elementProp', () => {
  const el: PosterElement = { id: 'a', type: 'text', font_size: 24 }

  it('prefers layout override', () => {
    expect(elementProp(el, { a: { font_size: 48 } }, 'font_size', 12)).toBe(48)
  })

  it('falls back to element value then default', () => {
    expect(elementProp(el, {}, 'font_size', 12)).toBe(24)
    expect(elementProp(el, {}, 'align', 'left')).toBe('left')
  })
})

describe('newElementDef', () => {
  it('creates image with slot', () => {
    expect(newElementDef('image', 'i1')).toMatchObject({ id: 'i1', type: 'image', slot: 0 })
  })

  it('creates shape with stroke defaults', () => {
    expect(newElementDef('shape', 's1')).toMatchObject({
      id: 's1', type: 'shape', shape: 'rect', h: 0.1, stroke: 'accent', stroke_width: 3,
    })
  })

  it('creates text by default', () => {
    expect(newElementDef('text', 't1')).toMatchObject({
      id: 't1', type: 'text', font: 'body', font_size: 36, align: 'left',
    })
  })
})

describe('applyDrag', () => {
  const start = { x: 0.2, y: 0.2, w: 0.3, h: 0.2 }

  it('moves with clamping to bounds', () => {
    const m = applyDrag('move', start, 0.1, -0.05)
    expect(m.x).toBeCloseTo(0.3)
    expect(m.y).toBeCloseTo(0.15)
    expect(m.w).toBe(0.3)
    expect(m.h).toBe(0.2)
    expect(applyDrag('move', start, 9, 9)).toEqual({ x: 0.7, y: 0.8, w: 0.3, h: 0.2 })
    expect(applyDrag('move', start, -9, -9)).toEqual({ x: 0, y: 0, w: 0.3, h: 0.2 })
  })

  it('resizes from south-east', () => {
    const r = applyDrag('se', start, 0.1, 0.1)
    expect(r.w).toBeCloseTo(0.4)
    expect(r.h).toBeCloseTo(0.3)
    expect(r.x).toBe(0.2)
  })

  it('resizes from north-west keeping opposite edges', () => {
    const r = applyDrag('nw', start, 0.1, 0.05)
    expect(r.x).toBeCloseTo(0.3)
    expect(r.w).toBeCloseTo(0.2)
    expect(r.y).toBeCloseTo(0.25)
    expect(r.h).toBeCloseTo(0.15)
    expect(r.x + r.w).toBeCloseTo(start.x + start.w)
  })

  it('enforces minimum size', () => {
    const r = applyDrag('se', start, -9, -9)
    expect(r.w).toBeCloseTo(MIN_WH)
    expect(r.h).toBeCloseTo(MIN_WH)
  })
})

describe('cursorFor', () => {
  it('maps modes to cursors', () => {
    expect(cursorFor(null)).toBe('default')
    expect(cursorFor({ mode: 'move' })).toBe('move')
    expect(cursorFor({ mode: 'n' })).toBe('ns-resize')
    expect(cursorFor({ mode: 'e' })).toBe('ew-resize')
    expect(cursorFor({ mode: 'ne' })).toBe('nesw-resize')
    expect(cursorFor({ mode: 'se' })).toBe('nwse-resize')
  })
})

describe('nextElementId', () => {
  it('generates unique prefixed ids', () => {
    const a = nextElementId()
    const b = nextElementId()
    expect(a).toMatch(/^u/)
    expect(a).not.toBe(b)
  })
})

describe('usePosterStage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchApi.mockImplementation(async () => jsonResponse([]))
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    fetchApi.mockReset()
    fetchApi.mockImplementation(async () =>
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }))
  })

  function setup(nodeOverrides: Parameters<typeof makeNode>[0] = {}, inputs: ResolvedInput[] = []) {
    const node = makeNode({ layout: baseLayout, ...nodeOverrides })
    const state = makeState(inputs)
    const poster = usePosterStage(node, () => state)
    return { node, state, poster }
  }

  it('initializes layout from the widget', () => {
    const { poster } = setup()
    expect(poster.elements.value.map(e => e.id)).toEqual(['a', 'b'])
    expect(poster.hasElements.value).toBe(true)
    expect(poster.activeElement.value).toBeNull()
  })

  it('selectOnly and toggleSelect manage selection', () => {
    const { poster } = setup()
    poster.selectOnly(0)
    expect(poster.selectedIds.value).toEqual(['a'])
    expect(poster.activeIdx.value).toBe(0)
    poster.toggleSelect(1)
    expect(poster.selectedIds.value).toEqual(['a', 'b'])
    expect(poster.activeIdx.value).toBe(1)
    poster.toggleSelect(0)
    expect(poster.selectedIds.value).toEqual(['b'])
    poster.toggleSelect(5)
    expect(poster.selectedIds.value).toEqual(['b'])
    poster.selectOnly(9)
    expect(poster.selectedIds.value).toEqual([])
    expect(poster.activeIdx.value).toBe(-1)
  })

  it('clearSelection resets state', () => {
    const { poster } = setup()
    poster.selectOnly(1)
    poster.clearSelection()
    expect(poster.selectedIds.value).toEqual([])
    expect(poster.activeIdx.value).toBe(-1)
  })

  it('selectRegion picks intersecting elements', () => {
    const { poster } = setup()
    poster.selectRegion({ x: 0, y: 0, w: 0.35, h: 0.35 })
    expect(poster.selectedIds.value).toEqual(['a'])
    poster.selectRegion({ x: 0, y: 0, w: 1, h: 1 })
    expect(poster.selectedIds.value).toEqual(['a', 'b'])
    poster.selectRegion({ x: 0.9, y: 0.9, w: 0.05, h: 0.05 })
    expect(poster.selectedIds.value).toEqual([])
  })

  it('reads template and clamped poster size', () => {
    const { poster } = setup({ template: 'grid', width: 10, height: 2000.7 })
    expect(poster.template()).toBe('grid')
    expect(poster.posterWidth()).toBe(64)
    expect(poster.posterHeight()).toBe(2000)
  })

  it('falls back to first template name when widget missing', () => {
    const node = makeNode({ layout: baseLayout })
    node.widgets = node.widgets.filter((w: any) => w.name !== 'template')
    const poster = usePosterStage(node, () => makeState())
    expect(poster.template()).toBe('hero')
    poster.templates.value = [{ name: 'grid', label: 'Grid', description: '' }]
    expect(poster.template()).toBe('grid')
  })

  it('resolves upstream image urls in slot order', () => {
    const inputs = [
      { slot: 'images.image1', type: 'COMFYTV_IMAGE', source: 'upstream', content: '/b.png' },
      { slot: 'images.image0', type: 'COMFYTV_IMAGE', source: 'upstream', content: 'http://cdn.test/a.png' },
      { slot: 'images.image2', type: 'COMFYTV_IMAGE', source: 'empty', content: null },
      { slot: 'other', type: 'COMFYTV_IMAGE', source: 'upstream', content: '/no.png' },
      { slot: 'images.image3', type: 'COMFYTV_IMAGE', source: 'upstream', content: 'http://' },
    ] as ResolvedInput[]
    const { poster } = setup({}, inputs)
    expect(poster.upstreamImageUrls()).toEqual([
      'http://cdn.test/a.png',
      new URL('/b.png', window.location.origin).href,
      'http://',
    ])
  })

  it('commitLayout writes the widget and marks graph changed', () => {
    const { node, poster } = setup()
    poster.setRect('a', { x: 0.4 })
    poster.commitLayout()
    expect(JSON.parse(String(widgetValue(node, 'layout'))).a).toEqual({ x: 0.4 })
    expect(node.graph.change).toHaveBeenCalled()
  })

  it('effRect merges layout overrides over element defaults', () => {
    const { poster } = setup()
    expect(poster.effRect(poster.elements.value[0]!)).toEqual({ x: 0.1, y: 0.1, w: 0.2, h: 0.1 })
    poster.setRect('a', { x: 0.3, w: 0.5 })
    expect(poster.effRect(poster.elements.value[0]!)).toEqual({ x: 0.3, y: 0.1, w: 0.5, h: 0.1 })
  })

  it('setColor and getColor round-trip with defaults', () => {
    const { node, poster } = setup()
    expect(poster.getColor('primary_color')).toBe(DEFAULT_COLORS.primary_color)
    poster.setColor('primary_color', '#abcdef')
    expect(poster.getColor('primary_color')).toBe('#abcdef')
    expect(JSON.parse(String(widgetValue(node, 'layout'))).__colors__.primary_color).toBe('#abcdef')
  })

  it('elementRot reads rotation override', () => {
    const { poster } = setup()
    expect(poster.elementRot(poster.elements.value[0]!)).toBe(0)
    poster.setRect('a', { rot: 45 })
    expect(poster.elementRot(poster.elements.value[0]!)).toBe(45)
  })

  it('guides computed filters invalid entries', () => {
    const { poster } = setup()
    expect(poster.guides.value).toEqual([])
    poster.layout.value.__guides__ = [
      { axis: 'x', pos: 0.5 },
      { axis: 'z', pos: 0.5 },
      { axis: 'y', pos: 2 },
      { axis: 'y', pos: 0.1 },
      null,
      'junk',
    ]
    expect(poster.guides.value).toEqual([{ axis: 'x', pos: 0.5 }, { axis: 'y', pos: 0.1 }])
  })

  it('addGuide, setGuidePos and removeGuide manage guide list', () => {
    const { poster } = setup()
    poster.addGuide('x')
    poster.addGuide('y')
    expect(poster.guides.value).toEqual([{ axis: 'x', pos: 0.5 }, { axis: 'y', pos: 0.5 }])
    poster.setGuidePos(0, 1.7)
    expect(poster.guides.value[0]).toEqual({ axis: 'x', pos: 1 })
    poster.setGuidePos(9, 0.3)
    poster.removeGuide(0)
    expect(poster.guides.value).toEqual([{ axis: 'y', pos: 0.5 }])
    poster.layout.value.__guides__ = 'junk'
    poster.setGuidePos(0, 0.5)
    poster.removeGuide(0)
    expect(poster.layout.value.__guides__).toBe('junk')
  })

  it('toggleGrid flips grid flag', () => {
    const { poster } = setup()
    expect(poster.gridOn.value).toBe(false)
    poster.toggleGrid()
    expect(poster.gridOn.value).toBe(true)
    poster.toggleGrid()
    expect(poster.gridOn.value).toBe(false)
  })

  it('setFont and getFont round-trip', () => {
    const { poster } = setup()
    expect(poster.getFont('font_title')).toBe('')
    poster.setFont('font_title', 'Alibaba')
    expect(poster.getFont('font_title')).toBe('Alibaba')
    expect(poster.getFont('font_body')).toBe('')
  })

  it('collectParams gathers widget values and images', () => {
    const inputs = [
      { slot: 'images.image0', type: 'COMFYTV_IMAGE', source: 'upstream', content: 'http://x/a.png' },
    ] as ResolvedInput[]
    const { poster } = setup({ template: 'grid', width: 800, height: 600 }, inputs)
    expect(poster.collectParams()).toEqual({
      template: 'grid',
      width: 800,
      height: 600,
      layout: JSON.stringify(poster.layout.value),
      images: ['http://x/a.png'],
    })
  })

  it('doRefresh stores preview html and bumps tick', async () => {
    const { poster } = setup()
    fetchApi.mockResolvedValueOnce(new Response('<div>ok</div>', { status: 200 }))
    await poster.doRefresh()
    expect(poster.previewHtml.value).toBe('<div>ok</div>')
    expect(poster.previewError.value).toBe('')
    expect(poster.refreshTick.value).toBe(1)
    expect(fetchApi).toHaveBeenCalledWith('/comfytv/poster/html', expect.objectContaining({ method: 'POST' }))
  })

  it('doRefresh records errors from failed responses', async () => {
    const { poster } = setup()
    fetchApi.mockResolvedValueOnce(new Response('x', { status: 500, statusText: 'Boom' }))
    await poster.doRefresh()
    expect(poster.previewError.value).toBe('500 Boom')
    expect(poster.refreshTick.value).toBe(0)
  })

  it('doRefresh queues a pending refresh while inflight', async () => {
    const { poster } = setup()
    let release: (r: Response) => void
    fetchApi.mockImplementationOnce(() => new Promise<Response>(res => { release = res }))
    const first = poster.doRefresh()
    const second = poster.doRefresh()
    release!(new Response('late', { status: 200 }))
    await first
    await second
    expect(fetchApi).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(40)
    expect(fetchApi).toHaveBeenCalledTimes(2)
  })

  it('scheduleRefresh debounces refreshes', async () => {
    const { poster } = setup()
    poster.scheduleRefresh(100)
    poster.scheduleRefresh(100)
    poster.scheduleRefresh(100)
    await vi.advanceTimersByTimeAsync(100)
    expect(fetchApi).toHaveBeenCalledTimes(1)
  })

  it('fetchElements populates template defs and clears selection', async () => {
    const { poster } = setup()
    poster.selectOnly(0)
    fetchApi.mockResolvedValueOnce(jsonResponse([{ id: 't1', type: 'text' }]))
    await poster.fetchElements()
    expect(poster.templateDefs.value).toEqual([{ id: 't1', type: 'text' }])
    expect(poster.selectedIds.value).toEqual([])
    expect(poster.elements.value.map(e => e.id)).toEqual(['t1', 'a', 'b'])
  })

  it('fetchElements falls back to empty on failure', async () => {
    const { poster } = setup()
    poster.templateDefs.value = [{ id: 'old', type: 'text' }]
    fetchApi.mockRejectedValueOnce(new Error('net'))
    await poster.fetchElements()
    expect(poster.templateDefs.value).toEqual([])
  })

  it('fetchTemplates populates list and tolerates failure', async () => {
    const { poster } = setup()
    fetchApi.mockResolvedValueOnce(jsonResponse([{ name: 'hero', label: 'Hero', description: '' }]))
    await poster.fetchTemplates()
    expect(poster.templates.value).toEqual([{ name: 'hero', label: 'Hero', description: '' }])
    fetchApi.mockRejectedValueOnce(new Error('net'))
    await poster.fetchTemplates()
    expect(poster.templates.value).toEqual([])
  })

  it('setTemplate writes widget and refetches elements', () => {
    const { node, poster } = setup()
    poster.setTemplate('grid')
    expect(widgetValue(node, 'template')).toBe('grid')
    expect(node.graph.change).toHaveBeenCalled()
    expect(fetchApi).toHaveBeenCalledWith('/comfytv/poster/elements', expect.objectContaining({ method: 'POST' }))
  })

  it('applySizePreset writes matching dimensions', () => {
    const { node, poster } = setup()
    const p = SIZE_PRESETS[4]!
    poster.applySizePreset(p.label)
    expect(widgetValue(node, 'width')).toBe(p.w)
    expect(widgetValue(node, 'height')).toBe(p.h)
    node.graph.change.mockClear()
    poster.applySizePreset('nope')
    expect(node.graph.change).not.toHaveBeenCalled()
  })

  it('setPosterSize clamps and defaults invalid values', () => {
    const { node, poster } = setup()
    poster.setPosterSize(100, 9000)
    expect(widgetValue(node, 'width')).toBe(256)
    expect(widgetValue(node, 'height')).toBe(4096)
    poster.setPosterSize(NaN, NaN)
    expect(widgetValue(node, 'width')).toBe(1240)
    expect(widgetValue(node, 'height')).toBe(1754)
  })

  it('addElement appends and selects the new element', () => {
    const { poster } = setup()
    poster.addElement('shape')
    expect(poster.elements.value).toHaveLength(3)
    const added = poster.elements.value[2]!
    expect(added.type).toBe('shape')
    expect(poster.editMode.value).toBe(true)
    expect(poster.selectedIds.value).toEqual([added.id])
    expect(poster.activeIdx.value).toBe(2)
  })

  it('deleteActive removes added elements entirely', () => {
    const { poster } = setup()
    poster.setRect('a', { x: 0.4 })
    poster.imgEditId.value = 'a'
    poster.selectOnly(0)
    poster.deleteActive()
    expect(poster.elements.value.map(e => e.id)).toEqual(['b'])
    expect(poster.layout.value.a).toBeUndefined()
    expect(poster.layout.value.__removed__).toBeUndefined()
    expect(poster.imgEditId.value).toBeNull()
    expect(poster.selectedIds.value).toEqual([])
  })

  it('deleteActive marks template elements as removed', () => {
    const { poster } = setup()
    poster.templateDefs.value = [{ id: 't1', type: 'text' }]
    poster.selectOnly(0)
    poster.deleteActive()
    expect(poster.layout.value.__removed__).toEqual(['t1'])
    expect(poster.elements.value.map(e => e.id)).toEqual(['a', 'b'])
  })

  it('deleteActive is a no-op without selection', () => {
    const { node, poster } = setup()
    poster.deleteActive()
    expect(node.graph.change).not.toHaveBeenCalled()
  })

  it('elementImageProps reads overrides with defaults', () => {
    const { poster } = setup()
    const el = poster.elements.value[1]!
    expect(poster.elementImageProps(el)).toEqual({ scale: 1, x: 0, y: 0 })
    poster.setRect('b', { img_scale: 2, img_x: 0.2, img_y: -0.1 })
    expect(poster.elementImageProps(el)).toEqual({ scale: 2, x: 0.2, y: -0.1 })
  })

  it('drag lifecycle moves an element and commits on end', () => {
    const { node, poster } = setup()
    poster.startDrag({ idx: 0, mode: 'move' }, 0.1, 0.1)
    expect(poster.selectedIds.value).toEqual(['a'])
    expect(poster.drag.startRect).toEqual({ x: 0.1, y: 0.1, w: 0.2, h: 0.1 })
    const out = poster.moveDrag(0.3, 0.15, true, 0.02, 0.02)
    expect(out).toHaveLength(1)
    expect(out[0]!.id).toBe('a')
    expect(out[0]!.rect.x).toBeCloseTo(0.3)
    expect(out[0]!.rect.y).toBeCloseTo(0.15)
    expect(poster.layout.value.a.x).toBeCloseTo(0.3)
    node.graph.change.mockClear()
    expect(poster.endDrag()).toBe(true)
    expect(node.graph.change).toHaveBeenCalled()
    expect(poster.drag.mode).toBeNull()
  })

  it('moveDrag snaps to neighbouring edges and reports guides', () => {
    const { poster } = setup()
    poster.startDrag({ idx: 0, mode: 'move' }, 0.1, 0.1)
    const out = poster.moveDrag(0.495, 0.1, false, 0.02, 0.02)
    expect(out[0]!.rect.x).toBeCloseTo(0.5)
    expect(poster.snapGuides.value.length).toBeGreaterThan(0)
  })

  it('moveDrag snaps to user guides and grid lines', () => {
    const { poster } = setup()
    poster.addGuide('x')
    poster.addGuide('y')
    poster.setGuidePos(1, 0.305)
    poster.toggleGrid()
    poster.startDrag({ idx: 0, mode: 'move' }, 0.1, 0.1)
    const out = poster.moveDrag(0.1, 0.297, false, 0.02, 0.01)
    expect(out[0]!.rect.y).toBeCloseTo(0.305)
  })

  it('moveDrag skips snapping for rotated elements', () => {
    const { poster } = setup({ layout: { ...baseLayout, a: { rot: 30 } } })
    poster.startDrag({ idx: 0, mode: 'move' }, 0.1, 0.1)
    expect(poster.drag.rotated).toBe(true)
    const out = poster.moveDrag(0.495, 0.1, false, 0.02, 0.02)
    expect(out[0]!.rect.x).toBeCloseTo(0.495)
    expect(poster.snapGuides.value).toEqual([])
  })

  it('moveDrag returns empty without an active drag', () => {
    const { poster } = setup()
    expect(poster.moveDrag(0.5, 0.5, false, 0.02, 0.02)).toEqual([])
  })

  it('group drag moves all selected elements together', () => {
    const { poster } = setup()
    poster.snap.value = false
    poster.selectOnly(0)
    poster.toggleSelect(1)
    poster.startDrag({ idx: 0, mode: 'move' }, 0.2, 0.2)
    expect(poster.drag.groupBases).toHaveLength(2)
    expect(poster.drag.startRect).toEqual({ x: 0.1, y: 0.1, w: 0.6, h: 0.6 })
    const out = poster.moveDrag(0.25, 0.25, false, 0.02, 0.02)
    expect(out).toHaveLength(2)
    expect(out[0]!.rect.x).toBeCloseTo(0.15)
    expect(out[1]!.rect.x).toBeCloseTo(0.55)
    expect(poster.layout.value.b.y).toBeCloseTo(0.55)
  })

  it('resize drag adjusts width and height', () => {
    const { poster } = setup()
    poster.snap.value = false
    poster.startDrag({ idx: 0, mode: 'se' }, 0.3, 0.2)
    const out = poster.moveDrag(0.4, 0.3, false, 0.02, 0.02)
    expect(out[0]!.rect.w).toBeCloseTo(0.3)
    expect(out[0]!.rect.h).toBeCloseTo(0.2)
  })

  it('endDrag without movement does not commit', () => {
    const { node, poster } = setup()
    poster.startDrag({ idx: 0, mode: 'move' }, 0.1, 0.1)
    node.graph.change.mockClear()
    expect(poster.endDrag()).toBe(false)
    expect(node.graph.change).not.toHaveBeenCalled()
  })

  it('startDrag ignores unknown indices', () => {
    const { poster } = setup()
    poster.startDrag({ idx: 9, mode: 'move' }, 0.1, 0.1)
    expect(poster.drag.mode).toBeNull()
  })

  it('applyArrange aligns selected rects', () => {
    const { node, poster } = setup()
    poster.selectOnly(0)
    poster.toggleSelect(1)
    poster.applyArrange('left')
    expect(poster.effRect(poster.elements.value[1]!).x).toBeCloseTo(0.1)
    expect(node.graph.change).toHaveBeenCalled()
  })

  it('applyArrange requires at least two elements', () => {
    const { node, poster } = setup()
    poster.selectOnly(0)
    poster.applyArrange('left')
    expect(node.graph.change).not.toHaveBeenCalled()
  })

  it('image pan drag clamps offsets by scale', () => {
    const { node, poster } = setup()
    const el = poster.elements.value[1]!
    poster.setRect('b', { img_scale: 2 })
    poster.startImgDrag(el, 100, 100, 0, 0)
    poster.moveImgDrag(20, -200)
    expect(poster.layout.value.b.img_x).toBeCloseTo(0.2)
    expect(poster.layout.value.b.img_y).toBeCloseTo(-0.5)
    node.graph.change.mockClear()
    poster.endImgDrag()
    expect(poster.imgDrag.id).toBeNull()
    expect(node.graph.change).toHaveBeenCalled()
    poster.endImgDrag()
    poster.moveImgDrag(5, 5)
    expect(node.graph.change).toHaveBeenCalledTimes(1)
  })

  it('setImgScale clamps scale and re-clamps offsets', () => {
    const { poster } = setup()
    const el = poster.elements.value[1]!
    poster.setRect('b', { img_scale: 2, img_x: 0.5, img_y: -0.5 })
    poster.setImgScale(el, 1.5)
    expect(poster.layout.value.b).toMatchObject({ img_scale: 1.5, img_x: 0.25, img_y: -0.25 })
    poster.setImgScale(el, 10)
    expect(poster.layout.value.b.img_scale).toBe(4)
    poster.setImgScale(el, 0)
    expect(poster.layout.value.b.img_scale).toBe(1)
    expect(poster.layout.value.b.img_x).toBeCloseTo(0)
    expect(poster.layout.value.b.img_y).toBeCloseTo(0)
  })

  it('setElementProp writes to the active element with fit resets', () => {
    const { poster } = setup()
    poster.setElementProp('text', 'ignored')
    expect(poster.layout.value.a).toBeUndefined()
    poster.selectOnly(0)
    poster.setElementProp('text', 'hello')
    expect(poster.layout.value.a).toEqual({ text: 'hello' })
    poster.setElementProp('font_size', 48)
    expect(poster.layout.value.a).toMatchObject({ font_size: 48, fit: false })
    poster.setElementProp('align', 'center')
    expect(poster.layout.value.a).toMatchObject({ align: 'center', fit: false, columns: 1 })
  })

  it('connectedImages counts linked autogrow inputs', () => {
    const { poster } = setup({
      inputs: [
        { name: 'images.image0', link: 1 },
        { name: 'images.image1', link: null },
        { name: 'images.image2', link: 3 },
        { name: 'other', link: 4 },
      ],
    })
    expect(poster.connectedImages()).toBe(3)
  })

  it('slotOf and setSlot manage image slots', () => {
    const { poster } = setup()
    const el = poster.elements.value[1]!
    expect(poster.slotOf(el)).toBe(1)
    poster.setSlot(el, 3)
    expect(poster.slotOf(el)).toBe(3)
    expect(poster.layout.value.b.slot).toBe(3)
  })

  it('gridLabels and setGridLabelLine manage label lines', () => {
    const { poster } = setup()
    expect(poster.gridLabels()).toBe('')
    poster.setGridLabelLine(2, 'multi\nline')
    expect(poster.gridLabels()).toBe('\n\nmulti line')
    poster.setGridLabelLine(0, 'first')
    expect(poster.gridLabels()).toBe('first\n\nmulti line')
    expect(fetchApi).toHaveBeenCalledWith('/comfytv/poster/elements', expect.anything())
  })

  it('reloadFromWidget re-reads the layout widget', () => {
    const { node, poster } = setup()
    node.widgets.find((w: any) => w.name === 'layout')!.value = JSON.stringify({ fresh: { x: 0.9 } })
    poster.reloadFromWidget()
    expect(poster.layout.value).toEqual({ fresh: { x: 0.9 } })
  })

  it('refreshes preview when stage inputs change', async () => {
    const inputs = [
      { slot: 'images.image0', type: 'COMFYTV_IMAGE', source: 'empty', content: null },
    ] as ResolvedInput[]
    const { state } = setup({}, inputs)
    const target = state.inputs[0] as { content: string | null; source: string }
    target.content = '/new.png'
    target.source = 'upstream'
    await nextTick()
    await vi.advanceTimersByTimeAsync(120)
    expect(fetchApi).toHaveBeenCalledWith('/comfytv/poster/html', expect.anything())
  })
})
