import { describe, expect, it, vi } from 'vitest'

vi.mock('@/composables/dialog/useConfirmDialog', () => ({ askConfirm: vi.fn() }))
vi.mock('@/i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))

import { applyOpsToRecords, diffRecords, parseLinkKey, toRecords } from './coedit'
import type { DocRecords } from './coedit'

const ser = {
  nodes: [
    { id: 5, type: 'KSampler', pos: [10.04, 20], size: [200, 100], title: 'S',
      mode: 0 },
    { id: 7, type: 'SaveImage', pos: [400, 20], size: [180, 80], title: 'Save',
      mode: 0 },
  ],
  links: [[1, 5, 0, 7, 0, 'IMAGE']],
}

const liveNodes: Record<number, any> = {
  5: { widgets: [{ name: 'seed', value: 42 }, { name: 'sampler', value: 'euler' }] },
  7: { widgets: [] },
}
const graphStub = { getNodeById: (id: number) => liveNodes[id] ?? null }

describe('toRecords', () => {
  it('normalizes nodes, captures widgets by name, content-keys links', () => {
    const rec = toRecords(ser, graphStub)
    expect(rec.nodes['5'].type).toBe('KSampler')
    expect(rec.nodes['5'].pos).toEqual([10, 20])
    expect(rec.nodes['5'].widgets).toEqual({ seed: 42, sampler: 'euler' })
    expect(Object.keys(rec.links)).toEqual(['5:0>7:0'])
    expect(rec.links['5:0>7:0']).toEqual({ origin: '5', oslot: 0, target: '7', tslot: 0 })
  })

  it('accepts object-shaped links', () => {
    const rec = toRecords({ nodes: [], links: [{ id: 1, origin_id: 3, origin_slot: 1, target_id: 9, target_slot: 2 }] })
    expect(rec.links['3:1>9:2']).toBeTruthy()
  })
})

describe('diffRecords', () => {
  const base = () => toRecords(ser, graphStub)

  it('no changes → no ops', () => {
    expect(diffRecords(base(), base())).toEqual([])
  })

  it('field change → patch with only that field', () => {
    const next = base()
    next.nodes['5'].pos = [50, 60]
    const ops = diffRecords(base(), next)
    expect(ops).toEqual([{ kind: 'node', op: 'patch', id: '5', fields: { pos: [50, 60] } }])
  })

  it('widget change → widgets patch', () => {
    const next = base()
    next.nodes['5'].widgets = { seed: 43, sampler: 'euler' }
    const ops = diffRecords(base(), next)
    expect(ops[0]).toMatchObject({ op: 'patch', fields: { widgets: { seed: 43 } } })
  })

  it('add/remove node → put/remove', () => {
    const next = base()
    next.nodes['9'] = { type: 'Note', pos: [0, 0], size: [100, 50], title: '', mode: 0, widgets: { text: 'hi' } }
    delete next.nodes['7']
    delete next.links['5:0>7:0']  // serialize drops links of removed nodes
    const ops = diffRecords(base(), next)
    const kinds = ops.map((o) => `${o.op}:${o.id}`).sort()
    expect(kinds).toContain('put:9')
    expect(kinds).toContain('remove:7')
    expect(ops.some((o) => o.kind === 'link' && o.op === 'remove' && o.id === '5:0>7:0')).toBe(true)
  })

  it('type change → put replace', () => {
    const next = base()
    next.nodes['5'] = { ...next.nodes['5'], type: 'Other' }
    const ops = diffRecords(base(), next)
    expect(ops[0]).toMatchObject({ kind: 'node', op: 'put', id: '5' })
  })

  it('link add/remove', () => {
    const next = base()
    next.links['7:0>5:1'] = { origin: '7', oslot: 0, target: '5', tslot: 1 }
    delete next.links['5:0>7:0']
    const ops = diffRecords(base(), next)
    expect(ops.some((o) => o.kind === 'link' && o.op === 'put' && o.id === '7:0>5:1')).toBe(true)
    expect(ops.some((o) => o.kind === 'link' && o.op === 'remove' && o.id === '5:0>7:0')).toBe(true)
  })
})

describe('applyOpsToRecords', () => {
  it('round-trips a diff to convergence', () => {
    const a = toRecords(ser, graphStub)
    const b = toRecords(ser, graphStub)
    b.nodes['5'].pos = [99, 99]
    b.nodes['11'] = { type: 'Note', pos: [1, 1], size: [10, 10], title: 'n', mode: 0, widgets: {} }
    delete b.nodes['7']
    delete b.links['5:0>7:0']
    const ops = diffRecords(a, b)
    applyOpsToRecords(a, ops)
    expect(diffRecords(a, b)).toEqual([])
  })
})

describe('parseLinkKey', () => {
  it('parses content keys back to records', () => {
    expect(parseLinkKey('5:0>7:2')).toEqual({ origin: '5', oslot: 0, target: '7', tslot: 2 })
    expect(parseLinkKey('garbage')).toBeNull()
  })
})

const noopEngineDeps = {
  resolveApp: () => null,
  send: () => {},
  resolveSelfConnId: () => 'c1',
  resolveProjectId: () => 'p1',
}

function makeGraph() {
  return {
    serialize: () => ser,
    getNodeById: (id: number) => liveNodes[id] ?? null,
    beforeChange: () => {},
    afterChange: () => {},
    setDirtyCanvas: () => {},
    remove: () => {},
  }
}

describe('engine', () => {
  it('startHosting seeds the doc and installs graph hooks', async () => {
    const { createCoEditEngine } = await import('./coedit')
    const graph: any = makeGraph()
    const sent: any[] = []
    const engine = createCoEditEngine({
      ...noopEngineDeps,
      resolveApp: () => ({ graph }),
      send: (s: string) => { sent.push(JSON.parse(s)) },
    })
    engine.startHosting('p1')
    expect(sent[0].type).toBe('edit_put')
    expect(engine.isEditing()).toBe(true)
    expect(graph.__comfytvCoeditHooked).toBe(true)
    expect(typeof graph.onNodeAdded).toBe('function')
  })

  it('tick is inert until editing; scribe promotion enables blob refresh', async () => {
    const { createCoEditEngine } = await import('./coedit')
    const graph: any = makeGraph()
    const sent: any[] = []
    const engine = createCoEditEngine({
      ...noopEngineDeps,
      resolveApp: () => ({ graph }),
      send: (s: string) => { sent.push(JSON.parse(s)) },
    })
    engine.tick('p1')
    expect(sent).toEqual([])
    engine.startHosting('p1')
    expect(engine.isScribe()).toBe(false)
    engine.onMessage({ type: 'edit_scribe', project_id: 'p1', you: true })
    expect(engine.isScribe()).toBe(true)
  })

  it('capture pauses while another workflow tab is active', async () => {
    const { createCoEditEngine } = await import('./coedit')
    const docGraph: any = makeGraph()
    const otherGraph: any = { ...makeGraph(), serialize: () => ({ nodes: [], links: [] }) }
    let active = docGraph
    const sent: any[] = []
    const engine = createCoEditEngine({
      ...noopEngineDeps,
      resolveApp: () => ({ graph: active }),
      send: (s: string) => { sent.push(JSON.parse(s)) },
    })
    engine.startHosting('p1')
    sent.length = 0

    // switching to another tab must NOT diff the wrong graph into the doc
    active = otherGraph
    engine.tick('p1')
    expect(sent).toEqual([])

    active = docGraph
    engine.tick('p1')
    expect(sent).toEqual([])  // doc unchanged — still nothing to send
    expect(engine.isEditing()).toBe(true)
  })

  it('fastPos streams pos patches for selected nodes only', async () => {
    const { createCoEditEngine } = await import('./coedit')
    const node5 = { id: 5, pos: [10, 20], size: [200, 100],
      widgets: liveNodes[5].widgets }
    const graph: any = { ...makeGraph(), getNodeById: (id: number) => (id === 5 ? node5 : liveNodes[id] ?? null) }
    const canvas = { selected_nodes: { 5: node5 } }
    const sent: any[] = []
    const engine = createCoEditEngine({
      ...noopEngineDeps,
      resolveApp: () => ({ graph, canvas }),
      send: (s: string) => { sent.push(JSON.parse(s)) },
    })
    engine.startHosting('p1')  // shadow seeded
    sent.length = 0

    engine.fastPos()
    expect(sent).toEqual([])  // no movement yet

    node5.pos = [111, 222]
    engine.fastPos()
    expect(sent).toHaveLength(1)
    expect(sent[0].ops).toEqual([{ kind: 'node', op: 'patch', id: '5',
      fields: { pos: [111, 222] } }])

    engine.fastPos()
    expect(sent).toHaveLength(1)  // shadow updated — no resend
  })
})
