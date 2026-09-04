import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

const fontState = vi.hoisted(() => ({
  font: null as Record<string, unknown> | null,
  readyCbs: new Set<() => void>(),
}))
vi.mock('../fontStore', () => ({
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
vi.mock('../textRender', () => ({
  measureText: vi.fn(() => ({ ...measureState.value })),
  renderTextToCanvas: vi.fn(() => document.createElement('canvas')),
  TextRenderCache: class {
    get() { return null }
    drop() {}
    clear() {}
  },
}))

import { useLayerEditorStage, type LayerEditorController } from './useLayerEditorStage'
import { FakeImage, V1_STATE, flushMicro, imageSizes, make2dStub, makeNode, nodeStorage, setWidgetVal, widgetVal } from './stageTestHarness'

let wrappers: VueWrapper[] = []

function setup(layerState = '{}', capturedImage = '') {
  const node = makeNode(layerState, capturedImage)
  let s!: LayerEditorController
  const wrapper = mount(
    defineComponent({
      setup() {
        s = useLayerEditorStage({ storage: nodeStorage(node), instanceId: node.id })
        node.onConfigure = () => s.reload()
        return () => null
      },
    })
  )
  wrappers.push(wrapper)
  return { node, s }
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
    s.flushPersist()
    expect(s.canvasSize.value.width).toBe(800)
    expect(widgetVal(node, 'width')).toBe(800)
    expect(widgetVal(node, 'height')).toBe(600)
    s.undo()
    expect(s.canvasSize.value.width).toBe(512)
  })

  it('edits persist engine-format layer_state with width/height', () => {
    const { s, node } = setup()
    s.addTextLayerAt({ x: 0, y: 0 })
    s.flushPersist()
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

  it('never treats a data: url as already uploaded', async () => {
    const dataUrl = 'data:image/png;base64,AAAA'
    imageSizes.set(dataUrl, { w: 100, h: 50 })
    const { s } = setup()
    await s.addImageFromUrl(dataUrl, 'Pasted')
    await flushMicro()
    const l = nodes(s)[0]
    expect(l.naturalWidth).toBe(100)
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
