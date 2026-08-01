import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { History } from '../history'
import { DefaultContentStore } from '../impl/contentStore'
import { rasterKind } from '../kinds/raster'
import { defaultMode, resolveMode } from '../mode'
import type { GroupData, RasterData, SceneNode } from '../node'
import { alphaBBox, compositePair, mergeDown, type LayerOpDeps } from './layerOps'

function make2dStub(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  return {
    canvas,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    drawImage: () => {},
    putImageData: () => {},
    getImageData: (_x: number, _y: number, w: number, h: number) => new ImageData(w, h),
    createImageData: (w: number, h: number) => new ImageData(w, h),
  } as unknown as CanvasRenderingContext2D
}

const origGetContext = HTMLCanvasElement.prototype.getContext

beforeEach(() => {
  ;(HTMLCanvasElement.prototype as any).getContext = function (kind: string) {
    return kind === '2d' ? make2dStub(this) : null
  }
})

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = origGetContext
})

function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function root(children: SceneNode[]): GroupData {
  return {
    kind: 'group', id: 'root', name: 'root', visible: true, opacity: 1,
    mode: defaultMode('normal'), transform: { x: 0, y: 0, w: 0, h: 0, rotation: 0 },
    locks: { content: false, position: false, visibility: false }, children, passThrough: false,
  }
}

describe('alphaBBox', () => {
  it('finds the opaque content bounds', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4)
    const set = (x: number, y: number) => (data[(y * 4 + x) * 4 + 3] = 255)
    set(1, 1)
    set(2, 3)
    expect(alphaBBox(data, 4, 4)).toEqual({ x: 1, y: 1, w: 2, h: 3 })
  })

  it('returns null for a fully transparent buffer', () => {
    expect(alphaBBox(new Uint8ClampedArray(4 * 4 * 4), 4, 4)).toBeNull()
  })
})

describe('compositePair', () => {
  it('normal/normal fast path composites straight alpha in linear light', () => {
    const bottom = Uint8ClampedArray.of(255, 0, 0, 255)
    const top = Uint8ClampedArray.of(0, 0, 255, 128)
    const out = compositePair(
      { data: bottom, mask: null, mode: resolveMode(defaultMode('normal')), opacity: 1 },
      { data: top, mask: null, mode: resolveMode(defaultMode('normal')), opacity: 1 },
      1
    )
    expect(out[3]).toBe(255)
    expect(out[2]).toBeGreaterThan(100)
    expect(out[0]).toBeGreaterThan(100)
  })

  it('top mask gates the top layer contribution', () => {
    const bottom = Uint8ClampedArray.of(255, 0, 0, 255)
    const top = Uint8ClampedArray.of(0, 0, 255, 255)
    const out = compositePair(
      { data: bottom, mask: null, mode: resolveMode(defaultMode('normal')), opacity: 1 },
      { data: top, mask: Uint8ClampedArray.of(0, 0, 0, 255), mode: resolveMode(defaultMode('normal')), opacity: 1 },
      1
    )
    expect(out[0]).toBe(255)
    expect(out[2]).toBe(0)
  })

  it('multiply over transparent stays transparent (clip-to-backdrop)', () => {
    const bottom = Uint8ClampedArray.of(0, 0, 0, 0)
    const top = Uint8ClampedArray.of(128, 128, 128, 255)
    const out = compositePair(
      { data: bottom, mask: null, mode: resolveMode(defaultMode('normal')), opacity: 1 },
      { data: top, mask: null, mode: resolveMode(defaultMode('multiply')), opacity: 1 },
      1
    )
    expect(out[3]).toBe(0)
  })
})

describe('mergeDown (structure)', () => {
  function setup() {
    const content = new DefaultContentStore()
    const history = new History()
    const a = rasterKind.create({
      name: 'bottom', contentId: content.register(canvasOf(40, 40)),
      naturalWidth: 40, naturalHeight: 40, opacity: 0.5, mode: defaultMode('multiply'),
      transform: { x: 0, y: 0, w: 40, h: 40, rotation: 0 },
    })
    const b = rasterKind.create({
      name: 'top', contentId: content.register(canvasOf(30, 30)),
      naturalWidth: 30, naturalHeight: 30,
      transform: { x: 20, y: 20, w: 30, h: 30, rotation: 0 },
    })
    const tree = root([a, b])
    const deps: LayerOpDeps = {
      root: tree,
      content,
      push: (cmd) => history.push(cmd),
      bitmapOf: (node) => content.get((node as RasterData).contentId)?.canvas ?? null,
    }
    return { deps, history, tree, a, b }
  }

  it('merges the union bounds into the bottom layer and removes the top', () => {
    const { deps, tree, a, b } = setup()
    expect(mergeDown(deps, b.id)).toBe(true)
    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]).toBe(a)
    expect(a.naturalWidth).toBe(50)
    expect(a.naturalHeight).toBe(50)
    expect(a.transform).toMatchObject({ x: 0, y: 0, w: 50, h: 50, rotation: 0 })
    expect(a.opacity).toBe(1)
    expect(a.mode.blend).toBe('normal')
  })

  it('is one undo step restoring both layers and the bottom state', () => {
    const { deps, history, tree, a, b } = setup()
    const beforeId = a.contentId
    mergeDown(deps, b.id)
    history.undo()
    expect(tree.children).toHaveLength(2)
    expect(tree.children[1]).toBe(b)
    expect(a.contentId).toBe(beforeId)
    expect(a.opacity).toBe(0.5)
    expect(a.mode.blend).toBe('multiply')
    expect(a.naturalWidth).toBe(40)
  })

  it('refuses when there is no visible raster below', () => {
    const { deps, tree, a, b } = setup()
    a.visible = false
    expect(mergeDown(deps, b.id)).toBe(false)
    expect(tree.children).toHaveLength(2)
  })
})
