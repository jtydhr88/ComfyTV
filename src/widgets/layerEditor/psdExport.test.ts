import { describe, expect, it } from 'vitest'

import { defaultMode, type Document, type GroupData, type SceneNode } from './engine'
import { rectPath } from './engine/vector'
import {
  buildPsd,
  leafPlacedBounds,
  makeGuid,
  transformCorners,
  type PsdExportDeps,
} from './psdExport'

function fakeCanvas(w = 8, h = 8): HTMLCanvasElement {
  return { width: w, height: h, tag: Math.random() } as unknown as HTMLCanvasElement
}

let idSeq = 0

function base(kind: string, over: Record<string, unknown> = {}): SceneNode {
  return {
    id: `n${++idSeq}`,
    kind,
    name: kind,
    visible: true,
    opacity: 1,
    mode: defaultMode('normal'),
    transform: { x: 0, y: 0, w: 10, h: 10, rotation: 0 },
    locks: { content: false, position: false, visibility: false },
    ...over,
  } as SceneNode
}

function raster(over: Record<string, unknown> = {}): SceneNode {
  return base('raster', { contentId: 'c1', naturalWidth: 10, naturalHeight: 10, ...over })
}

function group(children: SceneNode[], over: Record<string, unknown> = {}): GroupData {
  return base('group', { children, passThrough: false, ...over }) as GroupData
}

function doc(children: SceneNode[]): Document {
  return { version: 2, width: 64, height: 32, root: group(children, { id: 'root' }), channels: [] }
}

function deps(over: Partial<PsdExportDeps> = {}): PsdExportDeps {
  return {
    rasterizeLeaf: () => ({ canvas: fakeCanvas(), left: 0, top: 0 }),
    maskCanvas: () => ({ canvas: fakeCanvas(), left: 0, top: 0 }),
    composite: () => fakeCanvas(),
    ...over,
  }
}

describe('buildPsd basics', () => {
  it('builds document with composite and leaf layers', async () => {
    const composite = fakeCanvas()
    const leafCanvas = fakeCanvas(20, 10)
    const d = doc([raster({ name: 'Photo', opacity: 0.5, mode: defaultMode('multiply') })])
    const psd = await buildPsd(d, deps({
      composite: () => composite,
      rasterizeLeaf: () => ({ canvas: leafCanvas, left: 5, top: 7 }),
    }))

    expect(psd.width).toBe(64)
    expect(psd.height).toBe(32)
    expect(psd.canvas).toBe(composite)
    const layer = psd.children![0]
    expect(layer.name).toBe('Photo')
    expect(layer.opacity).toBe(0.5)
    expect(layer.blendMode).toBe('multiply')
    expect(layer.canvas).toBe(leafCanvas)
    expect(layer.left).toBe(5)
    expect(layer.top).toBe(7)
    expect(layer.right).toBe(25)
    expect(layer.bottom).toBe(17)
  })

  it('keeps layer bounds that extend beyond the canvas', async () => {
    const leafCanvas = fakeCanvas(64, 64)
    const d = doc([raster({ name: 'Overflow' })])
    const psd = await buildPsd(d, deps({
      rasterizeLeaf: () => ({ canvas: leafCanvas, left: 96, top: -10 }),
    }))
    const layer = psd.children![0]
    expect(layer.left).toBe(96)
    expect(layer.top).toBe(-10)
    expect(layer.right).toBe(160)
    expect(layer.bottom).toBe(54)
  })

  it('marks invisible layers hidden and clamps opacity', async () => {
    const d = doc([raster({ visible: false, opacity: 3 })])
    const layer = (await buildPsd(d, deps())).children![0]
    expect(layer.hidden).toBe(true)
    expect(layer.opacity).toBe(1)
  })

  it('recurses into groups and maps pass-through', async () => {
    const d = doc([group([raster({ name: 'Inner' })], { name: 'Folder', passThrough: true })])
    const layer = (await buildPsd(d, deps())).children![0]
    expect(layer.blendMode).toBe('pass through')
    expect(layer.opened).toBe(true)
    expect(layer.canvas).toBeUndefined()
    expect(layer.children![0].name).toBe('Inner')
  })

  it('attaches masks with enabled state and placed bounds', async () => {
    const maskCanvas = fakeCanvas(20, 10)
    const masked = raster({ mask: { id: 'm1', role: 'mask', contentId: 'mc', enabled: false } })
    const layer = (await buildPsd(doc([masked]), deps({
      maskCanvas: () => ({ canvas: maskCanvas, left: 3, top: 4 }),
    }))).children![0]
    expect(layer.mask).toMatchObject({
      canvas: maskCanvas, disabled: true, defaultColor: 0,
      left: 3, top: 4, right: 23, bottom: 14,
    })
  })
})

describe('buildPsd adjustment layers', () => {
  it('writes real adjustment data', async () => {
    const adj = base('adjustment', { name: 'Levels', op: 'levels', params: { inBlack: 0.1, inWhite: 1, gamma: 1, outBlack: 0, outWhite: 1 } })
    const layer = (await buildPsd(doc([adj]), deps())).children![0]
    expect(layer.canvas).toBeUndefined()
    expect(layer.adjustment).toMatchObject({ type: 'levels', rgb: { shadowInput: 26 } })
  })

  it('keeps placeholder for unknown adjustment op', async () => {
    const adj = base('adjustment', { name: 'X', op: 'bogus', params: {} })
    const layer = (await buildPsd(doc([adj]), deps())).children![0]
    expect(layer.adjustment).toBeUndefined()
    expect(layer.name).toBe('X')
  })
})

describe('buildPsd rich layers', () => {
  it('writes editable text data', async () => {
    const text = base('text', {
      text: 'Hello',
      fontRef: { kind: 'builtin', id: 'inter' },
      fontSize: 20,
      color: '#ff0000',
      letterSpacing: 2,
      lineHeight: 1.5,
      align: 'center',
      transform: { x: 5, y: 7, w: 100, h: 30, rotation: 0 },
    })
    const layer = (await buildPsd(doc([text]), deps({ fontName: () => 'Inter Display' }))).children![0]
    expect(layer.text).toBeTruthy()
    expect(layer.text!.text).toBe('Hello')
    expect(layer.text!.style).toMatchObject({
      font: { name: 'Inter Display' },
      fontSize: 20,
      fillColor: { r: 255, g: 0, b: 0 },
      leading: 30,
      tracking: 100,
    })
    expect(layer.text!.paragraphStyle).toEqual({ justification: 'center' })
    expect(layer.text!.transform).toEqual([1, 0, -0, 1, 5, 27])
    expect(layer.canvas).toBeTruthy()
  })

  it('writes vector masks with fill and stroke', async () => {
    const vector = base('vector', {
      path: rectPath(4, 4, 20, 10),
      fill: { color: '#00ff00', rule: 'evenodd', opacity: 1 },
      stroke: { color: '#0000ff', width: 3, cap: 'round', join: 'bevel', opacity: 0.8 },
    })
    const layer = (await buildPsd(doc([vector]), deps())).children![0]
    expect(layer.vectorMask!.paths[0].fillRule).toBe('even-odd')
    expect(layer.vectorMask!.paths[0].knots).toHaveLength(4)
    expect(layer.vectorFill).toEqual({ type: 'color', color: { r: 0, g: 255, b: 0 } })
    expect(layer.vectorStroke).toMatchObject({
      strokeEnabled: true,
      lineWidth: { units: 'Pixels', value: 3 },
      lineCapType: 'round',
      lineJoinType: 'bevel',
      content: { type: 'color', color: { r: 0, g: 0, b: 255 } },
    })
  })

  it('writes parametric fill layers', async () => {
    const fill = base('fill', { fill: { type: 'solid', color: '#123456' } })
    const layer = (await buildPsd(doc([fill]), deps())).children![0]
    expect(layer.vectorFill).toEqual({ type: 'color', color: { r: 18, g: 52, b: 86 } })
    expect(layer.vectorStroke).toBeUndefined()
  })

  it('embeds smart objects for raster layers', async () => {
    const source = fakeCanvas(40, 20)
    const png = new Uint8Array([1, 2, 3])
    const node = raster({ name: 'Photo', transform: { x: 10, y: 10, w: 20, h: 10, rotation: 0 } })
    const psd = await buildPsd(doc([node]), deps({
      contentCanvas: () => source,
      canvasPng: async () => png,
    }))
    const layer = psd.children![0]
    expect(psd.linkedFiles).toHaveLength(1)
    expect(psd.linkedFiles![0].data).toBe(png)
    expect(psd.linkedFiles![0].id).toMatch(/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/)
    expect(layer.placedLayer).toMatchObject({
      id: psd.linkedFiles![0].id,
      type: 'raster',
      width: 40,
      height: 20,
    })
    expect(layer.placedLayer!.transform).toEqual([10, 10, 30, 10, 30, 20, 10, 20])
  })

  it('skips smart object when content is unavailable', async () => {
    const psd = await buildPsd(doc([raster()]), deps({
      contentCanvas: () => null,
      canvasPng: async () => new Uint8Array(),
    }))
    expect(psd.children![0].placedLayer).toBeUndefined()
    expect(psd.linkedFiles).toBeUndefined()
  })
})

describe('guides', () => {
  it('writes guides into image resources', async () => {
    const psd = await buildPsd(doc([raster()]), deps({
      guides: { horizontal: [16], vertical: [21, 42] },
    }))
    expect(psd.imageResources!.gridAndGuidesInformation!.guides).toEqual([
      { location: 16, direction: 'horizontal' },
      { location: 21, direction: 'vertical' },
      { location: 42, direction: 'vertical' },
    ])
  })
})

describe('helpers', () => {
  it('generates guid format', () => {
    expect(makeGuid()).toMatch(/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/)
  })

  it('computes placed bounds for plain and rotated transforms', () => {
    const d = doc([])
    expect(leafPlacedBounds({ x: 96, y: -10, w: 64, h: 32, rotation: 0 }, d))
      .toEqual({ x: 96, y: -10, w: 64, h: 32 })
    const rotated = leafPlacedBounds({ x: 0, y: 0, w: 10, h: 10, rotation: Math.PI / 4 }, d)
    expect(rotated.w).toBeGreaterThan(13)
    expect(rotated.x).toBeLessThan(0)
    expect(leafPlacedBounds({ x: 5, y: 5, w: 0, h: 0, rotation: 0 }, d))
      .toEqual({ x: 0, y: 0, w: 64, h: 32 })
  })

  it('computes rotated corners', () => {
    const corners = transformCorners({ x: 0, y: 0, w: 10, h: 10, rotation: Math.PI / 2 })
    expect(corners[0]).toBeCloseTo(10, 5)
    expect(corners[1]).toBeCloseTo(0, 5)
    expect(corners[6]).toBeCloseTo(0, 5)
    expect(corners[7]).toBeCloseTo(0, 5)
  })
})
