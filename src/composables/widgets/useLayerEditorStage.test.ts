import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

vi.mock('@/i18n', () => ({ t: (k: string) => k }))

const fontState = vi.hoisted(() => ({
  font: null as Record<string, unknown> | null,
  readyCbs: new Set<() => void>(),
}))
vi.mock('@/widgets/layerEditor/fontStore', () => ({
  getFontStore: () => ({
    builtins: () => [],
    getFontSync: () => fontState.font,
    getFontSyncWithFallback: () => fontState.font,
    hasFailed: () => false,
    onFontReady: (cb: () => void) => {
      fontState.readyCbs.add(cb)
      return () => fontState.readyCbs.delete(cb)
    },
  }),
}))

const measureState = vi.hoisted(() => ({ value: { w: 200, h: 60 } }))
vi.mock('@/widgets/layerEditor/textRender', () => ({
  measureText: vi.fn(() => ({ ...measureState.value })),
  renderTextToCanvas: vi.fn(() => document.createElement('canvas')),
  TextRenderCache: class {
    get() { return null }
    drop() {}
    clear() {}
  },
}))

import { useLayerEditorStage, type LayerEditorController } from './useLayerEditorStage'

const imageSizes = new Map<string, { w: number; h: number }>()

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  crossOrigin = ''
  naturalWidth = 0
  naturalHeight = 0
  width = 0
  height = 0
  set src(v: string) {
    const size = imageSizes.get(v) ?? { w: 64, h: 64 }
    queueMicrotask(() => {
      if (v.includes('bad')) {
        this.onerror?.()
        return
      }
      this.naturalWidth = this.width = size.w
      this.naturalHeight = this.height = size.h
      this.onload?.()
    })
  }
}

async function flushMicro(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve()
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

function setup(layerState = '{}', capturedImage = '') {
  const node = makeNode(layerState, capturedImage)
  let s!: LayerEditorController
  const wrapper = mount(
    defineComponent({
      setup() {
        s = useLayerEditorStage(node)
        return () => null
      },
    })
  )
  wrappers.push(wrapper)
  return { node, s }
}

const V1_STATE = JSON.stringify({
  version: 1,
  width: 512,
  height: 256,
  layers: [
    {
      id: 'r1', type: 'raster', name: 'Photo', visible: true, locked: true, opacity: 0.5,
      blendMode: 'multiply', transform: { x: 10, y: 20, w: 100, h: 80, rotation: 0 },
      contentId: 'c-r1', url: 'http://x/r1.png', naturalWidth: 100, naturalHeight: 80,
      mask: { contentId: 'c-m1', url: 'http://x/m1.png', enabled: true },
    },
    {
      id: 't1', type: 'text', name: 'Title', visible: false, locked: false, opacity: 1,
      blendMode: 'source-over', transform: { x: 0, y: 0, w: 200, h: 60, rotation: 0 },
      text: 'hello', fontRef: { kind: 'builtin', id: 'inter' }, fontSize: 48,
      color: '#ffffff', letterSpacing: 0, lineHeight: 1.2, align: 'left',
    },
  ],
})

function make2dStub(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  return {
    canvas,
    fillStyle: '',
    drawImage: () => {},
    fillRect: () => {},
    fillText: () => {},
    clearRect: () => {},
    putImageData: () => {},
    getImageData: (_x: number, _y: number, w: number, h: number) => new ImageData(w, h),
    createImageData: (w: number, h: number) => new ImageData(w, h),
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
  } as unknown as CanvasRenderingContext2D
}

const origGetContext = HTMLCanvasElement.prototype.getContext

beforeEach(() => {
  vi.stubGlobal('Image', FakeImage)
  ;(HTMLCanvasElement.prototype as any).getContext = function (this: HTMLCanvasElement, kind: string) {
    return kind === '2d' ? make2dStub(this) : null
  }
  imageSizes.clear()
  fontState.font = null
  fontState.readyCbs.clear()
})

afterEach(() => {
  for (const w of wrappers) w.unmount()
  wrappers = []
  HTMLCanvasElement.prototype.getContext = origGetContext
  vi.unstubAllGlobals()
})

describe('v1 document migration', () => {
  it('loads a v1-format layer_state into the read model', () => {
    const { s } = setup(V1_STATE)
    expect(s.state.value.width).toBe(512)
    expect(s.state.value.height).toBe(256)
    expect(s.state.value.layers).toHaveLength(2)

    const [r, t] = s.state.value.layers
    expect(r).toMatchObject({ id: 'r1', type: 'raster', name: 'Photo', locked: true, opacity: 0.5, blendMode: 'multiply' })
    expect((r as any).contentId).toBe('c-r1')
    expect(r.mask).toMatchObject({ contentId: 'c-m1', enabled: true })
    expect(t).toMatchObject({ id: 't1', type: 'text', visible: false, blendMode: 'source-over' })
    expect((t as any).text).toBe('hello')
  })

  it('does not rewrite layer_state on mere load', () => {
    const { node } = setup(V1_STATE)
    expect(widgetVal(node, 'layer_state')).toBe(V1_STATE)
  })

  it('round-trips: persisted engine JSON reloads via onConfigure', () => {
    const { node, s } = setup(V1_STATE)
    s.addTextLayerAt({ x: 5, y: 5 })
    const persisted = widgetVal(node, 'layer_state')
    expect(JSON.parse(persisted).root.children).toHaveLength(3)

    node.onConfigure?.({})
    expect(s.state.value.layers).toHaveLength(3)
    expect(s.state.value.layers[0].name).toBe('Photo')
  })
})

describe('layer operations + undo (engine-backed)', () => {
  it('addTextLayerAt adds, selects, and is undoable', () => {
    const { s } = setup()
    const id = s.addTextLayerAt({ x: 30, y: 40 })
    expect(s.state.value.layers).toHaveLength(1)
    expect(s.activeId.value).toBe(id)
    expect(s.canUndo.value).toBe(true)

    s.undo()
    expect(s.state.value.layers).toHaveLength(0)
    s.redo()
    expect(s.state.value.layers).toHaveLength(1)
  })

  it('setOpacity coalesces a slider drag into one undo step', () => {
    const { s } = setup(V1_STATE)
    s.setOpacity('r1', 0.8)
    s.setOpacity('r1', 0.3)
    expect(s.state.value.layers[0].opacity).toBe(0.3)
    s.undo()
    expect(s.state.value.layers[0].opacity).toBe(0.5)
    expect(s.canUndo.value).toBe(false)
  })

  it('setBlendMode maps source-over↔normal through the engine', () => {
    const { s, node } = setup(V1_STATE)
    s.setBlendMode('t1', 'screen')
    expect(s.state.value.layers[1].blendMode).toBe('screen')
    const persisted = JSON.parse(widgetVal(node, 'layer_state'))
    expect(persisted.root.children[1].mode.blend).toBe('screen')

    s.setBlendMode('t1', 'source-over')
    expect(JSON.parse(widgetVal(node, 'layer_state')).root.children[1].mode.blend).toBe('normal')
    expect(s.state.value.layers[1].blendMode).toBe('source-over')
  })

  it('toggleVisible / toggleLock / renameLayer', () => {
    const { s } = setup(V1_STATE)
    s.toggleVisible('r1')
    expect(s.state.value.layers[0].visible).toBe(false)
    s.toggleLock('r1')
    expect(s.state.value.layers[0].locked).toBe(false)
    s.renameLayer('r1', '  New Name  ')
    expect(s.state.value.layers[0].name).toBe('New Name')
    s.undo()
    expect(s.state.value.layers[0].name).toBe('Photo')
  })

  it('moveLayer reorders and duplicateLayer offsets + selects the copy', () => {
    const { s } = setup(V1_STATE)
    s.moveLayer('r1', 1)
    expect(s.state.value.layers.map((l) => l.id)).toEqual(['t1', 'r1'])
    s.undo()
    expect(s.state.value.layers.map((l) => l.id)).toEqual(['r1', 't1'])

    s.duplicateLayer('r1')
    expect(s.state.value.layers).toHaveLength(3)
    const copy = s.state.value.layers[1]
    expect(copy.id).not.toBe('r1')
    expect(copy.transform.x).toBe(26)
    expect(s.activeId.value).toBe(copy.id)
  })

  it('removeLayer deletes and undo restores', () => {
    const { s } = setup(V1_STATE)
    s.removeLayer('t1')
    expect(s.state.value.layers.map((l) => l.id)).toEqual(['r1'])
    s.undo()
    expect(s.state.value.layers.map((l) => l.id)).toEqual(['r1', 't1'])
  })

  it('nudgeActive coalesces arrow-key nudges', () => {
    const { s } = setup(V1_STATE)
    s.setActiveLayer('r1')
    s.nudgeActive(1, 0)
    s.nudgeActive(0, 2)
    expect(s.state.value.layers[0].transform).toMatchObject({ x: 11, y: 22 })
    s.undo()
    expect(s.state.value.layers[0].transform).toMatchObject({ x: 10, y: 20 })
  })
})

describe('masks', () => {
  it('addMask attaches a luminance mask, flips paintTarget, and is undoable', () => {
    const { s } = setup(V1_STATE)
    s.addMask('t1')
    expect(s.state.value.layers[1].mask).toMatchObject({ enabled: true })
    expect(s.paintTarget.value).toBe('mask')
    s.undo()
    expect(s.state.value.layers[1].mask).toBeUndefined()
  })

  it('toggleMaskEnabled and removeMask', () => {
    const { s } = setup(V1_STATE)
    s.toggleMaskEnabled('r1')
    expect(s.state.value.layers[0].mask!.enabled).toBe(false)
    s.removeMask('r1')
    expect(s.state.value.layers[0].mask).toBeUndefined()
    expect(s.paintTarget.value).toBe('content')
  })
})

describe('text editing', () => {
  it('updateTextLayer patches, re-measures with the font, and undoes as one step', () => {
    fontState.font = { fake: true }
    measureState.value = { w: 321, h: 99 }
    const { s } = setup(V1_STATE)
    s.updateTextLayer('t1', { text: 'world', fontSize: 72 })
    const t = s.state.value.layers[1] as any
    expect(t.text).toBe('world')
    expect(t.fontSize).toBe(72)
    expect(t.transform.w).toBe(321)
    expect(t.transform.h).toBe(99)

    s.undo()
    const t2 = s.state.value.layers[1] as any
    expect(t2.text).toBe('hello')
    expect(t2.fontSize).toBe(48)
  })
})

describe('artboard + persistence', () => {
  it('setArtboardSize resizes, persists width/height widgets, and is undoable', () => {
    const { s, node } = setup(V1_STATE)
    s.setArtboardSize(800, 600)
    expect(s.state.value.width).toBe(800)
    expect(widgetVal(node, 'width')).toBe(800)
    expect(widgetVal(node, 'height')).toBe(600)
    s.undo()
    expect(s.state.value.width).toBe(512)
  })

  it('edits persist engine-format layer_state with width/height', () => {
    const { s, node } = setup()
    s.addTextLayerAt({ x: 0, y: 0 })
    const persisted = JSON.parse(widgetVal(node, 'layer_state'))
    expect(persisted.root.kind).toBe('group')
    expect(persisted.width).toBe(1024)
  })
})

describe('images', () => {
  it('addImageFromUrl creates a centred raster layer with the source url', async () => {
    imageSizes.set('http://x/pic.png', { w: 100, h: 50 })
    const { s } = setup()
    await s.addImageFromUrl('http://x/pic.png', 'Pic')
    await flushMicro()
    const l = s.state.value.layers[0] as any
    expect(l).toMatchObject({ type: 'raster', name: 'Pic', naturalWidth: 100, naturalHeight: 50 })
    expect(l.url).toBe('http://x/pic.png')
    expect(l.transform).toMatchObject({ x: (1024 - 100) / 2, y: (1024 - 50) / 2 })
  })

  it('downscales oversized images and leaves them pending upload (no url)', async () => {
    imageSizes.set('http://x/huge.png', { w: 8192, h: 4096 })
    const { s } = setup()
    await s.addImageFromUrl('http://x/huge.png', 'Huge')
    await flushMicro()
    const l = s.state.value.layers[0] as any
    expect(l.naturalWidth).toBe(4096)
    expect(l.naturalHeight).toBe(2048)
    expect(l.url).toBeUndefined()
  })
})
