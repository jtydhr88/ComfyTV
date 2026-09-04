import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

vi.mock('../fontStore', () => ({
  getFontStore: () => ({
    builtins: () => [],
    getFontSync: () => null,
    getFontSyncWithFallback: () => null,
    hasFailed: () => false,
    onFontReady: () => () => {},
  }),
}))

vi.mock('../textRender', () => ({
  measureText: vi.fn(() => ({ w: 200, h: 60 })),
  renderTextToCanvas: vi.fn(() => document.createElement('canvas')),
  TextRenderCache: class {
    get() { return null }
    drop() {}
    clear() {}
  },
}))

import { createLayerEditorOps, LAYER_OPS, type LayerEditorOps } from './layerEditorOps'
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
      if (v.includes('bad')) { this.onerror?.(); return }
      this.naturalWidth = this.width = size.w
      this.naturalHeight = this.height = size.h
      this.onload?.()
    })
  }
}

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
let wrappers: VueWrapper[] = []

beforeEach(() => {
  vi.stubGlobal('Image', FakeImage)
  ;(HTMLCanvasElement.prototype as any).getContext = function (this: HTMLCanvasElement, kind: string) {
    return kind === '2d' ? make2dStub(this) : null
  }
  imageSizes.clear()
})

afterEach(() => {
  for (const w of wrappers) w.unmount()
  wrappers = []
  HTMLCanvasElement.prototype.getContext = origGetContext
  vi.unstubAllGlobals()
})

function layerById(st: any, id: string | undefined): any {
  const stack = [...st.layers]
  while (stack.length) {
    const n = stack.pop()
    if (n.id === id) return n
    if (n.children) stack.push(...n.children)
  }
  return undefined
}

function setup(): { s: LayerEditorController; ops: LayerEditorOps; state: () => any } {
  let state = '{}'
  const storage = {
    subfolder: 'x',
    readState: () => state,
    writeState: (json: string) => { state = json },
    readCapturedImage: () => '',
    beginCapture: () => () => {},
    commitBatch: () => {},
  }
  let s!: LayerEditorController
  const wrapper = mount(defineComponent({
    setup() {
      s = useLayerEditorStage({ storage, instanceId: 't' })
      return () => null
    },
  }))
  wrappers.push(wrapper)
  const ops = createLayerEditorOps(s)
  return { s, ops, state: () => ops.getState() }
}

describe('layer editor ops', () => {
  it('resources lists every op and the parameter catalogs', () => {
    const { ops } = setup()
    const r = ops.resources() as any
    expect(r.ops).toEqual([...LAYER_OPS])
    expect(r.blend_modes).toContain('multiply')
    expect(Object.keys(r.adjustment_ops)).toContain('hue-saturation')
    expect(Object.keys(r.fx_ops)).toContain('drop-shadow')
    expect(Object.keys(r.filter_ops)).toContain('gaussian-blur')
    expect(r.canvas_limits.min).toBeGreaterThan(0)
  })

  it('add_image creates a layer and a second image anchors as its own layer', async () => {
    imageSizes.set('http://x/a.png', { w: 100, h: 50 })
    imageSizes.set('http://x/b.png', { w: 30, h: 30 })
    const { ops, state } = setup()
    const [a] = await ops.applyOps([{ op: 'add_image', url: 'http://x/a.png', name: 'A' }])
    expect(a.id).toBeTruthy()
    const [b] = await ops.applyOps([{ op: 'add_image', url: 'http://x/b.png', name: 'B' }])
    expect(b.id).toBeTruthy()
    expect(b.id).not.toBe(a.id)
    const st = state()
    expect(st.floating).toBe(false)
    expect(st.layers.map((l: any) => l.name)).toEqual(['A', 'B'])
    expect(st.layers[0]).toMatchObject({ kind: 'raster', url: 'http://x/a.png', natural: { width: 100, height: 50 } })
  })

  it('edits layer properties and reports them back through getState', async () => {
    const { ops, state } = setup()
    const [{ id }] = await ops.applyOps([{ op: 'add_layer', name: 'Base' }])
    await ops.applyOps([
      { op: 'set_opacity', id, opacity: 0.4 },
      { op: 'set_blend', id, blend: 'multiply' },
      { op: 'set_visible', id, visible: false },
      { op: 'rename', id, name: 'Renamed' },
      { op: 'set_lock', id, position: true },
    ])
    const l = layerById(state(), id)
    expect(l).toMatchObject({ id, name: 'Renamed', opacity: 0.4, blend: 'multiply', visible: false })
    expect(l.locks.position).toBe(true)
    await expect(ops.applyOps([{ op: 'set_transform', id, x: 5 }])).rejects.toThrow(/position-locked/)
    await ops.applyOps([{ op: 'set_lock', id, position: false }, { op: 'set_transform', id, x: 5, y: 7, w: 300 }])
    expect(layerById(state(), id).transform).toMatchObject({ x: 5, y: 7, w: 300 })
  })

  it('adjustment, fx and text ops round-trip', async () => {
    const { ops, state } = setup()
    const [{ id: adj }] = await ops.applyOps([{ op: 'add_adjustment', kind: 'hue-saturation', params: { hue: 40 } }])
    await ops.applyOps([{ op: 'set_adjustment', id: adj, params: { saturation: -0.2 } }])
    expect(layerById(state(), adj).adjustment).toMatchObject({ op: 'hue-saturation', params: { hue: 40, saturation: -0.2 } })

    await ops.applyOps([{ op: 'set_fx', id: adj, fx: [{ op: 'drop-shadow', params: { x: 12 } }] }])
    const fx = layerById(state(), adj).fx
    expect(fx).toHaveLength(1)
    expect(fx[0]).toMatchObject({ op: 'drop-shadow', enabled: true, params: { x: 12, y: 8 } })

    const [{ id: text }] = await ops.applyOps([{ op: 'add_text', text: 'Hello', x: 10, y: 20, font_size: 72, align: 'center' }])
    await ops.applyOps([{ op: 'update_text', id: text, text: 'Bye', color: '#ff0000' }])
    expect(layerById(state(), text)).toMatchObject({ kind: 'text', text: 'Bye', font_size: 72, color: '#ff0000', align: 'center' })
  })

  it('structure ops: group, move, duplicate, remove, undo', async () => {
    const { ops, state } = setup()
    const [{ id: a }] = await ops.applyOps([{ op: 'add_layer', name: 'A' }])
    const [{ id: b }] = await ops.applyOps([{ op: 'add_layer', name: 'B' }])
    const [{ id: g }] = await ops.applyOps([{ op: 'group', ids: [a, b] }])
    expect(g).toBeTruthy()
    expect(state().layers[0].kind).toBe('group')
    expect(state().layers[0].children.map((c: any) => c.id).sort()).toEqual([a, b].sort())

    await ops.applyOps([{ op: 'ungroup', id: g }])
    expect(state().layers.map((l: any) => l.kind)).toEqual(['raster', 'raster'])

    const [, { id: dup }] = await ops.applyOps([{ op: 'select', ids: [a] }, { op: 'duplicate', id: a }])
    expect(dup).toBeTruthy()
    expect(state().layers).toHaveLength(3)

    await ops.applyOps([{ op: 'remove', id: dup }])
    expect(state().layers).toHaveLength(2)
    expect(state().can_undo).toBe(true)
    await ops.applyOps([{ op: 'undo' }])
    expect(state().layers).toHaveLength(3)
  })

  it('canvas size and selection ops', async () => {
    const { ops, state } = setup()
    await ops.applyOps([{ op: 'set_canvas_size', width: 640, height: 480 }])
    expect(state().canvas).toEqual({ width: 640, height: 480 })
    await expect(ops.applyOps([{ op: 'set_canvas_size', width: 1, height: 1 }])).rejects.toThrow(/canvas size/)
    await ops.applyOps([{ op: 'add_layer' }, { op: 'select_all' }])
    expect(state().has_selection).toBe(true)
    await ops.applyOps([{ op: 'select_none' }])
    expect(state().has_selection).toBe(false)
  })

  it('reports the failing op index and leaves earlier ops applied', async () => {
    const { ops, state } = setup()
    await expect(ops.applyOps([
      { op: 'add_layer', name: 'kept' },
      { op: 'set_opacity', id: 'nope', opacity: 1 },
    ])).rejects.toThrow(/ops\[1\] set_opacity: layer 'nope' not found/)
    expect(state().layers.map((l: any) => l.name)).toEqual(['kept'])
    await expect(ops.applyOps([{ op: 'explode' } as any])).rejects.toThrow(/op must be one of/)
    const [{ id }] = await ops.applyOps([{ op: 'add_adjustment', kind: 'exposure' }])
    await expect(ops.applyOps([{ op: 'set_adjustment', id, params: { gamma: 1 } }])).rejects.toThrow(/valid keys/)
    await expect(ops.applyOps([{ op: 'add_adjustment', kind: 'hue-saturation', params: { saturation: 35 } }])).rejects.toThrow(/outside its range -1\.\.1/)
    await expect(ops.applyOps([{ op: 'set_fx', id, fx: [{ op: 'drop-shadow', params: { distance: 3 } }] }])).rejects.toThrow(/fx\[0\]\.params\.distance/)
    await expect(ops.applyOps([])).rejects.toThrow(/non-empty/)
  })
})

describe('place and add_asset', () => {
  it('place fits a raster layer into a box: contain, cover (with mask crop) and stretch', async () => {
    imageSizes.set('http://x/wide.png', { w: 200, h: 100 })
    const { ops, state } = setup()
    const [{ id }] = await ops.applyOps([{ op: 'add_image', url: 'http://x/wide.png', name: 'Wide' }])
    let [r] = await ops.applyOps([{ op: 'place', id, x: 0, y: 0, w: 100, h: 100 }])
    expect(r.transform).toMatchObject({ x: 0, y: 25, w: 100, h: 50 })
    expect(r.cropped).toBeUndefined()
    ;[r] = await ops.applyOps([{ op: 'place', id, x: 100, y: 0, w: 100, h: 100, fit: 'cover' }])
    expect(r.transform).toMatchObject({ x: 50, y: 0, w: 200, h: 100 })
    expect(r.cropped).toBe(true)
    expect(layerById(state(), id).mask).toBeTruthy()
    ;[r] = await ops.applyOps([{ op: 'place', id, x: 0, y: 0, w: 300, h: 60, fit: 'stretch', align_x: 0, align_y: 1 }])
    expect(r.transform).toMatchObject({ x: 0, y: 0, w: 300, h: 60 })
    await expect(ops.applyOps([{ op: 'place', id, x: 0, y: 0, w: 0, h: 10 }])).rejects.toThrow(/positive/)
    await expect(ops.applyOps([{ op: 'place', id, x: 0, y: 0, w: 10, h: 10, fit: 'zoom' }])).rejects.toThrow(/fit must be one of/)
  })

  it('add_asset resolves through the host asset interface', async () => {
    imageSizes.set('http://x/asset7.png', { w: 40, h: 30 })
    const { s, ops, state } = setup()
    await expect(ops.applyOps([{ op: 'add_asset', asset_id: 7 }])).rejects.toThrow(/no asset library/)
    ;(s.host as any).resolveAsset = async (id: number | string) =>
      id === 7 ? { url: 'http://x/asset7.png', name: 'Seven', mime: 'image/png' } : null
    await expect(ops.applyOps([{ op: 'add_asset', asset_id: 8 }])).rejects.toThrow(/not found/)
    const [r] = await ops.applyOps([{ op: 'add_asset', asset_id: 7 }])
    expect(r.id).toBeTruthy()
    expect(r.asset).toEqual({ id: 7, url: 'http://x/asset7.png' })
    expect(layerById(state(), r.id)).toMatchObject({ name: 'Seven', natural: { width: 40, height: 30 } })
  })
})
