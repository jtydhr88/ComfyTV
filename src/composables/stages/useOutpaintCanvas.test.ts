import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'

import type { ResolvedInput, StageState } from '@/stores/stageStore'

import { useOutpaintCanvas } from './useOutpaintCanvas'

function makeWidget(name: string, value: any = 0) {
  return { name, value, callback: vi.fn() }
}

function makeNode(widgets: any[] = []) {
  return { widgets, onConfigure: null as any }
}

function makeState(image: string | null): StageState {
  const inputs: ResolvedInput[] = image == null
    ? [{ slot: 'image', type: 'COMFYTV_IMAGE', source: 'empty', content: null }]
    : [{ slot: 'image', type: 'COMFYTV_IMAGE', source: 'upstream', content: image }]
  return reactive({
    kind: 'image', variant: 'generator',
    outputType: 'COMFYTV_IMAGE',
    output: null, outputs: [null],
    running: false, inputs, mainPrompt: '',
  }) as StageState
}

describe('useOutpaintCanvas', () => {
  const _roCallbacks: Array<() => void> = []
  beforeEach(() => {
    _roCallbacks.length = 0
    class RO {
      constructor(cb: () => void) { _roCallbacks.push(cb) }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(globalThis as any).ResizeObserver = RO as any
  })

  it('seeds pad from widget values on construction', () => {
    const node = makeNode([
      makeWidget('pad_left',   10),
      makeWidget('pad_top',    20),
      makeWidget('pad_right',  30),
      makeWidget('pad_bottom', 40),
    ])
    const { pad } = useOutpaintCanvas(node, makeState('/u/img'), ref(null), ref(null))
    expect(pad.value).toEqual({ left: 10, top: 20, right: 30, bottom: 40 })
  })

  it('sourceImageUrl follows the upstream image input', () => {
    const { sourceImageUrl } = useOutpaintCanvas(
      makeNode([]), makeState('/u/img'),
      ref(null), ref(null),
    )
    expect(sourceImageUrl.value).toBe('/u/img')
  })

  it('sourceImageUrl is null when no upstream is wired', () => {
    const { sourceImageUrl } = useOutpaintCanvas(
      makeNode([]), makeState(null),
      ref(null), ref(null),
    )
    expect(sourceImageUrl.value).toBeNull()
  })

  it('setPad clamps to [0, 4096] and rounds', () => {
    const wL = makeWidget('pad_left', 0)
    const node = makeNode([wL,
      makeWidget('pad_top', 0), makeWidget('pad_right', 0), makeWidget('pad_bottom', 0),
    ])
    const { pad, setPad } = useOutpaintCanvas(node, makeState('/u'), ref(null), ref(null))
    setPad('left', -5)
    expect(pad.value.left).toBe(0)
    setPad('left', 9999)
    expect(pad.value.left).toBe(4096)
    setPad('left', 12.7)
    expect(pad.value.left).toBe(13)
  })

  it('changing pad writes through to the corresponding widget', async () => {
    const wL = makeWidget('pad_left', 0)
    const node = makeNode([
      wL, makeWidget('pad_top', 0), makeWidget('pad_right', 0), makeWidget('pad_bottom', 0),
    ])
    const { setPad } = useOutpaintCanvas(node, makeState('/u'), ref(null), ref(null))
    setPad('left', 64)
    await nextTick()
    expect(wL.value).toBe(64)
    expect(wL.callback).toHaveBeenCalledWith(64)
  })

  it('resetAll zeros every side', async () => {
    const node = makeNode([
      makeWidget('pad_left',   10),
      makeWidget('pad_top',    20),
      makeWidget('pad_right',  30),
      makeWidget('pad_bottom', 40),
    ])
    const { pad, resetAll } = useOutpaintCanvas(node, makeState('/u'), ref(null), ref(null))
    resetAll()
    expect(pad.value).toEqual({ left: 0, top: 0, right: 0, bottom: 0 })
  })

  it('onSourceLoaded captures natural dimensions and outDims updates', async () => {
    const node = makeNode([
      makeWidget('pad_left',  10),
      makeWidget('pad_top',   0),
      makeWidget('pad_right', 20),
      makeWidget('pad_bottom', 0),
    ])
    const { outDims, onSourceLoaded } = useOutpaintCanvas(
      node, makeState('/u'), ref(null), ref(null),
    )
    expect(outDims.value).toBe('—')

    const fakeImg = { naturalWidth: 512, naturalHeight: 384 } as any
    onSourceLoaded({ target: fakeImg } as any)
    await nextTick()
    expect(outDims.value).toBe('542 × 384px')
  })

  function makePointer(type: string, clientX: number, clientY: number, pointerId = 1): PointerEvent {
    const e = new Event(type, { bubbles: true }) as any
    e.clientX = clientX
    e.clientY = clientY
    e.pointerId = pointerId
    return e as PointerEvent
  }

  function hostEl(): HTMLElement {
    const el = document.createElement('div')
    document.body.appendChild(el)
    return el
  }

  it('right-handle drag increases right pad by dx / scale', () => {
    const node = makeNode([
      makeWidget('pad_left', 0), makeWidget('pad_top', 0),
      makeWidget('pad_right', 0), makeWidget('pad_bottom', 0),
    ])
    const rootEl = ref<HTMLElement | null>(hostEl())
    const { pad, onHandlePointerDown } = useOutpaintCanvas(
      node, makeState('/u'), ref(null), rootEl,
    )
    onHandlePointerDown(makePointer('pointerdown', 100, 50), 'right')
    rootEl.value!.dispatchEvent(makePointer('pointermove', 150, 50))
    expect(pad.value.right).toBe(50)
    rootEl.value!.dispatchEvent(makePointer('pointerup', 150, 50))
  })

  it('left-handle drag uses inverted sign: leftward drag increases left pad', () => {
    const node = makeNode([
      makeWidget('pad_left', 0), makeWidget('pad_top', 0),
      makeWidget('pad_right', 0), makeWidget('pad_bottom', 0),
    ])
    const rootEl = ref<HTMLElement | null>(hostEl())
    const { pad, onHandlePointerDown } = useOutpaintCanvas(
      node, makeState('/u'), ref(null), rootEl,
    )
    onHandlePointerDown(makePointer('pointerdown', 100, 50), 'left')
    rootEl.value!.dispatchEvent(makePointer('pointermove', 70, 50))
    expect(pad.value.left).toBe(30)
    rootEl.value!.dispatchEvent(makePointer('pointerup', 70, 50))
  })

  it('top-handle drag tracks Y delta (inverted sign)', () => {
    const node = makeNode([
      makeWidget('pad_left', 0), makeWidget('pad_top', 5),
      makeWidget('pad_right', 0), makeWidget('pad_bottom', 0),
    ])
    const rootEl = ref<HTMLElement | null>(hostEl())
    const { pad, onHandlePointerDown } = useOutpaintCanvas(
      node, makeState('/u'), ref(null), rootEl,
    )
    onHandlePointerDown(makePointer('pointerdown', 0, 100), 'top')
    rootEl.value!.dispatchEvent(makePointer('pointermove', 0, 75))
    expect(pad.value.top).toBe(30)
    rootEl.value!.dispatchEvent(makePointer('pointerup', 0, 75))
  })

  it('style helpers return objects keyed by left/top/width/height for every side', async () => {
    const node = makeNode([
      makeWidget('pad_left', 16), makeWidget('pad_top', 8),
      makeWidget('pad_right', 24), makeWidget('pad_bottom', 12),
    ])
    const canvasNode = document.createElement('div')
    Object.defineProperty(canvasNode, 'clientWidth',  { value: 320, configurable: true })
    Object.defineProperty(canvasNode, 'clientHeight', { value: 240, configurable: true })
    const canvasEl = ref<HTMLElement | null>(canvasNode)

    const { onSourceLoaded, handleStyle, badgeStyle, imgStyle, padAreaStyle } =
      useOutpaintCanvas(node, makeState('/u'), canvasEl, ref(null))

    await nextTick()
    _roCallbacks.forEach(cb => cb())
    onSourceLoaded({ target: { naturalWidth: 200, naturalHeight: 150 } } as any)
    await nextTick()

    for (const s of (['left', 'top', 'right', 'bottom'] as const)) {
      const hs = handleStyle(s)
      expect(Object.keys(hs)).toEqual(expect.arrayContaining(['left', 'top', 'width', 'height']))
      const bs = badgeStyle(s)
      expect(Object.keys(bs)).toEqual(expect.arrayContaining(['left', 'top', 'transform']))
    }
    expect(Object.keys(imgStyle.value)).toEqual(['left', 'top', 'width', 'height'])
    expect(Object.keys(padAreaStyle.value)).toEqual(['left', 'top', 'width', 'height'])
  })

  it('handle drag is a no-op when no upstream image is wired', () => {
    const node = makeNode([
      makeWidget('pad_left', 0), makeWidget('pad_top', 0),
      makeWidget('pad_right', 0), makeWidget('pad_bottom', 0),
    ])
    const rootEl = ref<HTMLElement | null>(hostEl())
    const { pad, onHandlePointerDown } = useOutpaintCanvas(
      node, makeState(null), ref(null), rootEl,
    )
    onHandlePointerDown(makePointer('pointerdown', 100, 0), 'right')
    rootEl.value!.dispatchEvent(makePointer('pointermove', 150, 0))
    expect(pad.value.right).toBe(0)
  })
})
