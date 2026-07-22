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
  const nodes = (s: LayerEditorController) => s.layers.value.map((r) => r.node as any)

  it('loads a v1-format layer_state into engine nodes', () => {
    const { s } = setup(V1_STATE)
    expect(s.canvasSize.value.width).toBe(512)
    expect(s.canvasSize.value.height).toBe(256)
    expect(s.layers.value).toHaveLength(2)

    const [r, t] = nodes(s)
    expect(r).toMatchObject({ id: 'r1', kind: 'raster', name: 'Photo', opacity: 0.5 })
    expect(r.locks.content).toBe(true)
    expect(r.mode.blend).toBe('multiply')
    expect(r.contentId).toBe('c-r1')
    expect(r.mask).toMatchObject({ contentId: 'c-m1', enabled: true })
    expect(t).toMatchObject({ id: 't1', kind: 'text', visible: false, text: 'hello' })
    expect(t.mode.blend).toBe('normal')
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
    expect(s.layers.value).toHaveLength(3)
    expect(s.layers.value[0].node.name).toBe('Photo')
  })
})

describe('layer operations + undo (engine-backed)', () => {
  const nodes = (s: LayerEditorController) => s.layers.value.map((r) => r.node as any)

  it('addTextLayerAt adds, selects, and is undoable', () => {
    const { s } = setup()
    const id = s.addTextLayerAt({ x: 30, y: 40 })
    expect(s.layers.value).toHaveLength(1)
    expect(s.activeId.value).toBe(id)
    expect(s.canUndo.value).toBe(true)

    s.undo()
    expect(s.layers.value).toHaveLength(0)
    s.redo()
    expect(s.layers.value).toHaveLength(1)
  })

  it('setOpacity coalesces a slider drag into one undo step', () => {
    const { s } = setup(V1_STATE)
    s.setOpacity('r1', 0.8)
    s.setOpacity('r1', 0.3)
    expect(nodes(s)[0].opacity).toBe(0.3)
    s.undo()
    expect(nodes(s)[0].opacity).toBe(0.5)
    expect(s.canUndo.value).toBe(false)
  })

  it('setBlendMode uses engine mode names end to end', () => {
    const { s, node } = setup(V1_STATE)
    s.setBlendMode('t1', 'screen')
    expect(nodes(s)[1].mode.blend).toBe('screen')
    const persisted = JSON.parse(widgetVal(node, 'layer_state'))
    expect(persisted.root.children[1].mode.blend).toBe('screen')

    s.setBlendMode('t1', 'luminosity')
    expect(JSON.parse(widgetVal(node, 'layer_state')).root.children[1].mode.blend).toBe('luminosity')
  })

  it('toggleVisible / toggleLock / renameLayer', () => {
    const { s } = setup(V1_STATE)
    s.toggleVisible('r1')
    expect(nodes(s)[0].visible).toBe(false)
    s.toggleLock('r1')
    expect(nodes(s)[0].locks.content).toBe(false)
    s.renameLayer('r1', '  New Name  ')
    expect(nodes(s)[0].name).toBe('New Name')
    s.undo()
    expect(nodes(s)[0].name).toBe('Photo')
  })

  it('moveLayer reorders and duplicateLayer offsets + selects the copy', () => {
    const { s } = setup(V1_STATE)
    s.moveLayer('r1', 1)
    expect(nodes(s).map((l) => l.id)).toEqual(['t1', 'r1'])
    s.undo()
    expect(nodes(s).map((l) => l.id)).toEqual(['r1', 't1'])

    s.duplicateLayer('r1')
    expect(s.layers.value).toHaveLength(3)
    const copy = nodes(s)[1]
    expect(copy.id).not.toBe('r1')
    expect(copy.transform.x).toBe(26)
    expect(s.activeId.value).toBe(copy.id)
  })

  it('removeLayer deletes and undo restores', () => {
    const { s } = setup(V1_STATE)
    s.removeLayer('t1')
    expect(nodes(s).map((l) => l.id)).toEqual(['r1'])
    s.undo()
    expect(nodes(s).map((l) => l.id)).toEqual(['r1', 't1'])
  })

  it('nudgeActive coalesces arrow-key nudges', () => {
    const { s } = setup(V1_STATE)
    s.setActiveLayer('r1')
    s.nudgeActive(1, 0)
    s.nudgeActive(0, 2)
    expect(nodes(s)[0].transform).toMatchObject({ x: 11, y: 22 })
    s.undo()
    expect(nodes(s)[0].transform).toMatchObject({ x: 10, y: 20 })
  })
})

describe('groups', () => {
  const rows = (s: LayerEditorController) =>
    s.layers.value.map((r) => ({ id: r.node.id, depth: r.depth, parentId: r.parentId }))

  it('groupActiveLayer wraps the active layer and ungroup dissolves it (undoable)', () => {
    const { s } = setup(V1_STATE)
    s.setActiveLayer('r1')
    s.groupActiveLayer()
    expect(s.layers.value).toHaveLength(3)
    const groupRow = s.layers.value.find((r) => r.node.kind === 'group')!
    expect(groupRow.depth).toBe(0)
    expect(rows(s).find((r) => r.id === 'r1')).toMatchObject({ depth: 1, parentId: groupRow.node.id })
    expect(s.activeId.value).toBe(groupRow.node.id)

    s.undo()
    expect(s.layers.value.map((r) => r.node.id)).toEqual(['r1', 't1'])

    s.redo()
    s.ungroupActiveLayer()
    expect(s.layers.value.map((r) => r.node.id)).toEqual(['r1', 't1'])
    expect(rows(s)[0]).toMatchObject({ depth: 0, parentId: undefined })
  })

  it('moveLayer traverses group boundaries (enter, exit)', () => {
    const { s } = setup(V1_STATE)
    s.setActiveLayer('t1')
    s.groupActiveLayer()
    const groupId = s.activeId.value!

    s.moveLayer('r1', 1)
    expect(rows(s).find((r) => r.id === 'r1')).toMatchObject({ depth: 1, parentId: groupId })

    s.moveLayer('r1', 1)
    expect(rows(s).find((r) => r.id === 'r1')).toMatchObject({ depth: 1, parentId: groupId })

    s.moveLayer('r1', 1)
    expect(rows(s).find((r) => r.id === 'r1')).toMatchObject({ depth: 0, parentId: undefined })
  })

  it('moveLayerRelative maps above/below/into like GIMP get_drop_index', () => {
    const { s } = setup(V1_STATE)
    s.setActiveLayer('t1')
    s.groupActiveLayer()
    const groupId = s.activeId.value!

    s.moveLayerRelative('r1', groupId, 'into')
    expect(rows(s).find((r) => r.id === 'r1')).toMatchObject({ depth: 1, parentId: groupId })

    s.moveLayerRelative('r1', 't1', 'above')
    const inGroup = s.layers.value.filter((r) => r.parentId === groupId).map((r) => r.node.id)
    expect(inGroup).toEqual(['t1', 'r1'])

    s.moveLayerRelative('r1', groupId, 'below')
    expect(rows(s).find((r) => r.id === 'r1')).toMatchObject({ depth: 0, parentId: undefined })
    expect(s.layers.value.map((r) => r.node.id)[0]).toBe('r1')

    s.moveLayerRelative('r1', null, 'below')
    expect(s.layers.value.map((r) => r.node.id)[0]).toBe('r1')
  })

  it('refuses to drop a group into its own descendant', () => {
    const { s } = setup(V1_STATE)
    s.setActiveLayer('t1')
    s.groupActiveLayer()
    const outer = s.activeId.value!
    s.setActiveLayer('t1')
    s.groupActiveLayer()
    const inner = s.activeId.value!
    expect(inner).not.toBe(outer)

    s.moveLayerRelative(outer, inner, 'into')
    expect(rows(s).find((r) => r.id === outer)).toMatchObject({ depth: 0, parentId: undefined })
    s.moveLayerRelative(outer, outer, 'into')
    expect(rows(s).find((r) => r.id === outer)).toMatchObject({ depth: 0, parentId: undefined })
  })

  it('duplicating a group regenerates ids recursively', () => {
    const { s } = setup(V1_STATE)
    s.setActiveLayer('r1')
    s.groupActiveLayer()
    const groupId = s.activeId.value!
    s.duplicateLayer(groupId)
    const ids = s.layers.value.map((r) => r.node.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(s.layers.value.filter((r) => r.node.kind === 'group')).toHaveLength(2)
  })
})

describe('masks', () => {
  const nodes = (s: LayerEditorController) => s.layers.value.map((r) => r.node as any)

  it('addMask attaches a luminance mask, flips paintTarget, and is undoable', () => {
    const { s } = setup(V1_STATE)
    s.addMask('t1')
    expect(nodes(s)[1].mask).toMatchObject({ enabled: true })
    expect(s.paintTarget.value).toBe('mask')
    s.undo()
    expect(nodes(s)[1].mask).toBeUndefined()
  })

  it('toggleMaskEnabled and removeMask', () => {
    const { s } = setup(V1_STATE)
    s.toggleMaskEnabled('r1')
    expect(nodes(s)[0].mask!.enabled).toBe(false)
    s.removeMask('r1')
    expect(nodes(s)[0].mask).toBeUndefined()
    expect(s.paintTarget.value).toBe('content')
  })
})

describe('text editing', () => {
  it('updateTextLayer patches, re-measures with the font, and undoes as one step', () => {
    fontState.font = { fake: true }
    measureState.value = { w: 321, h: 99 }
    const { s } = setup(V1_STATE)
    s.updateTextLayer('t1', { text: 'world', fontSize: 72 })
    const t = s.layers.value[1].node as any
    expect(t.text).toBe('world')
    expect(t.fontSize).toBe(72)
    expect(t.transform.w).toBe(321)
    expect(t.transform.h).toBe(99)

    s.undo()
    const t2 = s.layers.value[1].node as any
    expect(t2.text).toBe('hello')
    expect(t2.fontSize).toBe(48)
  })
})

describe('artboard + persistence', () => {
  it('setArtboardSize resizes, persists width/height widgets, and is undoable', () => {
    const { s, node } = setup(V1_STATE)
    s.setArtboardSize(800, 600)
    expect(s.canvasSize.value.width).toBe(800)
    expect(widgetVal(node, 'width')).toBe(800)
    expect(widgetVal(node, 'height')).toBe(600)
    s.undo()
    expect(s.canvasSize.value.width).toBe(512)
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
  const nodes = (s: LayerEditorController) => s.layers.value.map((r) => r.node as any)

  it('addImageFromUrl creates a centred raster layer with the source url', async () => {
    imageSizes.set('http://x/pic.png', { w: 100, h: 50 })
    const { s } = setup()
    await s.addImageFromUrl('http://x/pic.png', 'Pic')
    await flushMicro()
    const l = nodes(s)[0]
    expect(l).toMatchObject({ kind: 'raster', name: 'Pic', naturalWidth: 100, naturalHeight: 50 })
    expect(l.url).toBe('http://x/pic.png')
    expect(l.transform).toMatchObject({ x: (1024 - 100) / 2, y: (1024 - 50) / 2 })
  })

  it('downscales oversized images and leaves them pending upload (no url)', async () => {
    imageSizes.set('http://x/huge.png', { w: 8192, h: 4096 })
    const { s } = setup()
    await s.addImageFromUrl('http://x/huge.png', 'Huge')
    await flushMicro()
    const l = nodes(s)[0]
    expect(l.naturalWidth).toBe(4096)
    expect(l.naturalHeight).toBe(2048)
    expect(l.url).toBeUndefined()
  })

  it('floats onto an existing layer stack instead of creating a layer per image', async () => {
    imageSizes.set('http://x/a.png', { w: 60, h: 40 })
    imageSizes.set('http://x/b.png', { w: 20, h: 20 })
    const { s } = setup()
    await s.addImageFromUrl('http://x/a.png', 'A')
    await flushMicro()
    expect(s.layers.value).toHaveLength(1)
    expect(s.floating.value).toBeNull()

    await s.addImageFromUrl('http://x/b.png', 'B')
    await flushMicro()
    expect(s.layers.value).toHaveLength(1)
    expect(s.floating.value).not.toBeNull()
    expect(s.floating.value!.transform).toMatchObject({ w: 20, h: 20, rotation: 0 })

    s.anchorFloating('new')
    expect(s.floating.value).toBeNull()
    expect(s.layers.value).toHaveLength(2)
    expect(s.layers.value[1].node.name).toBe('B')
  })

  it('cancelFloating discards the pending image', async () => {
    imageSizes.set('http://x/a.png', { w: 60, h: 40 })
    imageSizes.set('http://x/b.png', { w: 20, h: 20 })
    const { s } = setup()
    await s.addImageFromUrl('http://x/a.png', 'A')
    await flushMicro()
    await s.addImageFromUrl('http://x/b.png', 'B')
    await flushMicro()
    s.cancelFloating()
    expect(s.floating.value).toBeNull()
    expect(s.layers.value).toHaveLength(1)
  })

  it('addEmptyLayer creates a canvas-sized transparent layer', () => {
    const { s } = setup(V1_STATE)
    s.addEmptyLayer()
    expect(s.layers.value).toHaveLength(3)
    const l = nodes(s)[2]
    expect(l).toMatchObject({ kind: 'raster', naturalWidth: 512, naturalHeight: 256 })
    expect(l.transform).toMatchObject({ x: 0, y: 0, w: 512, h: 256 })
  })
})
