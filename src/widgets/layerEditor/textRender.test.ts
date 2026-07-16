import { beforeEach, describe, expect, it, vi } from 'vitest'

import Typr, { type TyprFont } from '@/vendor/typr'

import { measureText, renderTextToCanvas, TextRenderCache } from './textRender'
import type { TextLayer } from './types'

// Deterministic Typr stub: every glyph advances 500 font units; the space
// glyph (gid 32) produces an empty path so the skip-branch is exercised.
vi.mock('@/vendor/typr', () => {
  const shape = vi.fn((_font: unknown, str: string) =>
    [...str].map((ch, i) => ({ g: ch.charCodeAt(0), cl: i, dx: 0, dy: 0, ax: 500, ay: 0 })),
  )
  const glyphToPath = vi.fn((_font: unknown, gid: number) =>
    gid === 32 ? { cmds: [], crds: [] } : { cmds: ['M', 'L', 'Z'], crds: [0, 0, 10, 10] },
  )
  const pathToContext = vi.fn()
  return { default: { U: { shape, glyphToPath, pathToContext } } }
})

interface Op {
  op: string
  args: unknown[]
  fillStyle: unknown
}

type MockCtx = CanvasRenderingContext2D & { ops: Op[] }

function createMockCtx(canvas: HTMLCanvasElement): MockCtx {
  const ops: Op[] = []
  const ctx: Record<string, unknown> = { canvas, ops, fillStyle: '#000000' }
  for (const m of ['save', 'restore', 'translate', 'scale', 'beginPath', 'fill', 'moveTo', 'lineTo', 'closePath']) {
    ctx[m] = vi.fn((...args: unknown[]) => {
      ops.push({ op: m, args, fillStyle: ctx.fillStyle })
    })
  }
  return ctx as unknown as MockCtx
}

const ctxByCanvas = new WeakMap<HTMLCanvasElement, MockCtx>()

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    let c = ctxByCanvas.get(this)
    if (!c) {
      c = createMockCtx(this)
      ctxByCanvas.set(this, c)
    }
    return c as unknown as CanvasRenderingContext2D
  })
})

function ctxOf(canvas: HTMLCanvasElement): MockCtx {
  return canvas.getContext('2d') as unknown as MockCtx
}

function opsOf(ctx: MockCtx, name: string): Op[] {
  return ctx.ops.filter((o) => o.op === name)
}

// unitsPerEm 1000, fontSize 100 -> scale 0.1; ascender 80px, descender 20px.
const font: TyprFont = {
  head: { unitsPerEm: 1000, xMin: 0, yMin: 0, xMax: 0, yMax: 0 },
  hhea: { ascender: 800, descender: -200, lineGap: 0 },
}

function layer(extra: Partial<TextLayer> = {}): TextLayer {
  return {
    id: 'txt-1',
    type: 'text',
    name: 'txt',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0 },
    text: 'AB',
    fontRef: { kind: 'builtin', id: 'inter' },
    fontSize: 100,
    color: '#123456',
    letterSpacing: 0,
    lineHeight: 1.2,
    align: 'left',
    ...extra,
  }
}

describe('measureText', () => {
  it('measures a single line with padding, ascender and descender', () => {
    // width: 2 glyphs * 50px + 2 * pad(25); height: asc 80 + desc 20 + 2 * 25
    expect(measureText(layer(), font)).toEqual({ w: 150, h: 150 })
  })

  it('adds letter spacing per glyph', () => {
    expect(measureText(layer({ letterSpacing: 2 }), font).w).toBe(154)
  })

  it('uses the widest line and per-line advance for multi-line text', () => {
    // widths 50 and 150 -> w = 150 + 50; h = 1 * 120 + 80 + 20 + 50
    expect(measureText(layer({ text: 'A\nABA' }), font)).toEqual({ w: 200, h: 270 })
  })

  it('falls back to a single space for empty text', () => {
    expect(measureText(layer({ text: '' }), font)).toEqual({ w: 100, h: 150 })
  })
})

describe('renderTextToCanvas', () => {
  it('sizes the canvas to the metrics and paints each glyph', () => {
    const canvas = renderTextToCanvas(layer(), font)
    expect(canvas.width).toBe(150)
    expect(canvas.height).toBe(150)
    const ctx = ctxOf(canvas)
    expect(ctx.fillStyle).toBe('#123456')
    const translates = opsOf(ctx, 'translate')
    expect(translates).toHaveLength(2)
    // first glyph pen at pad=25, baseline = pad + asc = 105
    expect(translates[0].args).toEqual([25, 105])
    expect(translates[1].args).toEqual([75, 105])
    expect(opsOf(ctx, 'scale')[0].args).toEqual([0.1, -0.1])
    expect(opsOf(ctx, 'fill')).toHaveLength(2)
    expect(Typr.U.pathToContext).toHaveBeenCalled()
  })

  it('skips glyphs with empty paths but still advances the pen', () => {
    const canvas = renderTextToCanvas(layer({ text: 'A B' }), font)
    const ctx = ctxOf(canvas)
    const translates = opsOf(ctx, 'translate')
    expect(translates).toHaveLength(2)
    expect(translates[0].args).toEqual([25, 105])
    // the space still advanced the pen: 25 + 2 * 50
    expect(translates[1].args).toEqual([125, 105])
  })

  it('right-aligns short lines against the widest line', () => {
    const canvas = renderTextToCanvas(layer({ text: 'AA\nA', align: 'right' }), font)
    const ctx = ctxOf(canvas)
    const translates = opsOf(ctx, 'translate')
    expect(translates).toHaveLength(3)
    // line 2: penX = 25 + (100 - 50) * 1, baseline = 25 + 80 + 120
    expect(translates[2].args).toEqual([75, 225])
  })

  it('center-aligns short lines', () => {
    const canvas = renderTextToCanvas(layer({ text: 'AA\nA', align: 'center' }), font)
    const translates = opsOf(ctxOf(canvas), 'translate')
    expect(translates[2].args).toEqual([50, 225])
  })
})

describe('TextRenderCache', () => {
  it('returns null without a font', () => {
    expect(new TextRenderCache().get(layer(), null)).toBeNull()
  })

  it('caches per layer id and invalidates when params change', () => {
    const cache = new TextRenderCache()
    const l = layer()
    const first = cache.get(l, font)
    expect(first).toBeInstanceOf(HTMLCanvasElement)
    expect(cache.get(l, font)).toBe(first)

    const changed = cache.get(layer({ text: 'AC' }), font)
    expect(changed).not.toBe(first)
    // and the new result is cached in turn
    expect(cache.get(layer({ text: 'AC' }), font)).toBe(changed)
  })

  it('hashes url font refs distinctly from builtin ones', () => {
    const cache = new TextRenderCache()
    const builtin = cache.get(layer(), font)
    const url = cache.get(layer({ fontRef: { kind: 'url', url: 'https://x/f.ttf' } }), font)
    expect(url).not.toBe(builtin)
  })

  it('drop() and clear() force a re-render', () => {
    const cache = new TextRenderCache()
    const l = layer()
    const first = cache.get(l, font)
    cache.drop(l.id)
    const second = cache.get(l, font)
    expect(second).not.toBe(first)
    cache.clear()
    expect(cache.get(l, font)).not.toBe(second)
  })
})
