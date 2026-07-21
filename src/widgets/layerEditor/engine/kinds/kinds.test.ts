import { beforeAll, describe, expect, it } from 'vitest'

import type { GroupData, RasterData, TextData } from '../node'
import { groupKind } from './group'
import { registerBuiltinKinds } from './index'
import { rasterKind } from './raster'
import { textKind } from './text'

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
