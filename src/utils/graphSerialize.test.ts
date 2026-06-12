import { describe, it, expect } from 'vitest'

import {
  collectReachableNodeIds,
  serializeNodeEntry,
  buildScopedPrompt,
} from './graphSerialize'

function makeGraph(nodes: any[]) {
  const byId = new Map<number, any>(nodes.map(n => [n.id, n]))
  const links = new Map<number, any>()
  for (const n of nodes) {
    n.graph = { links, getNodeById: (id: any) => byId.get(Number(id)) }
  }
  return {
    _nodes: nodes,
    links,
    getNodeById: (id: any) => byId.get(Number(id)),
  }
}

describe('collectReachableNodeIds', () => {
  it('returns only the target for non-bridge nodes', () => {
    const target = { id: 3, comfyClass: 'ComfyTV.ImageStage', inputs: [] }
    const app = { graph: makeGraph([target]) }
    const reachable = collectReachableNodeIds(app, target)
    expect([...reachable]).toEqual([3])
  })

  it('walks upstream links for BridgeTo nodes', () => {
    const src = { id: 1, comfyClass: 'X', inputs: [] }
    const mid = { id: 2, comfyClass: 'Y', inputs: [{ link: 10 }] }
    const target = { id: 3, comfyClass: 'ComfyTV.BridgeToFoo', inputs: [{ link: 20 }] }
    const graph = makeGraph([src, mid, target])
    graph.links.set(20, { origin_id: 2 })
    graph.links.set(10, { origin_id: 1 })
    const app = { graph }
    const reachable = collectReachableNodeIds(app, target)
    expect([...reachable].sort()).toEqual([1, 2, 3])
  })
})

describe('serializeNodeEntry', () => {
  it('serializes widget values and link inputs', async () => {
    const graph = { links: new Map([[5, { origin_id: 9, origin_slot: 1 }]]) }
    const node = {
      comfyClass: 'ComfyTV.ImageStage',
      title: 'My Stage',
      graph,
      widgets: [
        { name: 'main_prompt', value: 'hi' },
        { name: 'steps', type: 'INT', value: 20 },
      ],
      inputs: [{ name: 'image', link: 5 }],
    }
    const entry = await serializeNodeEntry(node)
    expect(entry.class_type).toBe('ComfyTV.ImageStage')
    expect(entry._meta.title).toBe('My Stage')
    expect(entry.inputs.main_prompt).toBe('hi')
    expect(entry.inputs.steps).toBe(20)
    expect(entry.inputs.image).toEqual(['9', 1])
  })

  it('coerces invalid numeric widget to default or zero', async () => {
    const node = {
      comfyClass: 'X',
      graph: { links: new Map() },
      widgets: [
        { name: 'a', type: 'FLOAT', value: '', options: { default: 4 } },
        { name: 'b', type: 'INT', value: 'nope' },
      ],
      inputs: [],
    }
    const entry = await serializeNodeEntry(node)
    expect(entry.inputs.a).toBe(4)
    expect(entry.inputs.b).toBe(0)
  })

  it('skips widgets with serialize=false', async () => {
    const node = {
      comfyClass: 'X',
      graph: { links: new Map() },
      widgets: [{ name: 'hidden', value: 1, options: { serialize: false } }],
      inputs: [],
    }
    const entry = await serializeNodeEntry(node)
    expect('hidden' in entry.inputs).toBe(false)
  })

  it('wraps array values, tagging curve type', async () => {
    const node = {
      comfyClass: 'X',
      graph: { links: new Map() },
      widgets: [
        { name: 'pts', type: 'curve', value: [1, 2] },
        { name: 'list', value: [3, 4] },
      ],
      inputs: [],
    }
    const entry = await serializeNodeEntry(node)
    expect(entry.inputs.pts).toEqual({ __type__: 'CURVE', __value__: [1, 2] })
    expect(entry.inputs.list).toEqual({ __value__: [3, 4] })
  })
})

describe('buildScopedPrompt', () => {
  it('includes only reachable, non-muted, non-virtual nodes', async () => {
    const nodes = [
      { id: 1, comfyClass: 'A', graph: { links: new Map() }, widgets: [], inputs: [] },
      { id: 2, comfyClass: 'B', mode: 2, graph: { links: new Map() }, widgets: [], inputs: [] },
      { id: 3, comfyClass: 'C', isVirtualNode: true, graph: { links: new Map() }, widgets: [], inputs: [] },
      { id: 4, comfyClass: 'D', graph: { links: new Map() }, widgets: [], inputs: [] },
    ]
    const app = { graph: { _nodes: nodes } }
    const reachable = new Set([1, 2, 3])
    const pm = await buildScopedPrompt(app, reachable)
    expect(Object.keys(pm.output)).toEqual(['1'])
    expect(pm.workflow).toEqual({ nodes: [], links: [], version: 0.4 })
  })
})
