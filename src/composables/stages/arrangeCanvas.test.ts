import { describe, expect, it, vi } from 'vitest'

import { arrangeGrid, handleArrangeCanvas } from './arrangeCanvas'

function node(id: number, w = 400, h = 500) {
  return { id, pos: [0, 0], size: [w, h] }
}

describe('arrangeGrid', () => {
  it('lays execution order out row by row with the requested column count', () => {
    const nodes = [node(1), node(2), node(3), node(4, 400, 200), node(5), node(6)]
    const graph = { _nodes: nodes, setDirtyCanvas: vi.fn() }
    expect(arrangeGrid(graph, 100, 3)).toBe(6)
    expect(nodes.map(n => n.pos)).toEqual([
      [100, 130], [600, 130], [1100, 130],
      [100, 760], [600, 760], [1100, 760],
    ])
    expect(graph.setDirtyCanvas).toHaveBeenCalled()
  })

  it('defaults columns to ceil(sqrt(n)) and prefers computeExecutionOrder', () => {
    const a = node(1), b = node(2), c = node(3)
    const graph = {
      _nodes: [c, b, a],
      computeExecutionOrder: vi.fn(() => [a, b, c]),
    }
    expect(arrangeGrid(graph, 50)).toBe(3)
    expect(graph.computeExecutionOrder).toHaveBeenCalledWith(false, true)
    expect(a.pos).toEqual([50, 80])
    expect(b.pos).toEqual([500, 80])
    expect(c.pos).toEqual([50, 660])
  })

  it('returns 0 for an empty graph', () => {
    expect(arrangeGrid({ _nodes: [] }, 100, 2)).toBe(0)
  })
})

describe('handleArrangeCanvas', () => {
  it('routes grid to arrangeGrid without needing native arrange', () => {
    const graph = { _nodes: [node(1), node(2)] }
    const out = handleArrangeCanvas({ graph }, { layout: 'grid', columns: 2, margin: 80 })
    expect(out).toEqual({ arranged: 2, margin: 80, layout: 'grid' })
  })

  it('still delegates horizontal/vertical to the native arrange', () => {
    const graph = { _nodes: [node(1)], arrange: vi.fn() }
    ;(window as any).LiteGraph = { VERTICAL_LAYOUT: 'vertical' }
    const out = handleArrangeCanvas({ graph }, { layout: 'vertical', margin: 60 })
    expect(graph.arrange).toHaveBeenCalledWith(60, 'vertical')
    expect(out.layout).toBe('vertical')
    delete (window as any).LiteGraph
  })
})
