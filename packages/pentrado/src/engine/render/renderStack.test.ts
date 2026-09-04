import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Compositor, CompositeInput, FBOHandle, NodeTexture } from '../compositor'
import { DefaultContentStore } from '../impl/contentStore'
import { rasterKind } from '../kinds/raster'
import { defaultMode } from '../mode'
import type { Document } from '../document'
import type { GroupData, Rect, SceneNode, Transform } from '../node'
import { registerNodeKind, type NodeKind } from '../nodeKind'
import {
  createMergeCache,
  docRectToSourceRect,
  renderDocument,
  renderDocumentCached,
  type PreviewOverride,
  type RenderDeps,
} from './renderStack'

const T: Transform = { x: 0, y: 0, w: 10, h: 10, rotation: 0 }
const LOCKS = { content: false, position: false, visibility: false }

const stubKind = {
  kind: 'stub',
  serialize: (node: SceneNode) => ({
    id: node.id,
    visible: node.visible,
    opacity: node.opacity,
    mode: node.mode,
    transform: node.transform,
  }),
  renderNode: (_node: unknown, ctx: { region: unknown }) => ({
    source: document.createElement('canvas'),
    rect: ctx.region,
    linear: false,
  }),
} as unknown as NodeKind

beforeAll(() => {
  registerNodeKind(stubKind)
  registerNodeKind(rasterKind as unknown as NodeKind)
})

function leaf(opacity = 1, visible = true, id?: string): SceneNode {
  return {
    kind: 'stub',
    id: id ?? `l${opacity}`,
    name: 'l',
    visible,
    opacity,
    mode: defaultMode('normal'),
    transform: { ...T },
    locks: { ...LOCKS },
  } as unknown as SceneNode
}

function group(children: SceneNode[], opts: Partial<GroupData> = {}): GroupData {
  return {
    kind: 'group',
    id: 'g',
    name: 'g',
    visible: true,
    opacity: 1,
    mode: defaultMode('normal'),
    transform: { ...T },
    locks: { ...LOCKS },
    children,
    passThrough: false,
    ...opts,
  }
}

function doc(children: SceneNode[]): Document {
  return { version: 2, width: 100, height: 100, root: group(children), channels: [] }
}

class FakeCompositor implements Compositor {
  composites: Array<{ inputs: CompositeInput[]; target: FBOHandle | null; region: Rect | null }> = []
  allocated: FBOHandle[] = []
  freed: number[] = []
  private nextId = 1
  init() {
    return true
  }
  resize() {}
  composite(inputs: CompositeInput[], target?: FBOHandle | null, region?: Rect) {
    this.composites.push({ inputs: [...inputs], target: target ?? null, region: region ?? null })
  }
  allocTarget(width: number, height: number): FBOHandle {
    const h = { id: this.nextId++, width, height }
    this.allocated.push(h)
    return h
  }
  freeTarget(handle: FBOHandle) {
    this.freed.push(handle.id)
  }
  targetTexture(): WebGLTexture {
    return {} as WebGLTexture
  }
  upload(): WebGLTexture {
    return {} as WebGLTexture
  }
  readback(): ImageData {
    return new ImageData(1, 1)
  }
  presentCanvas() {
    return null
  }
  async toBlob(): Promise<Blob> {
    return new Blob()
  }
  getCanvas() {
    return null
  }
  dispose() {}
}

function deps(compositor: Compositor): RenderDeps {
  return { content: new DefaultContentStore(), compositor }
}

describe('renderDocument', () => {
  it('composites visible layers bottom→top, skipping invisible / transparent', () => {
    const c = new FakeCompositor()
    renderDocument(doc([leaf(0.5), leaf(1, false), leaf(0), leaf(0.8)]), deps(c))
    expect(c.composites).toHaveLength(1)
    const { inputs, target } = c.composites[0]
    expect(target).toBeNull()
    expect(inputs.map((i) => i.opacity)).toEqual([0.5, 0.8])
  })

  it('renders a non-pass-through group into an isolated target, then blends it up', () => {
    const c = new FakeCompositor()
    const g = group([leaf(1), leaf(1)], { id: 'grp', opacity: 0.7 })
    renderDocument(doc([leaf(1), g]), deps(c))

    expect(c.composites).toHaveLength(2)
    expect(c.composites[0].inputs).toHaveLength(2)
    expect(c.composites[0].target).not.toBeNull()
    expect(c.composites[1].target).toBeNull()
    expect(c.composites[1].inputs.map((i) => i.opacity)).toEqual([1, 0.7])

    expect(c.allocated).toHaveLength(1)
    expect(c.freed).toEqual([c.allocated[0].id])
  })

  it('splices a pass-through group directly into the parent stack (no isolation target)', () => {
    const c = new FakeCompositor()
    const g = group([leaf(1), leaf(1)], { passThrough: true })
    renderDocument(doc([leaf(1), g]), deps(c))
    expect(c.composites).toHaveLength(1)
    expect(c.composites[0].inputs).toHaveLength(3)
    expect(c.allocated).toHaveLength(0)
  })

  it('emits an adjustment input with op code and packed params', () => {
    const c = new FakeCompositor()
    const adj = {
      kind: 'adjustment',
      id: 'a1',
      name: 'adj',
      visible: true,
      opacity: 0.8,
      mode: defaultMode('normal'),
      transform: { x: 0, y: 0, w: 0, h: 0, rotation: 0 },
      locks: { content: false, position: false, visibility: false },
      op: 'hue-saturation',
      params: { hue: 90, saturation: 0.5, lightness: 0 },
    } as unknown as SceneNode
    renderDocument(doc([leaf(1), adj]), deps(c))
    const inputs = c.composites[0].inputs
    expect(inputs).toHaveLength(2)
    const a = inputs[1] as { adjust: { op: number; params: number[] }; opacity: number }
    expect('adjust' in inputs[1]).toBe(true)
    expect(a.adjust.op).toBe(1)
    expect(a.adjust.params).toEqual([0.25, 0.5, 0, 0])
    expect(a.opacity).toBe(0.8)
  })

  it('forwards the damage region to the main composite only', () => {
    const c = new FakeCompositor()
    const g = group([leaf(1)], { id: 'grp' })
    const region = { x: 5, y: 6, w: 7, h: 8 }
    renderDocument(doc([leaf(1), g]), deps(c), undefined, region)
    expect(c.composites[0].target).not.toBeNull()
    expect(c.composites[0].region).toBeNull()
    expect(c.composites[1].target).toBeNull()
    expect(c.composites[1].region).toEqual(region)
  })
})

describe('paint preview overrides (quad textures)', () => {
  function previewDeps(c: Compositor, overrides: Map<string, PreviewOverride>): RenderDeps {
    return { content: new DefaultContentStore(), compositor: c, overrides }
  }

  function previewCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas')
    cv.width = 10
    cv.height = 10
    return cv
  }

  it('emits the override canvas as a versioned quad texture', () => {
    const c = new FakeCompositor()
    const overrides = new Map<string, PreviewOverride>()
    const node = leaf(1)
    const cv = previewCanvas()
    overrides.set(`content:${node.id}`, { canvas: cv, version: 1, rects: null })

    const d = previewDeps(c, overrides)
    renderDocument(doc([node]), d)
    const t1 = (c.composites[0].inputs[0] as { texture: NodeTexture }).texture
    expect(t1.key).toBe(`preview:content:${node.id}`)
    expect(t1.version).toBe(1)
    expect(t1.source).toBe(cv)
    expect(t1.quad).toEqual(node.transform)
    expect(t1.dirtyRects).toBeUndefined()

    renderDocument(doc([node]), d)
    const t2 = (c.composites[1].inputs[0] as { texture: NodeTexture }).texture
    expect(t2.version).toBe(1)
    expect(t2.source).toBe(cv)
  })

  it('a version bump with a rect flows through as a source-space dirtyRect', () => {
    const c = new FakeCompositor()
    const overrides = new Map<string, PreviewOverride>()
    const node = leaf(1)
    const cv = previewCanvas()
    const d = previewDeps(c, overrides)

    overrides.set(`content:${node.id}`, { canvas: cv, version: 1, rects: null })
    renderDocument(doc([node]), d)
    overrides.set(`content:${node.id}`, { canvas: cv, version: 2, rects: [{ x: 1, y: 2, w: 3, h: 4 }] })
    renderDocument(doc([node]), d)

    const t2 = (c.composites[1].inputs[0] as { texture: NodeTexture }).texture
    expect(t2.version).toBe(2)
    expect(t2.dirtyRects).toEqual([{ x: 0, y: 1, w: 5, h: 6 }])
  })

  it('falls back to the node kind render once the override is gone', () => {
    const c = new FakeCompositor()
    const overrides = new Map<string, PreviewOverride>()
    const node = leaf(1)
    const d = previewDeps(c, overrides)

    overrides.set(`content:${node.id}`, { canvas: previewCanvas(), version: 5, rects: null })
    renderDocument(doc([node]), d)
    expect((c.composites[0].inputs[0] as { texture: NodeTexture }).texture.version).toBe(5)

    overrides.delete(`content:${node.id}`)
    renderDocument(doc([node]), d)
    expect((c.composites[1].inputs[0] as { texture: NodeTexture }).texture.version).toBeUndefined()
  })
})

describe('merge caches (renderDocumentCached)', () => {
  function eightLeaves(): SceneNode[] {
    return Array.from({ length: 8 }, (_, i) => leaf(1, true, `n${i}`))
  }

  it('splits below/active/above into cached targets and reuses them next frame', () => {
    const c = new FakeCompositor()
    const cache = createMergeCache()
    const d = doc(eightLeaves())

    renderDocumentCached(d, deps(c), 'n3', cache)
    expect(c.composites).toHaveLength(3)
    expect(c.composites[0].target).not.toBeNull()
    expect(c.composites[0].inputs).toHaveLength(3)
    expect(c.composites[1].target).not.toBeNull()
    expect(c.composites[1].inputs).toHaveLength(4)
    expect(c.composites[2].target).toBeNull()
    expect(c.composites[2].inputs).toHaveLength(3)

    renderDocumentCached(d, deps(c), 'n3', cache)
    expect(c.composites).toHaveLength(4)
    expect(c.composites[3].target).toBeNull()
  })

  it('a change below rebuilds only the below cache', () => {
    const c = new FakeCompositor()
    const cache = createMergeCache()
    const kids = eightLeaves()
    const d = doc(kids)

    renderDocumentCached(d, deps(c), 'n3', cache)
    kids[1].opacity = 0.5
    renderDocumentCached(d, deps(c), 'n3', cache)
    expect(c.composites).toHaveLength(5)
    expect(c.composites[3].target).not.toBeNull()
    expect(c.composites[3].inputs.map((i) => i.opacity)).toEqual([1, 0.5, 1])
    expect(c.composites[4].target).toBeNull()
  })

  it('non-associative modes above disable the above cache but keep the below cache', () => {
    const c = new FakeCompositor()
    const cache = createMergeCache()
    const kids = eightLeaves()
    ;(kids[6] as { mode: unknown }).mode = { ...defaultMode('multiply') }
    const d = doc(kids)

    renderDocumentCached(d, deps(c), 'n3', cache)
    expect(c.composites).toHaveLength(2)
    expect(c.composites[0].target).not.toBeNull()
    expect(c.composites[1].target).toBeNull()
    expect(c.composites[1].inputs).toHaveLength(1 + 1 + 4)
  })

  it('an active node nested in a root group pivots on that group', () => {
    const c = new FakeCompositor()
    const cache = createMergeCache()
    const inner = leaf(1, true, 'deep')
    const kids = [...eightLeaves().slice(0, 4), group([inner], { id: 'wrap' }), ...eightLeaves().slice(4).map((n) => ({ ...n, id: `${n.id}b` }))]
    const d = doc(kids)

    renderDocumentCached(d, deps(c), 'deep', cache)
    expect(c.composites.filter((x) => x.target === null)).toHaveLength(1)
    const final = c.composites[c.composites.length - 1]
    expect(final.target).toBeNull()
    expect(final.inputs).toHaveLength(3)
  })

  it('falls back to a plain render for small documents and no active id', () => {
    const c = new FakeCompositor()
    const cache = createMergeCache()
    renderDocumentCached(doc([leaf(1), leaf(0.8)]), deps(c), null, cache)
    expect(c.composites).toHaveLength(1)
    expect(c.composites[0].target).toBeNull()
  })
})

describe('tiled raster inputs', () => {
  function tileStub() {
    return { bytes: new Uint8Array(4), uniform: null, refs: 1, gen: 1, swapId: -1, swapPending: false }
  }

  function tiledDeps(c: Compositor, tileCount: number): RenderDeps {
    const size = 1000
    const grid = {
      width: size,
      height: size,
      cols: tileCount,
      rows: 1,
      tiles: Array.from({ length: tileCount }, tileStub),
    }
    const canvas = document.createElement('canvas')
    const entry = { id: 'c1', canvas, width: size, height: size, uploadedUrl: null }
    const content = {
      get: () => entry,
      has: () => true,
      tileGridOf: () => grid,
      renderSource: () => ({ bitmap: canvas, version: 1, dirtyRects: null }),
      dirtyIds: () => [],
      markUploaded: () => {},
      collectGarbage: () => {},
      totalBytes: () => 0,
      register: () => 'c1',
    } as unknown as RenderDeps['content']
    return { content, compositor: c }
  }

  function rasterNode(): SceneNode {
    return {
      kind: 'raster',
      id: 'r1',
      name: 'r',
      visible: true,
      opacity: 1,
      mode: defaultMode('normal'),
      transform: { x: 0, y: 0, w: 1000, h: 1000, rotation: 0 },
      locks: { ...LOCKS },
      contentId: 'c1',
    } as unknown as SceneNode
  }

  it('composites straight from the tile grid when it fits the atlas', () => {
    const c = new FakeCompositor()
    renderDocument({ version: 2, width: 1000, height: 1000, root: group([rasterNode()]), channels: [] }, tiledDeps(c, 16))
    expect('tiles' in c.composites[0].inputs[0]).toBe(true)
  })

  it('falls back to the dense path when one grid exceeds atlas capacity', () => {
    const c = new FakeCompositor()
    renderDocument({ version: 2, width: 1000, height: 1000, root: group([rasterNode()]), channels: [] }, tiledDeps(c, 1801))
    const input = c.composites[0].inputs[0]
    expect('tiles' in input).toBe(false)
    expect('texture' in input).toBe(true)
  })
})

describe('docRectToSourceRect', () => {
  it('maps through scale and offset with a one-texel pad', () => {
    const q: Transform = { x: 100, y: 100, w: 40, h: 40, rotation: 0 }
    const r = docRectToSourceRect({ x: 110, y: 120, w: 8, h: 4 }, q, 20, 20)
    expect(r).toEqual({ x: 4, y: 9, w: 6, h: 4 })
  })

  it('takes the bbox of rotated rects and clamps to the source', () => {
    const q: Transform = { x: 0, y: 0, w: 10, h: 10, rotation: Math.PI / 2 }
    const r = docRectToSourceRect({ x: 0, y: 0, w: 10, h: 10 }, q, 10, 10)
    expect(r).toEqual({ x: 0, y: 0, w: 10, h: 10 })
  })
})

describe('merge cache keeps clipping-mask runs together', () => {
  function adjClip(id: string): SceneNode {
    return {
      kind: 'adjustment', id, name: id, visible: true, opacity: 1, clip: true,
      mode: defaultMode('normal'), transform: { x: 0, y: 0, w: 0, h: 0, rotation: 0 },
      locks: { content: false, position: false, visibility: false },
      op: 'hue-saturation', params: { hue: 0, saturation: -1, lightness: 0 },
    } as unknown as SceneNode
  }
  const children = () => [leaf(1, true, 'a'), leaf(1, true, 'b'), leaf(1, true, 'base'), adjClip('adj'), leaf(1, true, 'd'), leaf(1, true, 'e'), leaf(1, true, 'f')]

  it('clipRunAround spans base and every clipped member', async () => {
    const { clipRunAround } = await import('./renderStack')
    const c = children()
    expect(clipRunAround(c, 2)).toEqual([2, 3])
    expect(clipRunAround(c, 3)).toEqual([2, 3])
    expect(clipRunAround(c, 4)).toEqual([4, 4])
    expect(clipRunAround(c, 0)).toEqual([0, 0])
  })

  for (const active of ['base', 'adj']) {
    it(`never lets a cached slice start with a clipped layer (active=${active})`, () => {
      const c = new FakeCompositor()
      const cache = createMergeCache()
      renderDocumentCached(doc(children()), deps(c), active, cache)
      const startsWithAdjust = c.composites.filter((x) => x.inputs.length && 'adjust' in (x.inputs[0] as object))
      expect(startsWithAdjust).toHaveLength(0)
      expect(cache.below).not.toBeNull()
      expect(cache.above).not.toBeNull()
    })
  }
})
