import { describe, it, expect, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useClipReorder } from './useClipReorder'
import type { VideoClip } from './videoClipInputs'

function makeWidget(name: string, value: unknown = '') {
  return { name, value, callback: vi.fn() }
}

function makeNode(clipOrder = '') {
  return { id: 1, widgets: [makeWidget('clip_order', clipOrder)], onConfigure: null as any } as any
}

function clip(n: number): VideoClip {
  return { key: `video${n}`, url: `/v${n}.mp4`, color: '#fff' }
}

function makeStrip(tileWidths: number[], stripWidth = 402): HTMLDivElement {
  const strip = document.createElement('div')
  strip.getBoundingClientRect = () => ({
    left: 0, top: 0, width: stripWidth, height: 80,
    right: stripWidth, bottom: 80, x: 0, y: 0, toJSON: () => ({}),
  }) as DOMRect
  for (const w of tileWidths) {
    const tile = document.createElement('div')
    Object.defineProperty(tile, 'offsetWidth', { value: w, configurable: true })
    tile.getBoundingClientRect = () => ({
      left: 0, top: 0, width: w, height: 72,
      right: w, bottom: 72, x: 0, y: 0, toJSON: () => ({}),
    }) as DOMRect
    strip.appendChild(tile)
  }
  return strip
}

function pointerEvt(clientX: number, clientY = 0, tile?: HTMLElement): PointerEvent {
  return {
    clientX,
    clientY,
    pointerId: 1,
    currentTarget: tile ?? {
      getBoundingClientRect: () => ({ left: 10, top: 20, width: 128, height: 72 }),
      setPointerCapture: vi.fn(),
    },
  } as unknown as PointerEvent
}

function setup(clipOrder = '', clipList: VideoClip[] = []) {
  const node = makeNode(clipOrder)
  const clips = ref<VideoClip[]>(clipList)
  const stripEl = ref<HTMLDivElement | null>(null)
  const api = useClipReorder(node, { clips, stripEl })
  return { node, clips, stripEl, api }
}

describe('useClipReorder — order sync', () => {
  it('seeds order from connected clips', () => {
    const { api } = setup('', [clip(0), clip(1)])
    expect(api.order.value).toEqual(['video0', 'video1'])
  })

  it('respects the saved widget order', () => {
    const { api } = setup('["video1","video0"]', [clip(0), clip(1)])
    expect(api.order.value).toEqual(['video1', 'video0'])
    expect(api.orderedClips.value.map(c => c.key)).toEqual(['video1', 'video0'])
  })

  it('reconciles when clips connect or disconnect', async () => {
    const { api, clips, node } = setup('["video1","video0"]', [clip(0), clip(1)])
    clips.value = [clip(0), clip(2)]
    await nextTick()
    expect(api.order.value).toEqual(['video0', 'video2'])
    expect(node.widgets[0].value).toBe('["video0","video2"]')
  })

  it('applies an external widget callback', () => {
    const { api, node } = setup('', [clip(0), clip(1)])
    node.widgets[0].callback('["video1","video0"]')
    expect(api.order.value).toEqual(['video1', 'video0'])
  })

  it('restores order on node configure', () => {
    const { api, node } = setup('', [clip(0), clip(1)])
    node.widgets[0].value = '["video1","video0"]'
    node.onConfigure({})
    expect(api.order.value).toEqual(['video1', 'video0'])
  })

  it('orderedClips drops keys with no matching clip', () => {
    const { api } = setup('["video9","video0"]', [clip(0)])
    expect(api.orderedClips.value.map(c => c.key)).toEqual(['video0'])
  })
})

describe('useClipReorder — drag interaction', () => {
  it('onTileDown captures the pointer and sizes the clone', () => {
    const { api } = setup('', [clip(0), clip(1)])
    const capture = vi.fn()
    const tile = {
      getBoundingClientRect: () => ({ left: 10, top: 20, width: 130, height: 74 }),
      setPointerCapture: capture,
    } as unknown as HTMLElement
    api.onTileDown(pointerEvt(30, 40, tile), 0)
    expect(api.dragKey.value).toBe('video0')
    expect(api.dragClip.value?.key).toBe('video0')
    expect(api.cloneW.value).toBe(130)
    expect(api.cloneH.value).toBe(74)
    expect(api.cloneX.value).toBe(10)
    expect(api.cloneY.value).toBe(20)
    expect(capture).toHaveBeenCalledWith(1)
  })

  it('onTileDown ignores an out-of-range index', () => {
    const { api } = setup('', [clip(0)])
    api.onTileDown(pointerEvt(0), 5)
    expect(api.dragKey.value).toBeNull()
  })

  it('onTileMove is inert without an active drag', () => {
    const { api } = setup('', [clip(0), clip(1)])
    api.onTileMove(pointerEvt(300))
    expect(api.order.value).toEqual(['video0', 'video1'])
  })

  it('onTileMove reorders toward the hovered tile and moves the clone', () => {
    const { api, stripEl } = setup('', [clip(0), clip(1), clip(2)])
    stripEl.value = makeStrip([128, 128, 128])
    api.onTileDown(pointerEvt(30, 40), 0)
    api.onTileMove(pointerEvt(300, 50))
    expect(api.order.value).toEqual(['video1', 'video2', 'video0'])
    expect(api.cloneX.value).toBe(300 - 20)
    expect(api.cloneY.value).toBe(50 - 20)
    expect(api.dragTargetIdx.value).toBe(2)
  })

  it('onTileMove keeps order when hovering the current slot', () => {
    const { api, stripEl } = setup('', [clip(0), clip(1)])
    stripEl.value = makeStrip([128, 128])
    api.onTileDown(pointerEvt(30), 0)
    api.onTileMove(pointerEvt(60))
    expect(api.order.value).toEqual(['video0', 'video1'])
  })

  it('tileTargetIndex clamps to the tile range and handles a missing strip', () => {
    const { api, stripEl } = setup('', [clip(0), clip(1)])
    expect(api.tileTargetIndex(500)).toBe(0)
    stripEl.value = makeStrip([128, 128])
    expect(api.tileTargetIndex(-50)).toBe(0)
    expect(api.tileTargetIndex(5000)).toBe(1)
  })

  it('tileTargetIndex accounts for canvas zoom via the rect/offset scale', () => {
    const { api, stripEl } = setup('', [clip(0), clip(1)])
    const strip = makeStrip([128, 128])
    const first = strip.firstElementChild as HTMLElement
    first.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 64, height: 36,
      right: 64, bottom: 36, x: 0, y: 0, toJSON: () => ({}),
    }) as DOMRect
    stripEl.value = strip
    expect(api.tileTargetIndex(100)).toBe(1)
  })

  it('onTileUp ends the drag', () => {
    const { api } = setup('', [clip(0)])
    api.onTileDown(pointerEvt(0), 0)
    api.onTileUp()
    expect(api.dragKey.value).toBeNull()
    expect(api.dragClip.value).toBeNull()
  })
})
