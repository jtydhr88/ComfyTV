import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { Part, PartBox, PartPoint } from '@/widgets/splitpart/types'

import {
  boxFromDrag,
  clientToNatural,
  contentPlacement,
  naturalToDisplay,
  usePartAnnotation,
} from './usePartAnnotation'

describe('contentPlacement', () => {
  it('returns null without natural dimensions', () => {
    expect(contentPlacement(300, 200, 0, 100)).toBeNull()
    expect(contentPlacement(300, 200, 100, 0)).toBeNull()
  })

  it('returns zero scale for a collapsed container', () => {
    expect(contentPlacement(0, 200, 100, 100)).toEqual({ left: 0, top: 0, scale: 0 })
  })

  it('letterboxes a wide image vertically', () => {
    const c = contentPlacement(200, 200, 400, 200)
    expect(c).toEqual({ left: 0, top: 50, scale: 0.5 })
  })

  it('pillarboxes a tall image horizontally', () => {
    const c = contentPlacement(200, 200, 100, 200)
    expect(c).toEqual({ left: 50, top: 0, scale: 1 })
  })
})

describe('clientToNatural', () => {
  const rect = { left: 10, top: 20, width: 200 }
  const placement = { left: 0, top: 50, scale: 0.5 }

  it('maps a client point into natural coordinates', () => {
    expect(clientToNatural(110, 120, rect, 200, placement, 400, 200))
      .toEqual({ x: 200, y: 100 })
  })

  it('compensates for canvas zoom via rect/client width ratio', () => {
    const zoomedRect = { left: 10, top: 20, width: 400 }
    expect(clientToNatural(210, 220, zoomedRect, 200, placement, 400, 200))
      .toEqual({ x: 200, y: 100 })
  })

  it('returns null outside the image', () => {
    expect(clientToNatural(9, 120, rect, 200, placement, 400, 200)).toBeNull()
    expect(clientToNatural(110, 20, rect, 200, placement, 400, 200)).toBeNull()
  })

  it('returns null for degenerate geometry', () => {
    expect(clientToNatural(50, 50, { left: 0, top: 0, width: 0 }, 200, placement, 400, 200)).toBeNull()
    expect(clientToNatural(50, 50, rect, 200, { left: 0, top: 0, scale: 0 }, 400, 200)).toBeNull()
    expect(clientToNatural(50, 50, rect, 0, placement, 400, 200)).toBeNull()
  })
})

describe('naturalToDisplay / boxFromDrag', () => {
  it('projects natural coordinates back to display space', () => {
    expect(naturalToDisplay(200, 100, { left: 0, top: 50, scale: 0.5 }))
      .toEqual({ x: 100, y: 100 })
  })

  it('normalizes a drag into a positive box', () => {
    expect(boxFromDrag({ x: 30, y: 40 }, { x: 10, y: 20 }))
      .toEqual({ x: 10, y: 20, w: 20, h: 20 })
  })
})

function makeContainer(cw = 200, ch = 200, rectW = 200) {
  const el = document.createElement('div')
  Object.defineProperty(el, 'clientWidth', { value: cw, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: ch, configurable: true })
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: rectW, height: ch, right: rectW, bottom: ch, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  return el as HTMLDivElement
}

function makeImage(nw = 200, nh = 200) {
  const el = document.createElement('img')
  Object.defineProperty(el, 'naturalWidth', { value: nw, configurable: true })
  Object.defineProperty(el, 'naturalHeight', { value: nh, configurable: true })
  return el as HTMLImageElement
}

function ptrEvent(x: number, y: number, button = 0) {
  return {
    clientX: x,
    clientY: y,
    button,
    pointerId: 1,
    currentTarget: { setPointerCapture: vi.fn() },
  } as unknown as PointerEvent
}

function setup(overrides: {
  tool?: string
  parts?: Part[]
  activePartId?: number | null
} = {}) {
  const containerEl = ref<HTMLDivElement | null>(makeContainer())
  const imageEl = ref<HTMLImageElement | null>(makeImage())
  const added: PartPoint[] = []
  const boxes: PartBox[] = []
  const tool = ref(overrides.tool ?? 'point-pos')
  const api = usePartAnnotation({
    containerEl,
    imageEl,
    parts: () => overrides.parts ?? [],
    activePartId: () => overrides.activePartId ?? null,
    tool: () => tool.value,
    onAddPoint: (p) => added.push(p),
    onAddBox: (b) => boxes.push(b),
  })
  api.onImageLoad()
  return { api, added, boxes, tool, containerEl, imageEl }
}

describe('usePartAnnotation gestures', () => {
  it('reads natural size from the image element on load', () => {
    const { api } = setup()
    expect(api.naturalW.value).toBe(200)
    expect(api.naturalH.value).toBe(200)
  })

  it('emits a positive point on click without drag', () => {
    const { api, added } = setup()
    api.onPointerDown(ptrEvent(50, 60))
    api.onPointerUp(ptrEvent(51, 60))
    expect(added).toEqual([{ x: 50, y: 60, label: 1 }])
  })

  it('emits a negative point with the point-neg tool', () => {
    const { api, added } = setup({ tool: 'point-neg' })
    api.onPointerDown(ptrEvent(50, 60))
    api.onPointerUp(ptrEvent(50, 60))
    expect(added[0].label).toBe(0)
  })

  it('emits a negative point on right click regardless of tool', () => {
    const { api, added } = setup()
    api.onPointerDown(ptrEvent(50, 60, 2))
    api.onPointerUp(ptrEvent(50, 60, 2))
    expect(added[0].label).toBe(0)
  })

  it('ignores non-primary buttons', () => {
    const { api, added } = setup()
    api.onPointerDown(ptrEvent(50, 60, 1))
    api.onPointerUp(ptrEvent(50, 60, 1))
    expect(added).toHaveLength(0)
  })

  it('ignores clicks outside the image content', () => {
    const containerEl = ref<HTMLDivElement | null>(makeContainer(200, 200))
    const imageEl = ref<HTMLImageElement | null>(makeImage(400, 200))
    const added: PartPoint[] = []
    const api = usePartAnnotation({
      containerEl,
      imageEl,
      parts: () => [],
      activePartId: () => null,
      tool: () => 'point-pos',
      onAddPoint: (p) => added.push(p),
      onAddBox: () => {},
    })
    api.onImageLoad()
    api.onPointerDown(ptrEvent(100, 10))
    api.onPointerUp(ptrEvent(100, 10))
    expect(added).toHaveLength(0)
  })

  it('shows a draft box while dragging with the box tool', () => {
    const { api } = setup({ tool: 'box' })
    api.onPointerDown(ptrEvent(20, 30))
    expect(api.draftBox.value).toBeNull()
    api.onPointerMove(ptrEvent(80, 90))
    expect(api.draftBox.value).toEqual({ x: 20, y: 30, w: 60, h: 60 })
  })

  it('keeps the draft box hidden under the drag threshold', () => {
    const { api } = setup({ tool: 'box' })
    api.onPointerDown(ptrEvent(20, 30))
    api.onPointerMove(ptrEvent(22, 32))
    expect(api.draftBox.value).toBeNull()
  })

  it('emits a box on drag release and clears the draft', () => {
    const { api, boxes } = setup({ tool: 'box' })
    api.onPointerDown(ptrEvent(20, 30))
    api.onPointerMove(ptrEvent(80, 90))
    api.onPointerUp(ptrEvent(80, 90))
    expect(boxes).toEqual([{ x: 20, y: 30, w: 60, h: 60 }])
    expect(api.draftBox.value).toBeNull()
  })

  it('drops boxes smaller than the minimum size', () => {
    const { api, boxes, added } = setup({ tool: 'box' })
    api.onPointerDown(ptrEvent(20, 30))
    api.onPointerUp(ptrEvent(28, 32))
    expect(boxes).toHaveLength(0)
    expect(added).toHaveLength(0)
  })

  it('treats a moved release with a point tool as no-op', () => {
    const { api, added } = setup()
    api.onPointerDown(ptrEvent(20, 30))
    api.onPointerUp(ptrEvent(80, 90))
    expect(added).toHaveLength(0)
  })

  it('ignores pointer up without a prior down', () => {
    const { api, added, boxes } = setup()
    api.onPointerUp(ptrEvent(80, 90))
    expect(added).toHaveLength(0)
    expect(boxes).toHaveLength(0)
  })
})

describe('usePartAnnotation overlays', () => {
  const parts: Part[] = [
    { id: 1, kind: 'box', box: { x: 10, y: 20, w: 40, h: 60 } },
    { id: 2, kind: 'points', points: [{ x: 100, y: 100, label: 1 }, { x: 50, y: 50, label: 0 }] },
  ]

  it('projects box parts into display rects with active flag', () => {
    const { api } = setup({ parts, activePartId: 1 })
    expect(api.boxOverlays.value).toEqual([
      expect.objectContaining({ id: 1, x: 10, y: 20, w: 40, h: 60, active: true }),
    ])
  })

  it('projects point parts with stable keys and labels', () => {
    const { api } = setup({ parts, activePartId: 1 })
    const pts = api.pointOverlays.value
    expect(pts).toHaveLength(2)
    expect(pts[0]).toEqual(expect.objectContaining({ key: '2-0', x: 100, y: 100, label: 1, active: false }))
    expect(pts[1]).toEqual(expect.objectContaining({ key: '2-1', x: 50, y: 50, label: 0 }))
  })

  it('returns empty overlays before the image loads', () => {
    const containerEl = ref<HTMLDivElement | null>(makeContainer())
    const imageEl = ref<HTMLImageElement | null>(null)
    const api = usePartAnnotation({
      containerEl,
      imageEl,
      parts: () => parts,
      activePartId: () => null,
      tool: () => 'point-pos',
      onAddPoint: () => {},
      onAddBox: () => {},
    })
    expect(api.boxOverlays.value).toEqual([])
    expect(api.pointOverlays.value).toEqual([])
  })
})
