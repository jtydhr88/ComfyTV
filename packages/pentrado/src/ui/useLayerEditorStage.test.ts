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
    s.flushPersist()
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
    s.flushPersist()
    expect(nodes(s)[1].mode.blend).toBe('screen')
    const persisted = JSON.parse(widgetVal(node, 'layer_state'))
    expect(persisted.root.children[1].mode.blend).toBe('screen')

    s.setBlendMode('t1', 'luminosity')
    s.flushPersist()
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

  it('toggleLockAll sets and clears content+position as one undoable step', () => {
    const { s } = setup(V1_STATE)
    s.toggleLock('r1')
    expect(nodes(s)[0].locks.content).toBe(false)
    s.toggleLockAll('r1')
    expect(nodes(s)[0].locks).toMatchObject({ content: true, position: true })
    s.toggleLockAll('r1')
    expect(nodes(s)[0].locks).toMatchObject({ content: false, position: false })
    s.undo()
    expect(nodes(s)[0].locks).toMatchObject({ content: true, position: true })
  })

  it('removeLayer refuses a fully locked layer (PS behavior)', () => {
    const { s } = setup(V1_STATE)
    s.toggleLockAll('t1')
    s.removeLayer('t1')
    expect(s.layers.value).toHaveLength(2)
    s.toggleLockAll('t1')
    s.removeLayer('t1')
    expect(s.layers.value).toHaveLength(1)
  })

  it('nudgeActive respects the position lock', () => {
    const { s } = setup(V1_STATE)
    s.setActiveLayer('t1')
    const before = (nodes(s)[1].transform as { x: number }).x
    s.toggleLockPosition('t1')
    s.nudgeActive(5, 0)
    expect((nodes(s)[1].transform as { x: number }).x).toBe(before)
    s.toggleLockPosition('t1')
    s.nudgeActive(5, 0)
    expect((nodes(s)[1].transform as { x: number }).x).toBe(before + 5)
  })

  it('moveLayer reorders and duplicateLayer copies in place + selects the copy', () => {
    const { s } = setup(V1_STATE)
    s.moveLayer('r1', 1)
    expect(nodes(s).map((l) => l.id)).toEqual(['t1', 'r1'])
    s.undo()
    expect(nodes(s).map((l) => l.id)).toEqual(['r1', 't1'])

    s.duplicateLayer('r1')
    expect(s.layers.value).toHaveLength(3)
    const copy = nodes(s)[1]
    expect(copy.id).not.toBe('r1')
    expect(copy.transform.x).toBe(nodes(s)[0].transform.x)
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
