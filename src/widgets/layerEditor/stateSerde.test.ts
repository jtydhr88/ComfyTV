import { describe, expect, it } from 'vitest'

import {
  MAX_ARTBOARD,
  MIN_ARTBOARD,
  MIN_LAYER_SIZE,
  cloneState,
  contentIdsInJson,
  createRasterLayer,
  createTextLayer,
  generateId,
  normalizeLayerState,
} from './stateSerde'
import type { RasterLayer, TextLayer } from './types'

describe('generateId', () => {
  it('uses the default prefix', () => {
    expect(generateId()).toMatch(/^layer-[0-9a-z]+-[0-9a-z]+$/)
  })

  it('uses a custom prefix and returns unique ids', () => {
    const a = generateId('content')
    const b = generateId('content')
    expect(a).toMatch(/^content-/)
    expect(a).not.toBe(b)
  })
})

describe('normalizeLayerState', () => {
  it('returns a default state for invalid JSON strings', () => {
    expect(normalizeLayerState('not json {')).toEqual({
      version: 1,
      width: 1024,
      height: 1024,
      layers: [],
    })
  })

  it('returns a default state for empty/whitespace strings', () => {
    expect(normalizeLayerState('')).toEqual({ version: 1, width: 1024, height: 1024, layers: [] })
    expect(normalizeLayerState('   ')).toEqual({ version: 1, width: 1024, height: 1024, layers: [] })
  })

  it('handles null and non-object values', () => {
    expect(normalizeLayerState(null)).toEqual({ version: 1, width: 1024, height: 1024, layers: [] })
    expect(normalizeLayerState(42).layers).toEqual([])
  })

  it('parses a valid JSON string', () => {
    const state = normalizeLayerState(JSON.stringify({ width: 512, height: 256, layers: [] }))
    expect(state.width).toBe(512)
    expect(state.height).toBe(256)
  })

  it('clamps and rounds artboard dimensions', () => {
    expect(normalizeLayerState({ width: 1, height: 99999 })).toMatchObject({
      width: MIN_ARTBOARD,
      height: MAX_ARTBOARD,
    })
    expect(normalizeLayerState({ width: 300.4, height: 300.6 })).toMatchObject({
      width: 300,
      height: 301,
    })
    expect(normalizeLayerState({ width: 'abc', height: NaN })).toMatchObject({
      width: 1024,
      height: 1024,
    })
  })

  it('ignores non-array layers', () => {
    expect(normalizeLayerState({ layers: { 0: {} } }).layers).toEqual([])
  })

  it('filters out null / non-object / invalid layers', () => {
    const state = normalizeLayerState({
      layers: [null, 'string', 7, {}, { type: 'raster' }, { contentId: '' }],
    })
    // raster layers without a non-empty contentId are dropped
    expect(state.layers).toEqual([])
  })

  describe('raster layer normalization', () => {
    it('fills in every default for a minimal raster layer', () => {
      const state = normalizeLayerState({ layers: [{ contentId: 'c1' }] })
      expect(state.layers).toHaveLength(1)
      const layer = state.layers[0] as RasterLayer
      expect(layer.type).toBe('raster')
      expect(layer.id).toMatch(/^layer-/)
      expect(layer.name).toBe('Layer')
      expect(layer.visible).toBe(true)
      expect(layer.locked).toBe(false)
      expect(layer.opacity).toBe(1)
      expect(layer.blendMode).toBe('source-over')
      expect(layer.transform).toEqual({
        x: 0,
        y: 0,
        w: MIN_LAYER_SIZE,
        h: MIN_LAYER_SIZE,
        rotation: 0,
      })
      expect(layer.mask).toBeUndefined()
      expect(layer.url).toBeUndefined()
      expect(layer.naturalWidth).toBe(1)
      expect(layer.naturalHeight).toBe(1)
    })

    it('preserves explicit valid values', () => {
      const state = normalizeLayerState({
        layers: [
          {
            id: 'r1',
            type: 'raster',
            name: 'photo',
            visible: false,
            locked: true,
            opacity: 0.5,
            blendMode: 'multiply',
            transform: { x: 5, y: -3, w: 200, h: 100, rotation: 1.2 },
            contentId: 'c9',
            url: 'http://x/img.png',
            naturalWidth: 400,
            naturalHeight: 300,
          },
        ],
      })
      const layer = state.layers[0] as RasterLayer
      expect(layer).toMatchObject({
        id: 'r1',
        name: 'photo',
        visible: false,
        locked: true,
        opacity: 0.5,
        blendMode: 'multiply',
        transform: { x: 5, y: -3, w: 200, h: 100, rotation: 1.2 },
        contentId: 'c9',
        url: 'http://x/img.png',
        naturalWidth: 400,
        naturalHeight: 300,
      })
    })

    it('clamps opacity, enforces min layer size, and coerces bad numbers', () => {
      const state = normalizeLayerState({
        layers: [
          {
            contentId: 'c1',
            opacity: 7,
            transform: { x: 'bad', y: Infinity, w: 2, h: -50, rotation: 'x' },
          },
          { contentId: 'c2', opacity: -1 },
        ],
      })
      const [a, b] = state.layers
      expect(a.opacity).toBe(1)
      expect(a.transform).toEqual({ x: 0, y: 0, w: MIN_LAYER_SIZE, h: MIN_LAYER_SIZE, rotation: 0 })
      expect(b.opacity).toBe(0)
    })

    it('falls back to source-over for unknown blend modes', () => {
      const state = normalizeLayerState({ layers: [{ contentId: 'c1', blendMode: 'weird' }] })
      expect(state.layers[0].blendMode).toBe('source-over')
    })

    it('derives natural size from the transform when missing, rounding and flooring at 1', () => {
      const state = normalizeLayerState({
        layers: [
          { contentId: 'c1', transform: { w: 33.4, h: 20 } },
          { contentId: 'c2', naturalWidth: 0.2, naturalHeight: -5 },
        ],
      })
      const a = state.layers[0] as RasterLayer
      const b = state.layers[1] as RasterLayer
      expect(a.naturalWidth).toBe(33)
      expect(a.naturalHeight).toBe(20)
      expect(b.naturalWidth).toBe(1)
      expect(b.naturalHeight).toBe(1)
    })

    it('drops empty urls', () => {
      const state = normalizeLayerState({ layers: [{ contentId: 'c1', url: '' }] })
      expect((state.layers[0] as RasterLayer).url).toBeUndefined()
    })
  })

  describe('mask normalization', () => {
    it('accepts a mask with contentId, defaulting enabled to true', () => {
      const state = normalizeLayerState({
        layers: [{ contentId: 'c1', mask: { contentId: 'm1' } }],
      })
      expect(state.layers[0].mask).toEqual({ contentId: 'm1', enabled: true })
    })

    it('keeps enabled=false and a non-empty url', () => {
      const state = normalizeLayerState({
        layers: [{ contentId: 'c1', mask: { contentId: 'm1', enabled: false, url: 'http://m' } }],
      })
      expect(state.layers[0].mask).toEqual({ contentId: 'm1', enabled: false, url: 'http://m' })
    })

    it('rejects masks that are not objects or lack a contentId', () => {
      const cases = ['str', 42, { contentId: '' }, { contentId: 7 }, {}]
      for (const mask of cases) {
        const state = normalizeLayerState({ layers: [{ contentId: 'c1', mask }] })
        expect(state.layers[0].mask).toBeUndefined()
      }
    })

    it('ignores empty mask urls', () => {
      const state = normalizeLayerState({
        layers: [{ contentId: 'c1', mask: { contentId: 'm1', url: '' } }],
      })
      expect(state.layers[0].mask).toEqual({ contentId: 'm1', enabled: true })
    })
  })

  describe('text layer normalization', () => {
    it('fills in defaults for a bare text layer', () => {
      const state = normalizeLayerState({ layers: [{ type: 'text' }] })
      const layer = state.layers[0] as TextLayer
      expect(layer).toMatchObject({
        type: 'text',
        text: '',
        fontRef: { kind: 'builtin', id: 'inter' },
        fontSize: 64,
        color: '#ffffff',
        letterSpacing: 0,
        lineHeight: 1.2,
        align: 'left',
      })
    })

    it('clamps fontSize and lineHeight', () => {
      const state = normalizeLayerState({
        layers: [
          { type: 'text', fontSize: 1, lineHeight: 0.1 },
          { type: 'text', fontSize: 99999, lineHeight: 10 },
        ],
      })
      const [a, b] = state.layers as TextLayer[]
      expect(a.fontSize).toBe(4)
      expect(a.lineHeight).toBe(0.5)
      expect(b.fontSize).toBe(2048)
      expect(b.lineHeight).toBe(4)
    })

    it('accepts center/right align and rejects anything else', () => {
      const aligns = (values: unknown[]) =>
        normalizeLayerState({
          layers: values.map((align) => ({ type: 'text', align })),
        }).layers.map((l) => (l as TextLayer).align)
      expect(aligns(['center', 'right', 'left', 'justify', 3])).toEqual([
        'center',
        'right',
        'left',
        'left',
        'left',
      ])
    })

    it('falls back to white for empty or non-string colors', () => {
      const state = normalizeLayerState({
        layers: [
          { type: 'text', color: '' },
          { type: 'text', color: 5 },
          { type: 'text', color: '#123456' },
        ],
      })
      const colors = state.layers.map((l) => (l as TextLayer).color)
      expect(colors).toEqual(['#ffffff', '#ffffff', '#123456'])
    })

    it('normalizes font refs', () => {
      const refs = (values: unknown[]) =>
        normalizeLayerState({
          layers: values.map((fontRef) => ({ type: 'text', fontRef })),
        }).layers.map((l) => (l as TextLayer).fontRef)
      expect(
        refs([
          { kind: 'url', url: 'http://f.woff', name: 'Foo' },
          { kind: 'url', url: 'http://f.woff', name: 7 },
          { kind: 'url', url: '' },
          { kind: 'builtin', id: 'roboto' },
          { kind: 'builtin', id: '' },
          { kind: 'nope' },
          undefined,
        ]),
      ).toEqual([
        { kind: 'url', url: 'http://f.woff', name: 'Foo' },
        { kind: 'url', url: 'http://f.woff', name: undefined },
        { kind: 'builtin', id: 'inter' },
        { kind: 'builtin', id: 'roboto' },
        { kind: 'builtin', id: 'inter' },
        { kind: 'builtin', id: 'inter' },
        { kind: 'builtin', id: 'inter' },
      ])
    })

    it('does not require a contentId', () => {
      const state = normalizeLayerState({ layers: [{ type: 'text', text: 'hi' }] })
      expect(state.layers).toHaveLength(1)
      expect((state.layers[0] as TextLayer).text).toBe('hi')
    })
  })
})

describe('cloneState', () => {
  it('produces a deep copy', () => {
    const state = normalizeLayerState({
      width: 512,
      height: 512,
      layers: [{ contentId: 'c1', transform: { x: 1, y: 2, w: 30, h: 40, rotation: 0 } }],
    })
    const copy = cloneState(state)
    expect(copy).toEqual(state)
    expect(copy).not.toBe(state)
    expect(copy.layers[0]).not.toBe(state.layers[0])
    copy.layers[0].transform.x = 99
    expect(state.layers[0].transform.x).toBe(1)
  })
})

describe('createRasterLayer', () => {
  it('builds a raster layer with defaults and a copied transform', () => {
    const transform = { x: 1, y: 2, w: 30, h: 40, rotation: 0.5 }
    const layer = createRasterLayer({
      contentId: 'c1',
      name: 'pic',
      naturalWidth: 300,
      naturalHeight: 400,
      transform,
      url: 'http://x',
    })
    expect(layer).toMatchObject({
      type: 'raster',
      name: 'pic',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      contentId: 'c1',
      url: 'http://x',
      naturalWidth: 300,
      naturalHeight: 400,
    })
    expect(layer.id).toMatch(/^layer-/)
    expect(layer.transform).toEqual(transform)
    expect(layer.transform).not.toBe(transform)
  })
})

describe('createTextLayer', () => {
  it('applies defaults and sizes the box from the font size', () => {
    const layer = createTextLayer({ text: 'Hello world, this is a long name', at: { x: 10, y: 20 } })
    expect(layer.type).toBe('text')
    expect(layer.name).toBe('Hello world, this is')
    expect(layer.name.length).toBe(20)
    expect(layer.fontSize).toBe(64)
    expect(layer.color).toBe('#ffffff')
    expect(layer.fontRef).toEqual({ kind: 'builtin', id: 'inter' })
    expect(layer.transform).toEqual({ x: 10, y: 20, w: 256, h: 76.8, rotation: 0 })
    expect(layer.align).toBe('left')
  })

  it('names empty text layers "Text" and honours explicit options', () => {
    const layer = createTextLayer({
      text: '',
      at: { x: 0, y: 0 },
      fontRef: { kind: 'url', url: 'http://f' },
      fontSize: 10,
      color: '#000000',
    })
    expect(layer.name).toBe('Text')
    expect(layer.fontSize).toBe(10)
    expect(layer.color).toBe('#000000')
    expect(layer.fontRef).toEqual({ kind: 'url', url: 'http://f' })
    expect(layer.transform.w).toBe(40)
    expect(layer.transform.h).toBe(12)
  })
})

describe('contentIdsInJson', () => {
  it('collects raster contentIds and mask contentIds from both layer types', () => {
    const json = JSON.stringify({
      width: 512,
      height: 512,
      layers: [
        { contentId: 'raster-1' },
        { contentId: 'raster-2', mask: { contentId: 'mask-2' } },
        { type: 'text', text: 'hi', mask: { contentId: 'mask-t' } },
        { type: 'text', text: 'no mask' },
      ],
    })
    expect(contentIdsInJson(json)).toEqual(['raster-1', 'raster-2', 'mask-2', 'mask-t'])
  })

  it('returns an empty list for invalid json', () => {
    expect(contentIdsInJson('garbage')).toEqual([])
  })
})
