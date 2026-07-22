import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../../fontStore', () => ({
  getFontStore: () => ({
    getFontSyncWithFallback: () => ({ fake: true }),
    onFontReady: () => () => {},
  }),
}))
vi.mock('../../textRender', () => ({
  measureText: vi.fn(() => ({ w: 300, h: 90 })),
  renderTextToCanvas: vi.fn(() => document.createElement('canvas')),
  TextRenderCache: class {
    get() { return null }
    drop() {}
    clear() {}
  },
}))

import { DefaultContentStore } from '../impl/contentStore'
import type { GroupData, RasterData, TextData, VectorData } from '../node'
import { ellipsePath, rectPath } from '../vector'
import { fillKind } from './fill'
import { groupKind } from './group'
import { registerBuiltinKinds } from './index'
import { rasterKind } from './raster'
import { textKind } from './text'
import { vectorKind } from './vector'

beforeAll(() => registerBuiltinKinds())

describe('rasterKind', () => {
  it('create → normalize → serialize round-trips core fields', () => {
    const node = rasterKind.create({ name: 'A', contentId: 'c1', naturalWidth: 100, naturalHeight: 50 })
    const norm = rasterKind.normalize(rasterKind.serialize(node))
    expect(norm).toMatchObject({ kind: 'raster', name: 'A', contentId: 'c1', naturalWidth: 100, naturalHeight: 50 })
    expect(norm.transform).toMatchObject({ w: 100, h: 50 })
  })

  it('clamps opacity and defaults locks on normalize', () => {
    const n = rasterKind.normalize({ kind: 'raster', opacity: 5 })
    expect(n.opacity).toBe(1)
    expect(n.locks).toEqual({ content: false, position: false, visibility: false })
  })

  it('contentIds includes the mask content', () => {
    const node: RasterData = rasterKind.create({
      contentId: 'pix',
      mask: { id: 'm', role: 'mask', contentId: 'maskpix', enabled: true },
    })
    expect(rasterKind.contentIds(node).sort()).toEqual(['maskpix', 'pix'])
  })

  it('hitTest respects the transform box', () => {
    const node = rasterKind.create({ transform: { x: 10, y: 10, w: 20, h: 20, rotation: 0 } })
    expect(rasterKind.hitTest!(node, { x: 15, y: 15 })).toBe(true)
    expect(rasterKind.hitTest!(node, { x: 5, y: 5 })).toBe(false)
  })

  it('onTransformCommitted bakes scale into a new buffer (GIMP destructive transform)', () => {
    const orig = HTMLCanvasElement.prototype.getContext
    ;(HTMLCanvasElement.prototype as any).getContext = function (kind: string) {
      if (kind !== '2d') return null
      return {
        canvas: this,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        drawImage: () => {},
      } as unknown as CanvasRenderingContext2D
    }
    try {
      const content = new DefaultContentStore()
      const buf = document.createElement('canvas')
      buf.width = 100
      buf.height = 50
      const cid = content.register(buf, { uploadedUrl: 'http://x/a.png' })
      const node = rasterKind.create({
        contentId: cid,
        url: 'http://x/a.png',
        naturalWidth: 100,
        naturalHeight: 50,
        transform: { x: 10, y: 10, w: 100, h: 50, rotation: 0 },
      })
      const before = { ...node.transform }
      node.transform = { x: 10, y: 10, w: 200, h: 100, rotation: 0 }

      const cmd = rasterKind.onTransformCommitted!(node, before, { content })
      expect(cmd).not.toBeNull()
      expect(node.contentId).not.toBe(cid)
      expect(node.url).toBeUndefined()
      expect(node.naturalWidth).toBe(200)
      expect(node.naturalHeight).toBe(100)
      expect(node.transform).toMatchObject({ w: 200, h: 100, rotation: 0 })

      cmd!.apply('undo')
      expect(node.contentId).toBe(cid)
      expect(node.url).toBe('http://x/a.png')
      expect(node.naturalWidth).toBe(100)
      expect(node.transform).toMatchObject({ x: 10, y: 10, w: 100, h: 50 })
    } finally {
      HTMLCanvasElement.prototype.getContext = orig
    }
  })

  it('onTransformCommitted grows to the rotated bounding box (ADJUST clip policy)', () => {
    const orig = HTMLCanvasElement.prototype.getContext
    ;(HTMLCanvasElement.prototype as any).getContext = function (kind: string) {
      if (kind !== '2d') return null
      return {
        canvas: this, save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {}, drawImage: () => {},
      } as unknown as CanvasRenderingContext2D
    }
    try {
      const content = new DefaultContentStore()
      const buf = document.createElement('canvas')
      buf.width = 100
      buf.height = 100
      const cid = content.register(buf)
      const node = rasterKind.create({
        contentId: cid, naturalWidth: 100, naturalHeight: 100,
        transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0 },
      })
      const before = { ...node.transform }
      node.transform = { ...node.transform, rotation: Math.PI / 4 }
      const cmd = rasterKind.onTransformCommitted!(node, before, { content })
      expect(cmd).not.toBeNull()
      const expected = Math.ceil(100 * Math.SQRT2)
      expect(node.naturalWidth).toBeGreaterThanOrEqual(expected - 1)
      expect(node.naturalWidth).toBeLessThanOrEqual(expected + 2)
      expect(node.transform.rotation).toBe(0)
    } finally {
      HTMLCanvasElement.prototype.getContext = orig
    }
  })

  it('onTransformCommitted is a no-op for pure moves', () => {
    const content = new DefaultContentStore()
    const node = rasterKind.create({ contentId: 'c', naturalWidth: 10, naturalHeight: 10, transform: { x: 0, y: 0, w: 10, h: 10, rotation: 0 } })
    const before = { ...node.transform }
    node.transform = { ...node.transform, x: 40 }
    expect(rasterKind.onTransformCommitted!(node, before, { content })).toBeNull()
  })

  it('onTransformCommitted bakes the mask alongside the content and undo restores both', () => {
    const orig = HTMLCanvasElement.prototype.getContext
    ;(HTMLCanvasElement.prototype as any).getContext = function (kind: string) {
      if (kind !== '2d') return null
      return {
        canvas: this, fillStyle: '', save: () => {}, restore: () => {}, translate: () => {},
        rotate: () => {}, drawImage: () => {}, fillRect: () => {},
      } as unknown as CanvasRenderingContext2D
    }
    try {
      const content = new DefaultContentStore()
      const buf = document.createElement('canvas')
      buf.width = 50
      buf.height = 50
      const cid = content.register(buf)
      const maskBuf = document.createElement('canvas')
      maskBuf.width = 50
      maskBuf.height = 50
      const mid = content.register(maskBuf, { uploadedUrl: 'http://x/m.png' })
      const node = rasterKind.create({
        contentId: cid, naturalWidth: 50, naturalHeight: 50,
        transform: { x: 0, y: 0, w: 50, h: 50, rotation: 0 },
        mask: { id: 'm', role: 'mask', contentId: mid, url: 'http://x/m.png', enabled: true },
      })
      const before = { ...node.transform }
      node.transform = { ...node.transform, w: 100, h: 100 }
      const cmd = rasterKind.onTransformCommitted!(node, before, { content })
      expect(cmd).not.toBeNull()
      expect(node.mask!.contentId).not.toBe(mid)
      expect(node.mask!.url).toBeUndefined()

      cmd!.apply('undo')
      expect(node.mask!.contentId).toBe(mid)
      expect(node.mask!.url).toBe('http://x/m.png')
    } finally {
      HTMLCanvasElement.prototype.getContext = orig
    }
  })
})

describe('textKind', () => {
  it('clamps fontSize into 4..2048', () => {
    expect(textKind.normalize({ kind: 'text', fontSize: 1 }).fontSize).toBe(4)
    expect(textKind.normalize({ kind: 'text', fontSize: 99999 }).fontSize).toBe(2048)
  })

  it('falls back to a left align for invalid values', () => {
    const n: TextData = textKind.normalize({ kind: 'text', align: 'bogus' })
    expect(n.align).toBe('left')
  })

  it('onTransformCommitted scales fontSize parametrically and re-measures (undoable)', () => {
    const node = textKind.create({
      fontSize: 48,
      transform: { x: 10, y: 20, w: 200, h: 64, rotation: 0 },
    })
    const before = { ...node.transform }
    node.transform = { ...node.transform, w: 400, h: 128 }

    const cmd = textKind.onTransformCommitted!(node, before, { content: new DefaultContentStore() })
    expect(cmd).not.toBeNull()
    expect(node.fontSize).toBe(96)
    expect(node.transform.w).toBe(300)
    expect(node.transform.h).toBe(90)

    cmd!.apply('undo')
    expect(node.fontSize).toBe(48)
    expect(node.transform.h).toBe(128)
    cmd!.apply('redo')
    expect(node.fontSize).toBe(96)
    expect(node.transform.h).toBe(90)
  })

  it('onTransformCommitted is a no-op for pure moves', () => {
    const node = textKind.create({ fontSize: 48, transform: { x: 0, y: 0, w: 200, h: 64, rotation: 0 } })
    const before = { ...node.transform }
    node.transform = { ...node.transform, x: 50 }
    expect(textKind.onTransformCommitted!(node, before, { content: new DefaultContentStore() })).toBeNull()
  })
})

describe('vectorKind', () => {
  const deps = { content: new DefaultContentStore() }

  it('create derives the transform from the path inflated by half the stroke width', () => {
    const node = vectorKind.create({
      path: rectPath(10, 10, 100, 50),
      stroke: { color: '#fff', width: 8, cap: 'butt', join: 'miter' },
    })
    expect(node.transform).toEqual({ x: 6, y: 6, w: 108, h: 58, rotation: 0 })
  })

  it('serialize → normalize round-trips path and styles, re-deriving the transform', () => {
    const node = vectorKind.create({
      name: 'R',
      path: rectPath(0, 0, 40, 20),
      fill: { color: '#ff0000', rule: 'nonzero', opacity: 1 },
    })
    const norm = vectorKind.normalize(vectorKind.serialize(node))
    expect(norm.name).toBe('R')
    expect(norm.fill).toMatchObject({ color: '#ff0000' })
    expect(norm.path.strokes[0].anchors).toHaveLength(12)
    expect(norm.transform).toEqual({ x: 0, y: 0, w: 40, h: 20, rotation: 0 })
  })

  it('normalize drops malformed strokes', () => {
    const norm = vectorKind.normalize({
      kind: 'vector',
      path: { strokes: [{ anchors: [{ pos: { x: 1, y: 2 } }], closed: true }, 'junk'] },
    })
    expect(norm.path.strokes).toEqual([])
  })

  it('onTransformCommitted translates the path parametrically on move (undoable)', () => {
    const node = vectorKind.create({ path: rectPath(0, 0, 10, 10) })
    const before = { ...node.transform }
    node.transform = { ...node.transform, x: 30, y: 40 }
    const cmd = vectorKind.onTransformCommitted!(node, before, deps)
    expect(cmd).not.toBeNull()
    expect(node.path.strokes[0].anchors[1].pos).toEqual({ x: 30, y: 40 })
    expect(node.transform).toEqual({ x: 30, y: 40, w: 10, h: 10, rotation: 0 })

    cmd!.apply('undo')
    expect(node.path.strokes[0].anchors[1].pos).toEqual({ x: 0, y: 0 })
    expect(node.transform).toEqual(before)
    cmd!.apply('redo')
    expect(node.path.strokes[0].anchors[1].pos).toEqual({ x: 30, y: 40 })
  })

  it('onTransformCommitted scales anchors so the shape stays parametric', () => {
    const node = vectorKind.create({ path: ellipsePath(50, 50, 40, 20) })
    const before = { ...node.transform }
    node.transform = { x: 10, y: 30, w: 160, h: 40, rotation: 0 }
    vectorKind.onTransformCommitted!(node, before, deps)
    expect(node.transform).toEqual({ x: 10, y: 30, w: 160, h: 40, rotation: 0 })
    expect(node.path.strokes[0].anchors[4].pos).toEqual({ x: 170, y: 50 })
    expect(node.path.strokes[0].anchors[1].pos).toEqual({ x: 90, y: 30 })
  })

  it('onTransformCommitted bakes rotation into anchors and keeps transform.rotation 0', () => {
    const node = vectorKind.create({ path: rectPath(0, 0, 100, 100) })
    const before = { ...node.transform }
    node.transform = { ...node.transform, rotation: Math.PI / 2 }
    vectorKind.onTransformCommitted!(node, before, deps)
    expect(node.transform.rotation).toBe(0)
    const a = node.path.strokes[0].anchors[1].pos
    expect(a.x).toBeCloseTo(100, 5)
    expect(a.y).toBeCloseTo(0, 5)
    expect(node.transform.w).toBeCloseTo(100, 0)
  })

  it('onTransformCommitted returns null when nothing changed', () => {
    const node = vectorKind.create({ path: rectPath(0, 0, 10, 10) })
    expect(vectorKind.onTransformCommitted!(node, { ...node.transform }, deps)).toBeNull()
  })

  it('contentIds only lists the mask', () => {
    const node: VectorData = vectorKind.create({
      path: rectPath(0, 0, 10, 10),
      mask: { id: 'm', role: 'mask', contentId: 'maskpix', enabled: true },
    })
    expect(vectorKind.contentIds(node)).toEqual(['maskpix'])
  })
})

describe('fillKind', () => {
  it('create defaults to solid gray with a zero transform (canvas-wide, immovable)', () => {
    const node = fillKind.create()
    expect(node.fill).toEqual({ type: 'solid', color: '#808080' })
    expect(node.transform).toEqual({ x: 0, y: 0, w: 0, h: 0, rotation: 0 })
    expect(fillKind.bbox(node)).toEqual({ x: 0, y: 0, w: 0, h: 0 })
    expect(fillKind.hitTest!(node, { x: 1, y: 1 })).toBe(false)
  })

  it('serialize → normalize round-trips the spec and re-zeroes the transform', () => {
    const node = fillKind.create({
      fill: { type: 'linear', angle: 45, stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }] },
    })
    const raw = fillKind.serialize(node) as Record<string, unknown>
    raw.transform = { x: 9, y: 9, w: 50, h: 50, rotation: 1 }
    const norm = fillKind.normalize(raw)
    expect(norm.fill).toMatchObject({ type: 'linear', angle: 45 })
    expect(norm.transform).toEqual({ x: 0, y: 0, w: 0, h: 0, rotation: 0 })
  })

  it('contentIds only lists the mask', () => {
    const node = fillKind.create({
      mask: { id: 'm', role: 'mask', contentId: 'maskpix', enabled: true },
    })
    expect(fillKind.contentIds(node)).toEqual(['maskpix'])
  })
})

describe('groupKind', () => {
  it('normalizes children recursively through the registry, dropping unknown kinds', () => {
    const g: GroupData = groupKind.normalize({
      kind: 'group',
      children: [
        { kind: 'raster', contentId: 'a' },
        { kind: 'mystery', contentId: 'x' },
        { kind: 'text', text: 'hi' },
      ],
    })
    expect(g.children.map((c) => c.kind)).toEqual(['raster', 'text'])
  })

  it('contentIds recurses into children', () => {
    const g = groupKind.create({
      children: [rasterKind.create({ contentId: 'a' }), rasterKind.create({ contentId: 'b' })],
    })
    expect(groupKind.contentIds(g).sort()).toEqual(['a', 'b'])
  })

  it('bbox is the union of child boxes', () => {
    const g = groupKind.create({
      children: [
        rasterKind.create({ transform: { x: 0, y: 0, w: 10, h: 10, rotation: 0 } }),
        rasterKind.create({ transform: { x: 20, y: 20, w: 10, h: 10, rotation: 0 } }),
      ],
    })
    expect(groupKind.bbox(g)).toEqual({ x: 0, y: 0, w: 30, h: 30 })
  })
})
