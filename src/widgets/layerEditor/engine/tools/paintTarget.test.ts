import { describe, expect, it } from 'vitest'

import type { Document } from '../document'
import { DefaultContentStore } from '../impl/contentStore'
import { rasterKind } from '../kinds/raster'
import { defaultMode } from '../mode'
import type { GroupData, RasterData, Transform } from '../node'
import { displayScale, makeToLocal, resolvePaintTarget } from './paintTarget'

describe('makeToLocal (inverse of placeBitmap)', () => {
  it('maps doc → bitmap px for an axis-aligned layer, scaling to natural size', () => {
    const t: Transform = { x: 0, y: 0, w: 100, h: 100, rotation: 0 }
    const toLocal = makeToLocal(t, 50, 50)
    expect(toLocal({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
    expect(toLocal({ x: 50, y: 50 })).toEqual({ x: 25, y: 25 })
    expect(toLocal({ x: 100, y: 100 })).toEqual({ x: 50, y: 50 })
  })

  it('accounts for the layer offset', () => {
    const t: Transform = { x: 20, y: 10, w: 80, h: 80, rotation: 0 }
    const toLocal = makeToLocal(t, 80, 80)
    expect(toLocal({ x: 20, y: 10 })).toEqual({ x: 0, y: 0 })
    expect(toLocal({ x: 100, y: 90 })).toEqual({ x: 80, y: 80 })
  })

  it('inverts rotation', () => {
    const t: Transform = { x: 0, y: 0, w: 100, h: 100, rotation: Math.PI / 2 }
    const toLocal = makeToLocal(t, 100, 100)
    const c = toLocal({ x: 50, y: 50 })
    expect(c.x).toBeCloseTo(50)
    expect(c.y).toBeCloseTo(50)
  })
})

describe('displayScale', () => {
  it('is 1 at natural size, <1 when the layer is displayed enlarged', () => {
    const t: Transform = { x: 0, y: 0, w: 100, h: 100, rotation: 0 }
    expect(displayScale(t, 100, 100)).toBe(1)
    expect(displayScale(t, 50, 50)).toBe(0.5)
    expect(displayScale(t, 200, 200)).toBe(2)
  })
})

describe('resolvePaintTarget scale (brush size stays document-px on scaled layers)', () => {
  function docWith(raster: RasterData): Document {
    const root: GroupData = {
      kind: 'group', id: 'root', name: 'root', visible: true, opacity: 1,
      mode: defaultMode('normal'), transform: { x: 0, y: 0, w: 0, h: 0, rotation: 0 },
      locks: { content: false, position: false, visibility: false },
      children: [raster], passThrough: false,
    }
    return { version: 2, width: 200, height: 200, root, channels: [] }
  }

  it('scale reflects the layer display scale for content painting', () => {
    const content = new DefaultContentStore()
    const c = document.createElement('canvas')
    c.width = 50
    c.height = 50
    const cid = content.register(c)

    const raster = rasterKind.create({
      contentId: cid, naturalWidth: 50, naturalHeight: 50,
      transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0 },
    })
    const target = resolvePaintTarget(docWith(raster), content, raster.id, 'content')
    expect(target).not.toBeNull()
    expect(target!.scale).toBe(0.5)
  })
})
