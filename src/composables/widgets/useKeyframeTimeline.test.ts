import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import {
  findNearIndex,
  formatT,
  keyLeftPercent,
  timeAtPixel,
  useKeyframeTimeline,
} from './useKeyframeTimeline'

describe('timeAtPixel', () => {
  const rect = { left: 100, width: 200 }

  it('maps a pixel position onto the duration, rounded to centiseconds', () => {
    expect(timeAtPixel(200, rect, 10)).toBe(5)
    expect(timeAtPixel(133, rect, 10)).toBe(1.65)
  })

  it('clamps outside the track to [0, duration]', () => {
    expect(timeAtPixel(0, rect, 10)).toBe(0)
    expect(timeAtPixel(1000, rect, 10)).toBe(10)
  })

  it('returns 0 for a zero or negative duration', () => {
    expect(timeAtPixel(200, rect, 0)).toBe(0)
    expect(timeAtPixel(200, rect, -5)).toBe(0)
  })
})

describe('findNearIndex', () => {
  const keys = [{ t: 2 }, { t: 5 }]

  it('finds a key within 2% of the duration', () => {
    expect(findNearIndex(keys, 2.1, 10)).toBe(0)
    expect(findNearIndex(keys, 4.9, 10)).toBe(1)
  })

  it('misses keys further than the threshold', () => {
    expect(findNearIndex(keys, 2.3, 10)).toBe(-1)
    expect(findNearIndex(keys, 8, 10)).toBe(-1)
  })

  it('never matches when duration is 0', () => {
    expect(findNearIndex(keys, 2, 0)).toBe(-1)
  })
})

describe('keyLeftPercent', () => {
  it('converts time to a track percentage', () => {
    expect(keyLeftPercent(2.5, 10)).toBe(25)
    expect(keyLeftPercent(10, 10)).toBe(100)
  })

  it('falls back to 0 without a duration', () => {
    expect(keyLeftPercent(3, 0)).toBe(0)
  })
})

describe('formatT', () => {
  it('formats seconds with two decimals', () => {
    expect(formatT(1.234)).toBe('1.23s')
    expect(formatT(0)).toBe('0.00s')
  })
})

function makeTrack(width = 100): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => ({
    left: 0, top: 0, width, height: 24,
    right: width, bottom: 24, x: 0, y: 0,
    toJSON: () => ({}),
  }) as DOMRect
  el.setPointerCapture = vi.fn()
  return el
}

function ptr(clientX: number): PointerEvent {
  return {
    clientX,
    pointerId: 1,
    stopPropagation: vi.fn(),
    currentTarget: { setPointerCapture: vi.fn() },
  } as unknown as PointerEvent
}

describe('useKeyframeTimeline', () => {
  function setup(keys = [{ t: 2 }, { t: 5 }], duration = 10) {
    const track = ref<HTMLElement | null>(makeTrack())
    const onAdd = vi.fn()
    const onMoveKey = vi.fn()
    const onSelect = vi.fn()
    const tl = useKeyframeTimeline({
      track,
      getKeys: () => keys,
      getDuration: () => duration,
      onAdd,
      onMoveKey,
      onSelect,
    })
    return { track, tl, onAdd, onMoveKey, onSelect }
  }

  it('adds a key when pressing empty track space', () => {
    const { tl, onAdd, onSelect } = setup()
    const e = ptr(80)
    tl.onTrackDown(e)
    expect(onAdd).toHaveBeenCalledWith(8)
    expect(onSelect).not.toHaveBeenCalled()
    expect(tl.dragIdx.value).toBe(-1)
    expect((e.currentTarget as HTMLElement).setPointerCapture).toHaveBeenCalledWith(1)
  })

  it('selects and starts dragging a nearby key instead of adding', () => {
    const { tl, onAdd, onSelect, onMoveKey } = setup()
    tl.onTrackDown(ptr(21))
    expect(onSelect).toHaveBeenCalledWith(0)
    expect(onAdd).not.toHaveBeenCalled()
    expect(tl.dragIdx.value).toBe(0)
    tl.onMove(ptr(60))
    expect(onMoveKey).toHaveBeenCalledWith(0, 6)
  })

  it('onKeyDown captures on the track and begins a drag', () => {
    const { track, tl, onSelect, onMoveKey } = setup()
    tl.onKeyDown(1, ptr(50))
    expect(track.value!.setPointerCapture).toHaveBeenCalledWith(1)
    expect(onSelect).toHaveBeenCalledWith(1)
    tl.onMove(ptr(90))
    expect(onMoveKey).toHaveBeenCalledWith(1, 9)
  })

  it('onUp ends the drag and later moves are ignored', () => {
    const { tl, onMoveKey } = setup()
    tl.onKeyDown(0, ptr(20))
    tl.onUp(ptr(20))
    expect(tl.dragIdx.value).toBe(-1)
    tl.onMove(ptr(70))
    expect(onMoveKey).not.toHaveBeenCalled()
  })

  it('moves without an active drag are no-ops', () => {
    const { tl, onMoveKey } = setup()
    const e = ptr(30)
    tl.onMove(e)
    expect(onMoveKey).not.toHaveBeenCalled()
    expect(e.stopPropagation).not.toHaveBeenCalled()
  })

  it('timeAt is 0 when the track element is missing', () => {
    const { track, tl } = setup()
    track.value = null
    expect(tl.timeAt(ptr(50))).toBe(0)
  })

  it('onKeyDown survives a missing track element', () => {
    const { track, tl, onSelect } = setup()
    track.value = null
    expect(() => tl.onKeyDown(0, ptr(10))).not.toThrow()
    expect(onSelect).toHaveBeenCalledWith(0)
  })
})
