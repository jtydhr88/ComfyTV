import { describe, expect, it, vi } from 'vitest'

import { applyBrushStyle, drawCircle, drawSegment, makeStrokeBrush, type StrokeBrush } from './strokeEngine'

interface Op {
  op: string
  args: unknown[]
  fillStyle: unknown
}

type MockCtx = CanvasRenderingContext2D & {
  ops: Op[]
  addColorStop: ReturnType<typeof vi.fn>
}

function makeCtx(): MockCtx {
  const ops: Op[] = []
  const ctx: Record<string, unknown> = {
    ops,
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 0,
    globalCompositeOperation: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
  }
  for (const m of ['beginPath', 'arc', 'fill', 'stroke', 'moveTo', 'lineTo']) {
    ctx[m] = vi.fn((...args: unknown[]) => {
      ops.push({ op: m, args, fillStyle: ctx.fillStyle })
    })
  }
  const addColorStop = vi.fn()
  ctx.createRadialGradient = vi.fn(() => ({ addColorStop, __gradient: true }))
  ctx.addColorStop = addColorStop
  return ctx as unknown as MockCtx
}

function opsOf(ctx: MockCtx, name: string): Op[] {
  return ctx.ops.filter((o) => o.op === name)
}

describe('makeStrokeBrush', () => {
  it('computes radius and identity hardness for a hard brush', () => {
    const b = makeStrokeBrush(10, 1, '#ff8000')
    expect(b.radius).toBe(5)
    expect(b.effectiveRadius).toBe(5)
    expect(b.effectiveHardness).toBe(1)
    expect(b.hardness).toBe(1)
    expect({ r: b.r, g: b.g, b: b.b }).toEqual({ r: 255, g: 128, b: 0 })
  })

  it('clamps the radius to a minimum of 0.5', () => {
    const b = makeStrokeBrush(0.5, 1, '#000000')
    expect(b.radius).toBe(0.5)
  })

  it('grows the effective radius and scales hardness for a soft brush', () => {
    const b = makeStrokeBrush(10, 0.5, '#ffffff')
    expect(b.effectiveRadius).toBeCloseTo(6.25)
    expect(b.effectiveHardness).toBeCloseTo(0.4)
  })

  it('parses short hex colors', () => {
    const b = makeStrokeBrush(4, 1, '#f00')
    expect({ r: b.r, g: b.g, b: b.b }).toEqual({ r: 255, g: 0, b: 0 })
  })
})

describe('applyBrushStyle', () => {
  it('applies color, line width and round joins', () => {
    const ctx = makeCtx()
    const b = makeStrokeBrush(10, 1, '#0080ff')
    applyBrushStyle(ctx, b)
    expect(ctx.fillStyle).toBe('rgb(0, 128, 255)')
    expect(ctx.strokeStyle).toBe('rgb(0, 128, 255)')
    expect(ctx.globalCompositeOperation).toBe('source-over')
    expect(ctx.globalAlpha).toBe(1)
    expect(ctx.lineWidth).toBe(10)
    expect(ctx.lineCap).toBe('round')
    expect(ctx.lineJoin).toBe('round')
  })
})

describe('drawCircle', () => {
  it('draws a plain filled circle at full hardness', () => {
    const ctx = makeCtx()
    const b = makeStrokeBrush(10, 1, '#ff0000')
    ctx.fillStyle = 'rgb(255, 0, 0)'
    drawCircle(ctx, b, { x: 3, y: 4 })
    expect(opsOf(ctx, 'beginPath')).toHaveLength(1)
    expect(opsOf(ctx, 'arc')[0].args).toEqual([3, 4, 5, 0, Math.PI * 2])
    expect(ctx.createRadialGradient).not.toHaveBeenCalled()
    expect(opsOf(ctx, 'fill')[0].fillStyle).toBe('rgb(255, 0, 0)')
  })

  it('uses a radial gradient below full hardness', () => {
    const ctx = makeCtx()
    const b = makeStrokeBrush(10, 0.5, '#ff0000')
    drawCircle(ctx, b, { x: 1, y: 2 })
    expect(ctx.createRadialGradient).toHaveBeenCalledWith(1, 2, 0, 1, 2, b.effectiveRadius)
    expect(ctx.addColorStop).toHaveBeenCalledTimes(3)
    expect(ctx.addColorStop).toHaveBeenNthCalledWith(1, 0, 'rgba(255, 0, 0, 1)')
    expect(ctx.addColorStop).toHaveBeenNthCalledWith(2, b.effectiveHardness, 'rgba(255, 0, 0, 1)')
    expect(ctx.addColorStop).toHaveBeenNthCalledWith(3, 1, 'rgba(255, 0, 0, 0)')
    const fill = opsOf(ctx, 'fill')[0]
    expect((fill.fillStyle as { __gradient?: boolean }).__gradient).toBe(true)
  })
})

describe('drawSegment', () => {
  it('draws a stroked line plus an end cap at full hardness', () => {
    const ctx = makeCtx()
    const b = makeStrokeBrush(10, 1, '#00ff00')
    drawSegment(ctx, b, { x: 0, y: 0 }, { x: 10, y: 0 })
    expect(opsOf(ctx, 'moveTo')[0].args).toEqual([0, 0])
    expect(opsOf(ctx, 'lineTo')[0].args).toEqual([10, 0])
    expect(opsOf(ctx, 'stroke')).toHaveLength(1)
    // end cap circle at destination
    expect(opsOf(ctx, 'arc')[0].args.slice(0, 2)).toEqual([10, 0])
  })

  it('stamps interpolated dabs for a soft brush', () => {
    const ctx = makeCtx()
    const b: StrokeBrush = makeStrokeBrush(4, 0.5, '#000000')
    // effectiveRadius = 2.5 -> step = 1.25 -> ceil(5 / 1.25) = 4 dabs
    drawSegment(ctx, b, { x: 0, y: 0 }, { x: 0, y: 5 })
    const arcs = opsOf(ctx, 'arc')
    expect(arcs).toHaveLength(4)
    expect(arcs[arcs.length - 1].args.slice(0, 2)).toEqual([0, 5])
    expect(opsOf(ctx, 'stroke')).toHaveLength(0)
  })

  it('draws nothing for a zero-length soft segment', () => {
    const ctx = makeCtx()
    const b = makeStrokeBrush(4, 0.5, '#000000')
    drawSegment(ctx, b, { x: 7, y: 7 }, { x: 7, y: 7 })
    expect(opsOf(ctx, 'arc')).toHaveLength(0)
    expect(opsOf(ctx, 'stroke')).toHaveLength(0)
  })
})
