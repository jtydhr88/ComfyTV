import { describe, expect, it } from 'vitest'

import type { Layer, Psd } from 'ag-psd'
import type { AdjustmentData, FillData, GroupData, RasterData, TextData, VectorData } from './engine'
import { bufferedContentRegistry, psdToNodes, type PsdImportDeps } from './psdImport'

function fakeCanvas(w = 8, h = 8): HTMLCanvasElement {
  return { width: w, height: h, tag: Math.random() } as unknown as HTMLCanvasElement
}

function fakeMaskCanvasFactory() {
  const ops: Array<Record<string, unknown>> = []
  const makeCanvas = (w: number, h: number): HTMLCanvasElement => {
    const canvas = {
      width: Math.max(1, Math.round(w)),
      height: Math.max(1, Math.round(h)),
      getContext: () => ({
        fillStyle: '',
        fillRect: (...args: unknown[]) => ops.push({ op: 'fillRect', args }),
        drawImage: (...args: unknown[]) => ops.push({ op: 'drawImage', args }),
      }),
    }
    return canvas as unknown as HTMLCanvasElement
  }
  return { makeCanvas, ops }
}

function psdOf(children: Layer[], over: Partial<Psd> = {}): Psd {
  return { width: 64, height: 32, children, ...over }
}

function makeDeps(over: Partial<PsdImportDeps> = {}): PsdImportDeps & { registered: HTMLCanvasElement[] } {
  const registered: HTMLCanvasElement[] = []
  return {
    registered,
    registerContent: (canvas) => {
      registered.push(canvas)
      return `content-${registered.length}`
    },
    matchFont: () => ({ kind: 'builtin', id: 'inter' }),
    ...over,
  }
}

describe('psdToNodes structure', () => {
  it('imports raster layers with position and blend', async () => {
    const canvas = fakeCanvas(20, 10)
    const deps = makeDeps()
    const result = await psdToNodes(psdOf([
      { name: 'Photo', canvas, left: 5, top: 7, opacity: 0.5, blendMode: 'multiply', hidden: true },
    ]), deps)
    expect(result.width).toBe(64)
    expect(result.nodes).toHaveLength(1)
    const node = result.nodes[0] as RasterData
    expect(node.kind).toBe('raster')
    expect(node.name).toBe('Photo')
    expect(node.visible).toBe(false)
    expect(node.opacity).toBe(0.5)
    expect(node.mode.blend).toBe('multiply')
    expect(node.contentId).toBe('content-1')
    expect(node.transform).toEqual({ x: 5, y: 7, w: 20, h: 10, rotation: 0 })
    expect(deps.registered[0]).toBe(canvas)
  })

  it('imports nested groups with pass-through', async () => {
    const result = await psdToNodes(psdOf([
      {
        name: 'Folder',
        blendMode: 'pass through',
        children: [{ name: 'Inner', canvas: fakeCanvas() }],
      },
    ]), makeDeps())
    const group = result.nodes[0] as GroupData
    expect(group.kind).toBe('group')
    expect(group.passThrough).toBe(true)
    expect(group.children).toHaveLength(1)
    expect(group.children[0].name).toBe('Inner')
  })

  it('skips empty layers with a warning', async () => {
    const result = await psdToNodes(psdOf([{ name: 'Empty' }]), makeDeps())
    expect(result.nodes).toHaveLength(0)
    expect(result.warnings[0]).toContain('Empty')
  })
})

describe('psdToNodes rich layers', () => {
  it('imports adjustment layers', async () => {
    const result = await psdToNodes(psdOf([
      { name: 'Levels', adjustment: { type: 'levels', rgb: { shadowInput: 26, highlightInput: 230, shadowOutput: 0, highlightOutput: 255, midtoneInput: 2 } } },
    ]), makeDeps())
    const node = result.nodes[0] as AdjustmentData
    expect(node.kind).toBe('adjustment')
    expect(node.op).toBe('levels')
    expect(node.params.inBlack).toBeCloseTo(0.102, 2)
    expect(node.params.gamma).toBeCloseTo(2, 3)
  })

  it('warns on unsupported adjustments', async () => {
    const result = await psdToNodes(psdOf([
      { name: 'BW', adjustment: { type: 'black & white' } },
    ]), makeDeps())
    expect(result.nodes).toHaveLength(0)
    expect(result.warnings[0]).toContain('black & white')
  })

  it('imports text layers', async () => {
    const deps = makeDeps({ matchFont: (name) => ({ kind: 'builtin', id: name === 'Inter Display' ? 'inter-display' : 'inter' }) })
    const result = await psdToNodes(psdOf([
      {
        name: 'Title',
        left: 0, top: 0, right: 120, bottom: 40,
        text: {
          text: 'Hello',
          transform: [1, 0, 0, 1, 5, 27],
          style: { font: { name: 'Inter Display' }, fontSize: 20, fillColor: { r: 255, g: 0, b: 0 }, leading: 30, tracking: 100 },
          paragraphStyle: { justification: 'center' },
        },
      },
    ]), deps)
    const node = result.nodes[0] as TextData
    expect(node.kind).toBe('text')
    expect(node.text).toBe('Hello')
    expect(node.fontRef).toEqual({ kind: 'builtin', id: 'inter-display' })
    expect(node.fontSize).toBe(20)
    expect(node.color).toBe('#ff0000')
    expect(node.letterSpacing).toBeCloseTo(2, 5)
    expect(node.lineHeight).toBeCloseTo(1.5, 5)
    expect(node.align).toBe('center')
    expect(node.transform.x).toBe(5)
    expect(node.transform.y).toBe(7)
  })

  it('imports shape layers as vectors', async () => {
    const result = await psdToNodes(psdOf([
      {
        name: 'Shape',
        vectorMask: {
          paths: [{
            open: false,
            fillRule: 'non-zero',
            knots: [
              { linked: true, points: [10, 10, 10, 10, 10, 10] },
              { linked: true, points: [30, 10, 30, 10, 30, 10] },
              { linked: true, points: [30, 20, 30, 20, 30, 20] },
              { linked: true, points: [10, 20, 10, 20, 10, 20] },
            ],
          }],
        },
        vectorFill: { type: 'color', color: { r: 0, g: 255, b: 0 } },
        vectorStroke: {
          strokeEnabled: true,
          lineWidth: { units: 'Pixels', value: 4 },
          lineCapType: 'round',
          lineJoinType: 'bevel',
          opacity: 0.8,
          content: { type: 'color', color: { r: 0, g: 0, b: 255 } },
        },
      },
    ]), makeDeps())
    const node = result.nodes[0] as VectorData
    expect(node.kind).toBe('vector')
    expect(node.path.strokes[0].anchors).toHaveLength(12)
    expect(node.fill).toMatchObject({ color: '#00ff00' })
    expect(node.stroke).toMatchObject({ color: '#0000ff', width: 4, cap: 'round', join: 'bevel' })
    expect(node.transform.x).toBeLessThanOrEqual(10)
    expect(node.transform.w).toBeGreaterThanOrEqual(20)
  })

  it('imports fill layers', async () => {
    const result = await psdToNodes(psdOf([
      { name: 'Fill', vectorFill: { type: 'color', color: { r: 18, g: 52, b: 86 } } },
    ]), makeDeps())
    const node = result.nodes[0] as FillData
    expect(node.kind).toBe('fill')
    expect(node.fill).toEqual({ type: 'solid', color: '#123456' })
    expect(node.transform).toEqual({ x: 0, y: 0, w: 0, h: 0, rotation: 0 })
  })

  it('restores smart objects from linked files', async () => {
    const original = fakeCanvas(40, 20)
    const guid = '20953ddb-9391-11ec-b4f1-c15674f50bc4'
    const deps = makeDeps({ decodePng: async () => original })
    const result = await psdToNodes(psdOf([
      {
        name: 'Smart',
        canvas: fakeCanvas(20, 10),
        left: 10, top: 10,
        placedLayer: {
          id: guid,
          type: 'raster',
          transform: [10, 10, 30, 10, 30, 20, 10, 20],
          width: 40,
          height: 20,
        },
      },
    ], { linkedFiles: [{ id: guid, name: 'Smart.png', data: new Uint8Array([1]) }] }), deps)
    const node = result.nodes[0] as RasterData
    expect(node.naturalWidth).toBe(40)
    expect(node.naturalHeight).toBe(20)
    expect(deps.registered[0]).toBe(original)
    expect(node.transform.x).toBeCloseTo(10, 5)
    expect(node.transform.y).toBeCloseTo(10, 5)
    expect(node.transform.w).toBeCloseTo(20, 5)
    expect(node.transform.h).toBeCloseTo(10, 5)
    expect(node.transform.rotation).toBeCloseTo(0, 5)
  })

  it('buffered registry defers store registration until commit', () => {
    const registry = bufferedContentRegistry()
    const a = fakeCanvas()
    const b = fakeCanvas()
    const idA = registry.registerContent(a)
    const idB = registry.registerContent(b)
    expect(idA).not.toBe(idB)

    const committed: Array<{ canvas: HTMLCanvasElement; id: string }> = []
    registry.commit((canvas, id) => committed.push({ canvas, id }))
    expect(committed).toEqual([
      { canvas: a, id: idA },
      { canvas: b, id: idB },
    ])

    registry.commit((canvas, id) => committed.push({ canvas, id }))
    expect(committed).toHaveLength(2)
  })

  it('imports layer masks into node-local canvases', async () => {
    const { makeCanvas, ops } = fakeMaskCanvasFactory()
    const deps = makeDeps({ makeCanvas })
    const result = await psdToNodes(psdOf([
      {
        name: 'Masked',
        canvas: fakeCanvas(20, 10),
        left: 5, top: 7,
        mask: { canvas: fakeCanvas(6, 6), left: 8, top: 9, defaultColor: 255 },
      },
    ]), deps)
    const node = result.nodes[0] as RasterData
    expect(node.mask).toBeTruthy()
    expect(node.mask!.enabled).toBe(true)
    expect(node.mask!.contentId).toBe('content-2')
    const draw = ops.find((o) => o.op === 'drawImage')!
    expect((draw.args as unknown[])[1]).toBe(3)
    expect((draw.args as unknown[])[2]).toBe(2)
  })
})
