import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock, type MockInstance } from 'vitest'
import { defineComponent } from 'vue'

import { app } from '@/lib/comfyApp'

vi.mock('@/i18n', () => ({ t: (k: string) => k }))

const fontState = vi.hoisted(() => ({
  font: null as Record<string, unknown> | null,
  readyCbs: new Set<() => void>(),
}))
vi.mock('@/widgets/layerEditor/fontStore', () => ({
  getFontStore: () => ({
    getFontSync: () => fontState.font,
    getFontSyncWithFallback: () => fontState.font,
    onFontReady: (cb: () => void) => {
      fontState.readyCbs.add(cb)
      return () => fontState.readyCbs.delete(cb)
    },
  }),
}))

const measureState = vi.hoisted(() => ({ value: { w: 200, h: 60 } }))
vi.mock('@/widgets/layerEditor/textRender', () => ({
  measureText: vi.fn(() => ({ ...measureState.value })),
  TextRenderCache: class {
    get() { return null }
    drop() {}
    clear() {}
  },
}))

const rendererMocks = vi.hoisted(() => ({
  renderMain: vi.fn(),
  renderOverlay: vi.fn(),
  exportComposited: vi.fn(() => {
    const c = document.createElement('canvas')
    c.width = 8
    c.height = 8
    return c
  }),
  exportLayerAlone: vi.fn(() => {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 4
    return c
  }),
}))
vi.mock('@/widgets/layerEditor/renderer', () => rendererMocks)

const toolState = vi.hoisted(() => ({
  ctx: null as any,
  handlers: [] as Array<{ tag: string }>,
}))
vi.mock('@/widgets/layerEditor/tools', () => {
  const make = (tag: string) => (ctx: unknown) => {
    toolState.ctx = ctx
    const h = {
      tag,
      onPointerDown: () => true,
      onPointerMove: () => {},
      onPointerUp: () => {},
      cursorFor: () => 'default',
    }
    toolState.handlers.push(h)
    return h
  }
  return {
    createSelectTool: make('select'),
    createPaintTool: make('paint'),
    createTextTool: make('text'),
  }
})

vi.mock('@/widgets/layerEditor/maskUtils', () => ({
  createOpaqueMask: (w: number, h: number) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  },
  alphaMaskToLuminance: (c: HTMLCanvasElement) => c,
  luminanceToAlphaMask: (_img: unknown, w: number, h: number) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  },
}))

import { useLayerEditorStage, type LayerEditorController } from './useLayerEditorStage'

// ---------------------------------------------------------------- test rig

const fetchApi = (app as any).api.fetchApi as Mock
const toastAdd = vi.fn()

const imageSizes = new Map<string, { w: number; h: number }>()

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  crossOrigin = ''
  naturalWidth = 0
  naturalHeight = 0
  set src(v: string) {
    const size = imageSizes.get(v) ?? { w: 64, h: 64 }
    queueMicrotask(() => {
      if (v.includes('bad')) {
        this.onerror?.()
        return
      }
      this.naturalWidth = size.w
      this.naturalHeight = size.h
      this.onload?.()
    })
  }
}

class FakeFileReader {
  onload: (() => void) | null = null
  result: string | null = null
  readAsDataURL(file: File) {
    this.result = `data:image/x;name=${file.name}`
    queueMicrotask(() => this.onload?.())
  }
}

let rafCbs: FrameRequestCallback[] = []
const cancelRaf = vi.fn()

function flushRaf(): void {
  const cbs = rafCbs
  rafCbs = []
  for (const cb of cbs) cb(0)
}

async function flushMicro(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve()
}

function okUpload(): Response {
  return new Response(JSON.stringify({ name: 'up.png' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function makeNode(layerState = '{}', capturedImage = '') {
  return {
    id: 3,
    widgets: [
      { name: 'layer_state', value: layerState, callback: undefined },
      { name: 'width', value: 1024, callback: undefined },
      { name: 'height', value: 1024, callback: undefined },
      { name: 'captured_image', value: capturedImage, callback: undefined },
      { name: 'captured_images', value: '', callback: undefined },
    ],
    onConfigure: undefined as undefined | ((i: unknown) => void),
  } as any
}

function widgetVal(node: any, name: string) {
  return node.widgets.find((w: any) => w.name === name).value
}

let wrappers: VueWrapper[] = []

function setup(
  layerState = '{}',
  opts?: { onCaptured?: (u: string) => void; onBatchCaptured?: (j: string) => void },
  capturedImage = '',
) {
  const node = makeNode(layerState, capturedImage)
  let s!: LayerEditorController
  const wrapper = mount(
    defineComponent({
      setup() {
        s = useLayerEditorStage(node, opts)
        return () => null
      },
    }),
  )
  wrappers.push(wrapper)
  return { node, s, wrapper }
}

function makeEls() {
  const viewport = document.createElement('div')
  Object.defineProperty(viewport, 'clientWidth', { value: 800 })
  Object.defineProperty(viewport, 'clientHeight', { value: 600 })
  const container = document.createElement('div')
  const main = document.createElement('canvas')
  const overlay = document.createElement('canvas')
  return { viewport, container, main, overlay }
}

async function withImageLayer(
  s: LayerEditorController,
  url = '/img/a.png',
  size = { w: 200, h: 100 },
  name = 'pic',
) {
  imageSizes.set(url, size)
  await s.addImageFromUrl(url, name)
  return s.state.value.layers[s.state.value.layers.length - 1]
}

let errSpy: MockInstance
let warnSpy: MockInstance

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

  fontState.font = null
  fontState.readyCbs.clear()
  measureState.value = { w: 200, h: 60 }
  toolState.ctx = null
  toolState.handlers.length = 0
  imageSizes.clear()
  rafCbs = []

  fetchApi.mockImplementation(async () => okUpload())
  ;(app as any).extensionManager = { toast: { add: toastAdd } }

  vi.stubGlobal('Image', FakeImage as any)
  vi.stubGlobal('FileReader', FakeFileReader as any)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCbs.push(cb)
    return rafCbs.length
  })
  vi.stubGlobal('cancelAnimationFrame', cancelRaf)

  const ctx2d = {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
  }
  HTMLCanvasElement.prototype.getContext = function () {
    return ctx2d
  } as any
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(['png'], { type: 'image/png' }))
  }
})

afterEach(() => {
  wrappers.forEach((w) => {
    try {
      w.unmount()
    } catch {
      /* already unmounted by the test */
    }
  })
  wrappers = []
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  errSpy.mockRestore()
  warnSpy.mockRestore()
})

// ---------------------------------------------------------------- tests

describe('useLayerEditorStage: init + rendering', () => {
  it('normalizes the widget state and falls back on bad json', () => {
    const { s } = setup('not-json{{{')
    expect(s.state.value).toEqual({ version: 1, width: 1024, height: 1024, layers: [] })
    expect(s.activeId.value).toBeNull()
    expect(s.activeLayer.value).toBeNull()
    expect(s.canUndo.value).toBe(false)
    expect(s.canRedo.value).toBe(false)
  })

  it('reads the captured image url from the widget', () => {
    const { s } = setup('{}', undefined, '/view/prev.png')
    expect(s.capturedImageUrl.value).toBe('/view/prev.png')
  })

  it('requestRender before elements exist is a safe no-op', () => {
    const { s } = setup()
    s.requestRender()
    flushRaf()
    expect(rendererMocks.renderMain).not.toHaveBeenCalled()
  })

  it('setElements fits the view and renders through rAF, coalescing frames', () => {
    const { s } = setup()
    const els = makeEls()
    s.setElements(els)
    expect(s.panZoom.zoom()).toBeCloseTo((600 / 1024) * 0.9, 4)
    expect(els.container.style.left).not.toBe('')

    flushRaf()
    expect(els.main.width).toBe(1024)
    expect(els.overlay.height).toBe(1024)
    expect(rendererMocks.renderMain).toHaveBeenCalledTimes(1)
    expect(rendererMocks.renderOverlay).toHaveBeenCalledTimes(1)

    s.requestRender()
    s.requestRender()
    expect(rafCbs).toHaveLength(1)
    flushRaf()
    expect(rendererMocks.renderMain).toHaveBeenCalledTimes(2)
  })
})

describe('useLayerEditorStage: image layers', () => {
  it('adds an image layer centered on the artboard, keeping the source url', async () => {
    const { node, s } = setup()
    const layer = await withImageLayer(s, '/img/a.png', { w: 200, h: 100 })
    expect(layer.type).toBe('raster')
    expect(layer.name).toBe('pic')
    expect(layer.transform).toEqual({ x: 412, y: 462, w: 200, h: 100, rotation: 0 })
    expect((layer as any).url).toBe('/img/a.png')
    expect(s.activeId.value).toBe(layer.id)
    expect(s.activeLayer.value?.id).toBe(layer.id)
    expect(s.selectedIds.value.has(layer.id)).toBe(true)
    expect(JSON.parse(widgetVal(node, 'layer_state')).layers).toHaveLength(1)
  })

  it('caps oversized content, scales the transform, and drops the url', async () => {
    const { s } = setup()
    const layer = await withImageLayer(s, '/img/huge.png', { w: 8192, h: 4096 })
    expect((layer as any).naturalWidth).toBe(4096)
    expect((layer as any).naturalHeight).toBe(2048)
    expect((layer as any).url).toBeUndefined()
    expect(layer.transform).toEqual({ x: 0, y: 256, w: 1024, h: 512, rotation: 0 })
  })

  it('toasts when the image url fails to load', async () => {
    const { s } = setup()
    await s.addImageFromUrl('/img/bad.png', 'nope')
    expect(s.state.value.layers).toHaveLength(0)
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'layerEditor.loadImageFailed' }),
    )
  })

  it('adds an image layer from a file, named after the file', async () => {
    const { s } = setup()
    s.addImageFromFile(new File(['x'], 'pic.png'))
    await flushMicro()
    expect(s.state.value.layers).toHaveLength(1)
    expect(s.state.value.layers[0].name).toBe('pic.png')
    expect((s.state.value.layers[0] as any).url).toBeUndefined()
  })

  it('toasts when the file image fails to decode', async () => {
    const { s } = setup()
    s.addImageFromFile(new File(['x'], 'bad.png'))
    await flushMicro()
    expect(s.state.value.layers).toHaveLength(0)
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'layerEditor.loadImageFailed' }),
    )
  })
})

describe('useLayerEditorStage: text layers', () => {
  it('adds a text layer and patches it without a font', () => {
    const { s } = setup()
    const id = s.addTextLayerAt({ x: 10, y: 20 })
    expect(s.activeId.value).toBe(id)
    const layer = s.state.value.layers[0] as any
    expect(layer.type).toBe('text')
    expect(layer.transform.x).toBe(10)

    s.updateTextLayer(id, { text: 'hello', fontSize: 32 })
    const after = s.state.value.layers[0] as any
    expect(after.text).toBe('hello')
    expect(after.fontSize).toBe(32)
    // no font loaded -> transform untouched by metrics
    expect(after.transform.w).toBe(layer.transform.w)
  })

  it('re-measures the transform when a font is available', () => {
    const { s } = setup()
    fontState.font = {}
    measureState.value = { w: 123, h: 45 }
    const id = s.addTextLayerAt({ x: 0, y: 0 })
    s.updateTextLayer(id, { text: 'world' })
    const layer = s.state.value.layers[0]
    expect(layer.transform.w).toBe(123)
    expect(layer.transform.h).toBe(45)
  })

  it('updateTextLayer on a raster layer changes nothing', async () => {
    const { s } = setup()
    const layer = await withImageLayer(s)
    const before = JSON.stringify(s.state.value)
    s.updateTextLayer(layer.id, { text: 'nope' } as any)
    expect(JSON.stringify(s.state.value)).toBe(before)
  })

  it('font-ready listener silently syncs text metrics once', () => {
    const { s } = setup()
    const id = s.addTextLayerAt({ x: 0, y: 0 })
    const undoDepthBefore = s.canUndo.value

    fontState.font = {}
    measureState.value = { w: 300, h: 90 }
    fontState.readyCbs.forEach((cb) => cb())
    const layer = s.state.value.layers[0]
    expect(layer.transform.w).toBe(300)
    expect(layer.transform.h).toBe(90)
    // silent patch: no new history entry
    expect(s.canUndo.value).toBe(undoDepthBefore)

    // second fire: metrics identical -> mutate returns false, no re-write
    fontState.readyCbs.forEach((cb) => cb())
    expect(s.state.value.layers[0].transform.w).toBe(300)
    expect(s.state.value.layers.find((l) => l.id === id)).toBeTruthy()
  })
})

describe('useLayerEditorStage: layer operations', () => {
  it('removes layers and reassigns the active layer', () => {
    const { s } = setup()
    const a = s.addTextLayerAt({ x: 0, y: 0 })
    const b = s.addTextLayerAt({ x: 1, y: 1 })
    const c = s.addTextLayerAt({ x: 2, y: 2 })

    s.setActiveLayer(b)
    s.removeLayer(b)
    expect(s.state.value.layers.map((l) => l.id)).toEqual([a, c])
    expect(s.activeId.value).toBe(c)

    s.removeLayer('missing')
    expect(s.state.value.layers).toHaveLength(2)

    s.removeLayer(c)
    expect(s.activeId.value).toBe(a)
    s.removeLayer(a)
    expect(s.state.value.layers).toHaveLength(0)
    expect(s.activeId.value).toBeNull()
  })

  it('moves layers within bounds only', () => {
    const { s } = setup()
    const a = s.addTextLayerAt({ x: 0, y: 0 })
    const b = s.addTextLayerAt({ x: 1, y: 1 })

    s.moveLayer(a, 1)
    expect(s.state.value.layers.map((l) => l.id)).toEqual([b, a])
    s.moveLayer(a, 1) // already last
    expect(s.state.value.layers.map((l) => l.id)).toEqual([b, a])
    s.moveLayer(a, -1)
    expect(s.state.value.layers.map((l) => l.id)).toEqual([a, b])
    s.moveLayer('missing', 1)
    expect(s.state.value.layers.map((l) => l.id)).toEqual([a, b])
  })

  it('duplicates a layer with an offset copy and selects it', () => {
    const { s } = setup()
    const a = s.addTextLayerAt({ x: 5, y: 6 })
    s.duplicateLayer(a)
    expect(s.state.value.layers).toHaveLength(2)
    const copy = s.state.value.layers[1]
    expect(copy.id).not.toBe(a)
    expect(copy.name).toBe('Text copy')
    expect(copy.transform.x).toBe(21)
    expect(copy.transform.y).toBe(22)
    expect(s.activeId.value).toBe(copy.id)

    s.duplicateLayer('missing')
    expect(s.state.value.layers).toHaveLength(2)
  })

  it('patches opacity (clamped), blend mode, visibility, lock and name', () => {
    const { s } = setup()
    const id = s.addTextLayerAt({ x: 0, y: 0 })

    s.setOpacity(id, -3)
    expect(s.state.value.layers[0].opacity).toBe(0)
    s.setOpacity(id, 9)
    expect(s.state.value.layers[0].opacity).toBe(1)

    s.setBlendMode(id, 'multiply')
    expect(s.state.value.layers[0].blendMode).toBe('multiply')

    s.toggleVisible(id)
    expect(s.state.value.layers[0].visible).toBe(false)
    s.toggleLock(id)
    expect(s.state.value.layers[0].locked).toBe(true)

    s.renameLayer(id, '  Named ')
    expect(s.state.value.layers[0].name).toBe('Named')
    s.renameLayer(id, '   ')
    expect(s.state.value.layers[0].name).toBe('Named')
  })

  it('resizes the artboard (clamped) and writes size widgets', () => {
    const { node, s } = setup()
    s.setArtboardSize(512, 256)
    expect(s.state.value.width).toBe(512)
    expect(s.state.value.height).toBe(256)
    expect(widgetVal(node, 'width')).toBe(512)
    expect(widgetVal(node, 'height')).toBe(256)

    s.setArtboardSize(9999, 1)
    expect(s.state.value.width).toBe(4096)
    expect(s.state.value.height).toBe(64)
  })

  it('nudges only when a layer is active', () => {
    const { s } = setup()
    s.nudgeActive(5, 5) // no active layer
    const id = s.addTextLayerAt({ x: 10, y: 10 })
    s.nudgeActive(3, -4)
    const layer = s.state.value.layers.find((l) => l.id === id)!
    expect(layer.transform.x).toBe(13)
    expect(layer.transform.y).toBe(6)
  })
})

describe('useLayerEditorStage: masks', () => {
  it('adds, toggles and removes a mask on a raster layer', async () => {
    const { s } = setup()
    const layer = await withImageLayer(s, '/img/a.png', { w: 200, h: 100 })

    s.addMask(layer.id)
    const mask = s.state.value.layers[0].mask!
    expect(mask.enabled).toBe(true)
    expect(s.content.get(mask.contentId)?.canvas.width).toBe(200)
    expect(s.content.get(mask.contentId)?.canvas.height).toBe(100)
    expect(s.paintTarget.value).toBe('mask')

    s.addMask(layer.id) // already has one -> no-op
    expect(s.state.value.layers[0].mask!.contentId).toBe(mask.contentId)

    s.toggleMaskEnabled(layer.id)
    expect(s.state.value.layers[0].mask!.enabled).toBe(false)

    s.removeMask(layer.id)
    expect(s.state.value.layers[0].mask).toBeUndefined()
    expect(s.paintTarget.value).toBe('content')
  })

  it('sizes a text-layer mask from its transform and ignores unknown ids', () => {
    const { s } = setup()
    s.addMask('missing')
    const id = s.addTextLayerAt({ x: 0, y: 0 }) // default 256 x 76.8
    s.addMask(id)
    const mask = s.state.value.layers[0].mask!
    expect(s.content.get(mask.contentId)?.canvas.width).toBe(256)
    expect(s.content.get(mask.contentId)?.canvas.height).toBe(77)
  })
})

describe('useLayerEditorStage: undo/redo', () => {
  it('undoes and redoes structural changes through state and widget', () => {
    const { node, s } = setup()
    s.undo() // empty history no-ops
    s.redo()

    s.addTextLayerAt({ x: 0, y: 0 })
    expect(s.canUndo.value).toBe(true)

    s.undo()
    expect(s.state.value.layers).toHaveLength(0)
    expect(JSON.parse(widgetVal(node, 'layer_state')).layers).toHaveLength(0)
    expect(s.canRedo.value).toBe(true)

    s.redo()
    expect(s.state.value.layers).toHaveLength(1)
    expect(s.canRedo.value).toBe(false)
  })

  it('merges rapid same-key patches into one undo step', () => {
    const { s } = setup()
    const id = s.addTextLayerAt({ x: 0, y: 0 })
    s.setOpacity(id, 0.5)
    s.setOpacity(id, 0.25)
    expect(s.state.value.layers[0].opacity).toBe(0.25)

    s.undo()
    expect(s.state.value.layers[0].opacity).toBe(1)
  })

  it('restores the selection recorded with the snapshot', () => {
    const { s } = setup()
    const a = s.addTextLayerAt({ x: 0, y: 0 })
    const b = s.addTextLayerAt({ x: 1, y: 1 })
    s.toggleVisible(b)
    s.setActiveLayer(null)

    // the pre-toggle snapshot was committed while `a` was still active
    s.undo()
    expect(s.state.value.layers[1].visible).toBe(true)
    expect(s.activeId.value).toBe(a)
  })

  it('clears the redo stack on a new commit', () => {
    const { s } = setup()
    const id = s.addTextLayerAt({ x: 0, y: 0 })
    s.toggleVisible(id)
    s.undo()
    expect(s.canRedo.value).toBe(true)
    s.toggleLock(id)
    expect(s.canRedo.value).toBe(false)
  })
})

describe('useLayerEditorStage: uploads', () => {
  it('uploads dirty content + mask after the debounce and patches urls', async () => {
    const { s } = setup()
    s.addImageFromFile(new File(['x'], 'pic.png'))
    await flushMicro()
    const layer = s.state.value.layers[0] as any
    expect(layer.url).toBeUndefined()
    s.addMask(layer.id)
    s.duplicateLayer(layer.id) // shares the same contentId -> exercises the cache path

    await vi.advanceTimersByTimeAsync(800)
    const after = s.state.value.layers[0] as any
    expect(after.url).toContain('/view?filename=up.png')
    expect(after.url).toContain('subfolder=comfytv%2Flayer-editor')
    expect(after.mask?.url).toContain('/view?filename=up.png')
    expect((s.state.value.layers[1] as any).url).toContain('/view?filename=up.png')
    expect(s.content.get(after.contentId)?.uploadedUrl).toContain('up.png')
  })

  it('skips content whose blob cannot be produced', async () => {
    const { s } = setup()
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(null)
    }
    s.addImageFromFile(new File(['x'], 'pic.png'))
    await flushMicro()
    await vi.advanceTimersByTimeAsync(800)
    expect((s.state.value.layers[0] as any).url).toBeUndefined()
    expect(toastAdd).not.toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'layerEditor.uploadFailed' }),
    )
  })

  it('toasts when the upload endpoint rejects', async () => {
    const { s } = setup()
    fetchApi.mockImplementation(
      async () =>
        new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    s.addImageFromFile(new File(['x'], 'pic.png'))
    await flushMicro()
    await vi.advanceTimersByTimeAsync(800)
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'layerEditor.uploadFailed' }),
    )
    expect((s.state.value.layers[0] as any).url).toBeUndefined()
  })

  it('skips layers whose content entry is missing', async () => {
    const stateJson = JSON.stringify({
      width: 128,
      height: 128,
      layers: [
        {
          id: 'L1',
          type: 'raster',
          contentId: 'ghost',
          naturalWidth: 4,
          naturalHeight: 4,
          transform: { x: 0, y: 0, w: 4, h: 4, rotation: 0 },
        },
      ],
    })
    const { s } = setup(stateJson)
    s.renameLayer('L1', 'renamed')
    await vi.advanceTimersByTimeAsync(800)
    expect((s.state.value.layers[0] as any).url).toBeUndefined()
  })

  it('re-runs the upload when new work arrives while one is in flight', async () => {
    const { s } = setup()
    let release!: (r: Response) => void
    rendererMocks.exportComposited.mockImplementationOnce(() => {
      throw new Error('skip capture')
    })
    fetchApi.mockImplementationOnce(() => new Promise<Response>((res) => (release = res)))

    s.addImageFromFile(new File(['a'], 'one.png'))
    await flushMicro()
    await vi.advanceTimersByTimeAsync(800) // upload 1 hangs on fetch

    s.addImageFromFile(new File(['b'], 'two.png'))
    await flushMicro()
    await vi.advanceTimersByTimeAsync(800) // re-entry -> uploadAgain

    release(okUpload())
    await flushMicro()
    await vi.advanceTimersByTimeAsync(800) // rescheduled pass uploads layer 2

    expect((s.state.value.layers[0] as any).url).toContain('up.png')
    expect((s.state.value.layers[1] as any).url).toContain('up.png')
  })
})

describe('useLayerEditorStage: capture', () => {
  it('debounced capture uploads the composite and notifies', async () => {
    const onCaptured = vi.fn()
    const { node, s } = setup('{}', { onCaptured })
    s.addTextLayerAt({ x: 0, y: 0 })
    await vi.advanceTimersByTimeAsync(800)
    expect(rendererMocks.exportComposited).toHaveBeenCalled()
    expect(widgetVal(node, 'captured_image')).toContain('/view?filename=up.png')
    expect(s.capturedImageUrl.value).toContain('up.png')
    expect(onCaptured).toHaveBeenCalledWith(expect.stringContaining('up.png'))
  })

  it('skips capture with zero layers', async () => {
    const { s } = setup()
    s.setArtboardSize(512, 512)
    await vi.advanceTimersByTimeAsync(800)
    expect(rendererMocks.exportComposited).not.toHaveBeenCalled()
  })

  it('capture failure is logged without touching the widget', async () => {
    const { node, s } = setup()
    rendererMocks.exportComposited.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    s.addTextLayerAt({ x: 0, y: 0 })
    await vi.advanceTimersByTimeAsync(800)
    expect(widgetVal(node, 'captured_image')).toBe('')
    expect(errSpy).toHaveBeenCalled()
  })

  it('captureBatch uploads the composite plus each visible layer', async () => {
    const onCaptured = vi.fn()
    const onBatchCaptured = vi.fn()
    const { node, s } = setup('{}', { onCaptured, onBatchCaptured })
    await withImageLayer(s, '/img/a.png', { w: 20, h: 10 }, 'visible-pic')
    const hiddenId = s.addTextLayerAt({ x: 0, y: 0 })
    s.toggleVisible(hiddenId)

    await s.captureBatch()

    expect(rendererMocks.exportLayerAlone).toHaveBeenCalledTimes(1)
    const batch = JSON.parse(widgetVal(node, 'captured_images'))
    expect(batch.images).toHaveLength(2)
    expect(batch.images[0]).toEqual(
      expect.objectContaining({ index: '1', label: 'composite' }),
    )
    expect(batch.images[1]).toEqual(
      expect.objectContaining({ index: '2', label: 'visible-pic' }),
    )
    expect(onCaptured).toHaveBeenCalled()
    expect(onBatchCaptured).toHaveBeenCalledWith(widgetVal(node, 'captured_images'))
    expect(s.capturing.value).toBe(false)
    expect(widgetVal(node, 'captured_image')).toContain('up.png')
  })

  it('captureBatch failure toasts and resets the flag', async () => {
    const { s } = setup()
    s.addTextLayerAt({ x: 0, y: 0 })
    rendererMocks.exportComposited.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    await s.captureBatch()
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'layerEditor.captureFailed' }),
    )
    expect(s.capturing.value).toBe(false)
  })

  it('captureBatch is a no-op while already capturing', async () => {
    const { s } = setup()
    s.capturing.value = true
    await s.captureBatch()
    expect(rendererMocks.exportComposited).not.toHaveBeenCalled()
  })
})

describe('useLayerEditorStage: tool wiring', () => {
  it('activeToolHandler switches between the four tool handlers', () => {
    const { s } = setup()
    const [selH, brushH, eraserH, textH] = toolState.handlers.slice(-4) as any[]
    expect(s.activeToolHandler()).toBe(selH)
    s.tool.value = 'brush'
    expect(s.activeToolHandler()).toBe(brushH)
    s.tool.value = 'eraser'
    expect(s.activeToolHandler()).toBe(eraserH)
    s.tool.value = 'text'
    expect(s.activeToolHandler()).toBe(textH)
  })

  it('exposes state, brush, overrides and the text editor through the tool context', () => {
    const { s } = setup()
    const ctx = toolState.ctx
    const id = s.addTextLayerAt({ x: 0, y: 0 })

    expect(ctx.getState()).toBe(s.state.value)
    expect(ctx.getActiveId()).toBe(id)
    ctx.setActiveLayer(null)
    expect(s.activeId.value).toBeNull()

    s.brushSize.value = 12
    s.brushOpacity.value = 0.5
    s.brushHardness.value = 0.7
    s.brushColor.value = '#00ff00'
    expect(ctx.brush()).toEqual({ size: 12, opacity: 0.5, hardness: 0.7, color: '#00ff00' })

    expect(ctx.brushTool()).toBe('brush')
    s.tool.value = 'eraser'
    expect(ctx.brushTool()).toBe('eraser')
    expect(ctx.paintTarget()).toBe('content')
    expect(ctx.zoom()).toBeGreaterThanOrEqual(0.01)

    const c = document.createElement('canvas')
    ctx.setOverride('content:x', c)
    ctx.setOverride('content:x', null)

    ctx.openTextEditor('t1')
    expect(s.editingTextId.value).toBe('t1')
  })

  it('resize commits on text layers rescale the font size, clamped', () => {
    const { s } = setup()
    fontState.font = {}
    measureState.value = { w: 100, h: 50 }
    const id = s.addTextLayerAt({ x: 0, y: 0 })
    s.updateTextLayer(id, { text: 'abc' })
    expect(s.state.value.layers[0].transform.h).toBe(50)

    const ctx = toolState.ctx
    const next = JSON.parse(JSON.stringify(s.state.value))
    next.layers[0].transform.h = 100 // 2x
    ctx.commit(next, `resize:${id}`)
    expect((s.state.value.layers[0] as any).fontSize).toBe(128)
    expect(s.state.value.layers[0].transform.w).toBe(100) // re-measured

    const next2 = JSON.parse(JSON.stringify(s.state.value))
    next2.layers[0].transform.h = 50 * 100
    ctx.commit(next2, `resize:${id}`)
    expect((s.state.value.layers[0] as any).fontSize).toBe(2048)
  })

  it('resize commits on raster layers pass straight through', async () => {
    const { s } = setup()
    const layer = await withImageLayer(s)
    const ctx = toolState.ctx
    const next = JSON.parse(JSON.stringify(s.state.value))
    next.layers[0].transform.h = 500
    ctx.commit(next, `resize:${layer.id}`)
    expect(s.state.value.layers[0].transform.h).toBe(500)
  })
})

describe('useLayerEditorStage: node lifecycle', () => {
  const hydrateJson = JSON.stringify({
    width: 512,
    height: 512,
    layers: [
      {
        id: 'L1',
        type: 'raster',
        contentId: 'c1',
        url: '/img/hydrate.png',
        naturalWidth: 64,
        naturalHeight: 64,
        transform: { x: 0, y: 0, w: 64, h: 64, rotation: 0 },
        mask: { contentId: 'm1', url: '/img/mask.png', enabled: true },
      },
      {
        id: 'T1',
        type: 'text',
        text: 'hi',
        transform: { x: 0, y: 0, w: 100, h: 40, rotation: 0 },
        mask: { contentId: 'm2', url: '/img/mask2.png', enabled: true },
      },
    ],
  })

  it('hydrates raster content and masks from urls on startup', async () => {
    const { node, s } = setup(hydrateJson)
    await flushMicro()
    expect(s.content.has('c1')).toBe(true)
    expect(s.content.has('m1')).toBe(true)
    expect(s.content.has('m2')).toBe(true)
    expect(s.content.get('m2')?.canvas.width).toBe(100)
    expect(s.content.get('c1')?.uploadedUrl).toBe('/img/hydrate.png')

    // re-configure with content already present -> hydration skips quietly
    node.onConfigure({})
    await flushMicro()
    expect(s.content.has('c1')).toBe(true)
  })

  it('logs hydrate failures without breaking the layer', async () => {
    const json = JSON.stringify({
      layers: [
        {
          id: 'L1',
          type: 'raster',
          contentId: 'c1',
          url: '/img/bad.png',
          naturalWidth: 8,
          naturalHeight: 8,
          transform: { x: 0, y: 0, w: 8, h: 8, rotation: 0 },
          mask: { contentId: 'm1', url: '/img/badmask.png', enabled: true },
        },
      ],
    })
    const { s } = setup(json)
    await flushMicro()
    expect(s.content.has('c1')).toBe(false)
    expect(warnSpy).toHaveBeenCalledTimes(2)
    expect(s.state.value.layers).toHaveLength(1)
  })

  it('reloads state, selection and history on node configure', () => {
    const { node, s } = setup()
    const id = s.addTextLayerAt({ x: 1, y: 2 })
    s.setActiveLayer(id)
    s.editingTextId.value = id

    node.widgets.find((w: any) => w.name === 'layer_state').value = JSON.stringify({
      width: 256,
      height: 256,
      layers: [],
    })
    node.widgets.find((w: any) => w.name === 'captured_image').value = '/view/prev.png'
    node.onConfigure({})

    expect(s.state.value.width).toBe(256)
    expect(s.state.value.layers).toHaveLength(0)
    expect(s.activeId.value).toBeNull()
    expect(s.editingTextId.value).toBeNull()
    expect(s.capturedImageUrl.value).toBe('/view/prev.png')
    expect(s.canUndo.value).toBe(false)
    expect(s.canRedo.value).toBe(false)
  })

  it('drops old history when the content byte budget is exceeded', async () => {
    const { s } = setup()
    for (let i = 0; i < 5; i++) {
      await withImageLayer(s, `/img/big${i}.png`, { w: 9000, h: 9000 }, `big${i}`)
    }
    expect(s.state.value.layers).toHaveLength(5)
    expect((s.state.value.layers[0] as any).naturalWidth).toBe(4096)
    // 5 x 4096^2 canvases blow the 256MB budget -> oldest history entries purged
    expect(s.canUndo.value).toBe(false)
  })

  it('unmount unsubscribes, cancels rAF and clears pending timers', async () => {
    const { s, wrapper } = setup()
    s.addTextLayerAt({ x: 0, y: 0 }) // schedules upload + capture + a frame
    expect(fontState.readyCbs.size).toBe(1)
    expect(rafCbs.length).toBeGreaterThan(0)

    wrapper.unmount()
    expect(fontState.readyCbs.size).toBe(0)
    expect(cancelRaf).toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(2000)
    expect(rendererMocks.exportComposited).not.toHaveBeenCalled()
    expect(fetchApi).not.toHaveBeenCalled()
  })
})
