import { describe, expect, it } from 'vitest'
import {
  findDownstreamScopeNodes,
  scopeKindOf,
} from './useDownstreamScopes'
import type { LGraphNode } from '@/lib/comfyApp'

function makeGraph(nodes: any[], links: Record<number, any>) {
  return {
    links,
    getNodeById: (id: unknown) => nodes.find((n) => n.id === id) ?? null,
  }
}

function fxNode(graph: any, links: number[][]): LGraphNode {
  return {
    id: 1,
    graph,
    outputs: links.map((ids) => ({ links: ids })),
  } as unknown as LGraphNode
}

describe('findDownstreamScopeNodes', () => {
  it('collects scope nodes wired to any output', () => {
    const scopeA = { id: 2, comfyClass: 'ComfyTV.VideoScopesStage' }
    const scopeB = { id: 3, type: 'ComfyTV.VideoScopesStage' }
    const other = { id: 4, comfyClass: 'ComfyTV.VideoColorStage' }
    const graph = makeGraph([scopeA, scopeB, other], {
      10: { target_id: 2 },
      11: { target_id: 3 },
      12: { target_id: 4 },
    })
    const found = findDownstreamScopeNodes(fxNode(graph, [[10, 12], [11]]))
    expect(found.map((n: any) => n.id)).toEqual([2, 3])
  })

  it('dedupes a scope wired twice', () => {
    const scope = { id: 2, comfyClass: 'ComfyTV.VideoScopesStage' }
    const graph = makeGraph([scope], {
      10: { target_id: 2 },
      11: { target_id: 2 },
    })
    expect(findDownstreamScopeNodes(fxNode(graph, [[10, 11]]))).toHaveLength(1)
  })

  it('supports Map-shaped link tables', () => {
    const scope = { id: 2, comfyClass: 'ComfyTV.VideoScopesStage' }
    const links = new Map([[10, { target_id: 2 }]])
    const graph = {
      links,
      getNodeById: (id: unknown) => (id === 2 ? scope : null),
    }
    expect(findDownstreamScopeNodes(fxNode(graph, [[10]]))).toHaveLength(1)
  })

  it('returns empty without a graph or links', () => {
    expect(findDownstreamScopeNodes({ id: 1 } as unknown as LGraphNode))
      .toEqual([])
    const graph = makeGraph([], {})
    expect(findDownstreamScopeNodes(fxNode(graph, [[99]]))).toEqual([])
  })
})

describe('scopeKindOf', () => {
  it('reads the scope widget with a waveform fallback', () => {
    const withWidget = {
      widgets: [{ name: 'scope', value: 'vectorscope' }],
    } as unknown as LGraphNode
    expect(scopeKindOf(withWidget)).toBe('vectorscope')
    expect(scopeKindOf({} as unknown as LGraphNode)).toBe('waveform')
    const empty = {
      widgets: [{ name: 'scope', value: '' }],
    } as unknown as LGraphNode
    expect(scopeKindOf(empty)).toBe('waveform')
  })
})
