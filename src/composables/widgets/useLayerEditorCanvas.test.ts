import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { LayerEditorController } from './useLayerEditorStage'
import {
  adjustedBrush,
  brushCursorDiameterPx,
  brushGradientCss,
  useLayerEditorCanvas,
} from './useLayerEditorCanvas'

let rafQueue: FrameRequestCallback[] = []

beforeEach(() => {
  rafQueue = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafQueue.push(cb)
    return rafQueue.length
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function flushRaf() {
  const q = rafQueue
  rafQueue = []
  for (const cb of q) cb(0)
}

function makeEditor() {
  const handler = {
    onPointerDown: vi.fn(() => true),
    onPointerMove: vi.fn(),
    onPointerUp: vi.fn(),
    cursorFor: vi.fn(() => 'move'),
  }
  const editor = {
    tool: ref('select'),
    brushSize: ref(40),
    brushOpacity: ref(1),
    brushHardness: ref(1),
    brushColor: ref('#ff4444'),
    paintTarget: ref('content'),
    panZoom: {
      screenToArtboard: vi.fn(() => ({ x: 5, y: 6 })),
      panBy: vi.fn(),
      zoom: vi.fn(() => 1),
      handleWheel: vi.fn(),
    },
    activeToolHandler: () => handler,
    requestRender: vi.fn(),
  }
  return { editor, handler }
}

function makeZone() {
  return {
    focus: vi.fn(),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
  } as unknown as HTMLElement
}

function ptr(over: Partial<{
  button: number
  offsetX: number
  offsetY: number
  clientX: number
  clientY: number
  altKey: boolean
}> = {}) {
  return {
    button: 0,
    offsetX: 0,
    offsetY: 0,
    clientX: 0,
    clientY: 0,
    altKey: false,
    pointerId: 1,
    preventDefault: vi.fn(),
    ...over,
  } as unknown as PointerEvent
}

function setup() {
  const { editor, handler } = makeEditor()
  const zone = makeZone()
  const viewportEl = ref<HTMLElement | null>(zone)
  const api = useLayerEditorCanvas(editor as unknown as LayerEditorController, viewportEl)
  return { editor, handler, zone, viewportEl, api }
}

describe('adjustedBrush', () => {
  const origin = { x0: 100, y0: 100, size0: 40, hardness0: 0.5 }

  it('ignores movement inside the dead zone', () => {
    expect(adjustedBrush(origin, 103, 97, 1)).toEqual({ size: 40, hardness: 0.5 })
  })

  it('grows size with horizontal drag and softens with downward drag', () => {
    const r = adjustedBrush(origin, 140, 130, 1)
    expect(r.size).toBe(60)
    expect(r.hardness).toBeCloseTo(0.4)
  })

  it('divides deltas by zoom', () => {
    expect(adjustedBrush(origin, 140, 100, 2).size).toBe(50)
  })

  it('clamps size and hardness', () => {
    expect(adjustedBrush(origin, 100 + 2000, 100, 1).size).toBe(400)
    expect(adjustedBrush(origin, 100 - 2000, 100, 1).size).toBe(2)
    expect(adjustedBrush(origin, 100, 100 + 10000, 1).hardness).toBe(0)
    expect(adjustedBrush(origin, 100, 100 - 10000, 1).hardness).toBe(1)
  })
})

describe('brushCursorDiameterPx / brushGradientCss', () => {
  it('cursor diameter is exactly the nominal size × zoom (engine paints within size)', () => {
    expect(brushCursorDiameterPx(40, 1)).toBe(40)
    expect(brushCursorDiameterPx(40, 2)).toBe(80)
    expect(brushCursorDiameterPx(40, 0.5)).toBe(20)
  })

  it('returns a flat color at full hardness', () => {
    expect(brushGradientCss({ r: 255, g: 0, b: 0 }, 1, 1)).toBe('rgba(255, 0, 0, 0.5)')
  })

  it('returns a radial gradient sampling the engine falloff for soft brushes', () => {
    const css = brushGradientCss({ r: 10, g: 20, b: 30 }, 1, 0.5)
    expect(css).toContain('radial-gradient(circle, rgba(10, 20, 30, 0.5) 0%')
    expect(css).toContain('rgba(10, 20, 30, 0) 100%)')
  })

  it('floors the visible alpha for very transparent brushes', () => {
    expect(brushGradientCss({ r: 0, g: 0, b: 0 }, 0, 1)).toBe('rgba(0, 0, 0, 0.075)')
  })
})

describe('useLayerEditorCanvas gestures', () => {
  it('pans with the middle button', () => {
    const { api, editor, zone } = setup()
    api.onPointerDown(ptr({ button: 1, offsetX: 10, offsetY: 10 }))
    expect(zone.setPointerCapture).toHaveBeenCalledWith(1)
    api.onPointerMove(ptr({ offsetX: 25, offsetY: 18 }))
    flushRaf()
    expect(editor.panZoom.panBy).toHaveBeenCalledWith(15, 8)
    api.onPointerUp(ptr({ offsetX: 25, offsetY: 18 }))
    expect(zone.releasePointerCapture).toHaveBeenCalledWith(1)
  })

  it('pans with left button while space is held', () => {
    const { api, editor } = setup()
    api.setSpaceDown(true)
    api.onPointerDown(ptr({ offsetX: 0, offsetY: 0 }))
    api.onPointerMove(ptr({ offsetX: 5, offsetY: 5 }))
    flushRaf()
    expect(editor.panZoom.panBy).toHaveBeenCalledWith(5, 5)
  })

  it('routes primary drags through the active tool handler', () => {
    const { api, handler, editor } = setup()
    api.onPointerDown(ptr({ clientX: 1, clientY: 2 }))
    expect(handler.onPointerDown).toHaveBeenCalledWith(expect.anything(), { x: 5, y: 6 })
    api.onPointerMove(ptr({ clientX: 3, clientY: 4 }))
    flushRaf()
    expect(handler.onPointerMove).toHaveBeenCalled()
    api.onPointerUp(ptr())
    expect(handler.onPointerUp).toHaveBeenCalled()
    expect(editor.panZoom.panBy).not.toHaveBeenCalled()
  })

  it('flushes a pending move before pointer up', () => {
    const { api, handler } = setup()
    api.onPointerDown(ptr())
    api.onPointerMove(ptr({ clientX: 9 }))
    api.onPointerUp(ptr())
    expect(handler.onPointerMove).toHaveBeenCalledTimes(1)
    expect(handler.onPointerUp).toHaveBeenCalledTimes(1)
  })

  it('updates the hover cursor when no tool gesture is active', () => {
    const { api, handler } = setup()
    handler.onPointerDown.mockReturnValue(false)
    api.onPointerDown(ptr())
    api.onPointerMove(ptr())
    flushRaf()
    expect(handler.cursorFor).toHaveBeenCalled()
    expect(api.hoverCursor.value).toBe('move')
    expect(api.viewportCursor.value).toBe('move')
  })

  it('collapses rapid moves into one flush per frame', () => {
    const { api, handler } = setup()
    api.onPointerDown(ptr())
    api.onPointerMove(ptr({ clientX: 1 }))
    api.onPointerMove(ptr({ clientX: 2 }))
    api.onPointerMove(ptr({ clientX: 3 }))
    flushRaf()
    expect(handler.onPointerMove).toHaveBeenCalledTimes(1)
  })

  it('adjusts brush size and hardness on alt-drag with a paint tool', () => {
    const { api, editor } = setup()
    editor.tool.value = 'brush'
    editor.brushHardness.value = 0.5
    api.onPointerDown(ptr({ altKey: true, offsetX: 100, offsetY: 100 }))
    expect(api.adjusting.value).toEqual({ x0: 100, y0: 100, size0: 40, hardness0: 0.5 })
    api.onPointerMove(ptr({ offsetX: 140, offsetY: 100 }))
    flushRaf()
    expect(editor.brushSize.value).toBe(60)
    api.onPointerUp(ptr())
    expect(api.adjusting.value).toBeNull()
  })

  it('does not enter adjust mode for non-paint tools', () => {
    const { api, handler } = setup()
    api.onPointerDown(ptr({ altKey: true }))
    expect(api.adjusting.value).toBeNull()
    expect(handler.onPointerDown).toHaveBeenCalled()
  })

  it('finishes the tool gesture and clears state on pointer leave', () => {
    const { api, handler } = setup()
    api.onPointerEnter()
    expect(api.hovering.value).toBe(true)
    api.onPointerDown(ptr())
    api.onPointerLeave(ptr())
    expect(api.hovering.value).toBe(false)
    expect(handler.onPointerUp).toHaveBeenCalled()
  })

  it('ignores pointer down without a viewport element', () => {
    const { editor, handler } = makeEditor()
    const viewportEl = ref<HTMLElement | null>(null)
    const api = useLayerEditorCanvas(editor as unknown as LayerEditorController, viewportEl)
    api.onPointerDown(ptr())
    expect(handler.onPointerDown).not.toHaveBeenCalled()
  })

  it('forwards wheel events to panZoom and re-renders', () => {
    const { api, editor } = setup()
    const e = { deltaY: -1 } as WheelEvent
    api.onWheel(e)
    expect(editor.panZoom.handleWheel).toHaveBeenCalledWith(e)
    expect(editor.requestRender).toHaveBeenCalled()
  })
})

describe('useLayerEditorCanvas cursor state', () => {
  it('shows grab while space is held', () => {
    const { api } = setup()
    api.setSpaceDown(true)
    expect(api.viewportCursor.value).toBe('grab')
  })

  it('hides the native cursor for paint tools and shows text cursor for text', () => {
    const { api, editor } = setup()
    editor.tool.value = 'brush'
    expect(api.viewportCursor.value).toBe('none')
    editor.tool.value = 'eraser'
    expect(api.viewportCursor.value).toBe('none')
    editor.tool.value = 'text'
    expect(api.viewportCursor.value).toBe('text')
  })

  it('shows the brush cursor only when hovering with a paint tool and space released', () => {
    const { api, editor } = setup()
    editor.tool.value = 'brush'
    expect(api.brushCursorVisible.value).toBe(false)
    api.onPointerEnter()
    expect(api.brushCursorVisible.value).toBe(true)
    api.setSpaceDown(true)
    expect(api.brushCursorVisible.value).toBe(false)
  })

  it('positions the brush cursor around the pointer', () => {
    const { api, editor } = setup()
    editor.tool.value = 'brush'
    api.onPointerMove(ptr({ offsetX: 50, offsetY: 60 }))
    expect(api.brushCursorStyle.value).toEqual({
      width: '40px',
      height: '40px',
      transform: 'translate(30px, 40px)',
    })
  })

  it('pins the brush cursor to the adjust origin while adjusting', () => {
    const { api, editor } = setup()
    editor.tool.value = 'brush'
    api.onPointerDown(ptr({ altKey: true, offsetX: 100, offsetY: 100 }))
    api.onPointerMove(ptr({ offsetX: 140, offsetY: 140 }))
    expect(api.brushCursorStyle.value.transform).toBe('translate(80px, 80px)')
  })

  it('uses white for eraser and mask painting, brush color otherwise', () => {
    const { api, editor } = setup()
    editor.tool.value = 'eraser'
    expect(api.brushGradient.value).toBe('rgba(255, 255, 255, 0.5)')
    editor.tool.value = 'brush'
    editor.paintTarget.value = 'mask'
    expect(api.brushGradient.value).toBe('rgba(255, 255, 255, 0.5)')
    editor.paintTarget.value = 'content'
    expect(api.brushGradient.value).toBe('rgba(255, 68, 68, 0.5)')
  })
})
