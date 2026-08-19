import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  handleCanvasCommand,
  handleCanvasFocus,
  handleGraphEdit,
  handleGraphGet,
  handleGraphRun,
} from './mcpGraphCommands'

function makeNode(overrides: any = {}) {
  return {
    id: 4,
    type: 'CheckpointLoaderSimple',
    title: 'Load Checkpoint',
    widgets: [{ name: 'ckpt_name', value: 'sd15.safetensors' }],
    inputs: [],
    outputs: [
      { name: 'MODEL', type: 'MODEL', links: [1] },
      { name: 'CLIP', type: 'CLIP', links: [] },
    ],
    connect: vi.fn(() => ({ id: 99 })),
    disconnectInput: vi.fn(),
    ...overrides,
  }
}

function makeApp(nodes: any[], links: any = {}) {
  const graph = {
    _nodes: nodes,
    links,
    getNodeById: (id: any) => nodes.find((n) => String(n.id) === String(id)),
    add: vi.fn((n: any) => { n.id = n.id ?? 100; nodes.push(n) }),
    remove: vi.fn((n: any) => nodes.splice(nodes.indexOf(n), 1)),
    setDirtyCanvas: vi.fn(),
  }
  return { app: { graph }, graph }
}

afterEach(() => {
  delete (window as any).LiteGraph
})

describe('handleGraphGet', () => {
  it('snapshots nodes with widgets, links and stage flag', () => {
    const ksampler = makeNode({
      id: 3,
      type: 'KSampler',
      title: 'KSampler',
      widgets: [{ name: 'seed', value: 5 }],
      inputs: [{ name: 'model', type: 'MODEL', link: 1 }],
      outputs: [{ name: 'LATENT', type: 'LATENT', links: [2] }],
    })
    const stage = makeNode({
      id: 7, comfyClass: 'ComfyTV.ImageStage', type: 'ComfyTV.ImageStage',
      widgets: [], outputs: [],
    })
    const { app } = makeApp([makeNode(), ksampler, stage], {
      1: { origin_id: 4, origin_slot: 0, target_id: 3 },
      2: { origin_id: 3, origin_slot: 0, target_id: 8 },
    })
    const out: any = handleGraphGet(app)
    expect(out.node_count).toBe(3)
    const byId = Object.fromEntries(out.nodes.map((n: any) => [n.node_id, n]))
    expect(byId['4'].widgets.ckpt_name).toBe('sd15.safetensors')
    expect(byId['4'].outputs[0].to_nodes).toEqual(['3'])
    expect(byId['3'].inputs[0]).toEqual(
      { name: 'model', type: 'MODEL', from_node: '4', from_slot: 0 })
    expect(byId['7'].is_stage).toBe(true)
    expect(byId['3'].is_stage).toBeUndefined()
  })

  it('throws without a graph', () => {
    expect(() => handleGraphGet({})).toThrow(/no graph/)
  })
})

describe('handleGraphEdit', () => {
  it('add_node creates, positions and sets widgets', () => {
    const { app, graph } = makeApp([])
    const created = makeNode({ id: undefined, widgets: [{ name: 'lora_name', value: '' }] })
    ;(window as any).LiteGraph = { createNode: vi.fn(() => created) }
    const out: any = handleGraphEdit(app, {
      ops: [{ op: 'add_node', type: 'LoraLoader', pos: [10, 20],
              widgets: { lora_name: 'x.safetensors' } }],
    })
    expect(out.applied[0]).toEqual(
      { op: 'add_node', node_id: '100', type: 'LoraLoader' })
    expect(created.pos).toEqual([10, 20])
    expect(created.widgets[0].value).toBe('x.safetensors')
    expect(graph.setDirtyCanvas).toHaveBeenCalled()
  })

  it('add_node rejects unknown types', () => {
    const { app } = makeApp([])
    ;(window as any).LiteGraph = { createNode: vi.fn(() => null) }
    expect(() => handleGraphEdit(app, {
      ops: [{ op: 'add_node', type: 'Nope' }],
    })).toThrow(/unknown node type Nope/)
  })

  it('set_widget validates the widget name', () => {
    const { app } = makeApp([makeNode()])
    expect(() => handleGraphEdit(app, {
      ops: [{ op: 'set_widget', node: '4', name: 'nope', value: 1 }],
    })).toThrow(/no widget 'nope'.*ckpt_name/)
  })

  it('connect resolves slots by name and by free-compatible fallback', () => {
    const src = makeNode()
    const dst = makeNode({
      id: 3, type: 'KSampler',
      inputs: [
        { name: 'model', type: 'MODEL', link: null },
        { name: 'clip', type: 'CLIP', link: null },
      ],
    })
    const { app } = makeApp([src, dst])
    const out: any = handleGraphEdit(app, {
      ops: [
        { op: 'connect', from_node: '4', from_slot: 'CLIP', to_node: '3', to_slot: 'clip' },
        { op: 'connect', from_node: '4', to_node: '3' },
      ],
    })
    expect(src.connect).toHaveBeenNthCalledWith(1, 1, dst, 1)
    expect(src.connect).toHaveBeenNthCalledWith(2, 0, dst, 0)
    expect(out.applied[1].input).toBe('model')
  })

  it('disconnect and remove_node work by id', () => {
    const node = makeNode({ inputs: [{ name: 'model', type: 'MODEL', link: 1 }] })
    const { app, graph } = makeApp([node])
    const out: any = handleGraphEdit(app, {
      ops: [
        { op: 'disconnect', node: '4', input: 'model' },
        { op: 'remove_node', node: '4' },
      ],
    })
    expect(node.disconnectInput).toHaveBeenCalledWith(0)
    expect(graph.remove).toHaveBeenCalledWith(node)
    expect(out.applied).toHaveLength(2)
  })

  it('reports the failing op index and prior progress', () => {
    const { app } = makeApp([makeNode()])
    expect(() => handleGraphEdit(app, {
      ops: [
        { op: 'set_title', node: '4', title: 'ok' },
        { op: 'remove_node', node: '999' },
      ],
    })).toThrow(/ops\[1\] \(remove_node\).*999.*1 earlier op/)
  })

  it('rejects unknown ops and empty ops', () => {
    const { app } = makeApp([makeNode()])
    expect(() => handleGraphEdit(app, { ops: [] })).toThrow(/non-empty/)
    expect(() => handleGraphEdit(app, { ops: [{ op: 'explode' }] }))
      .toThrow(/unknown op 'explode'/)
  })

  it('wraps ops in beforeChange/afterChange for single-step undo', () => {
    const node = makeNode()
    const { app, graph } = makeApp([node]) as any
    graph.beforeChange = vi.fn()
    graph.afterChange = vi.fn()
    handleGraphEdit(app, { ops: [{ op: 'set_title', node: '4', title: 'x' }] })
    expect(graph.beforeChange).toHaveBeenCalledTimes(1)
    expect(graph.afterChange).toHaveBeenCalledTimes(1)
    expect(() => handleGraphEdit(app, { ops: [{ op: 'explode' }] })).toThrow()
    expect(graph.afterChange).toHaveBeenCalledTimes(2)
  })

  it('set_mode maps names to litegraph modes', () => {
    const node = makeNode()
    const { app } = makeApp([node])
    handleGraphEdit(app, { ops: [{ op: 'set_mode', node: '4', mode: 'bypass' }] })
    expect((node as any).mode).toBe(4)
    handleGraphEdit(app, { ops: [{ op: 'set_mode', node: '4', mode: 'mute' }] })
    expect((node as any).mode).toBe(2)
    handleGraphEdit(app, { ops: [{ op: 'set_mode', node: '4', mode: 'always' }] })
    expect((node as any).mode).toBe(0)
    expect(() => handleGraphEdit(app, {
      ops: [{ op: 'set_mode', node: '4', mode: 'sideways' }],
    })).toThrow(/invalid mode/)
  })

  it('clone adds a copy next to the original', () => {
    const copy = makeNode({ id: undefined })
    const node = makeNode({ pos: [100, 200], clone: vi.fn(() => copy) })
    const { app, graph } = makeApp([node])
    const out: any = handleGraphEdit(app, { ops: [{ op: 'clone', node: '4' }] })
    expect(graph.add).toHaveBeenCalledWith(copy)
    expect(copy.pos).toEqual([140, 240])
    expect(out.applied[0].cloned_from).toBe('4')
  })

  it('set_color writes and clears colors', () => {
    const node = makeNode()
    const { app } = makeApp([node])
    handleGraphEdit(app, {
      ops: [{ op: 'set_color', node: '4', color: '#223', bgcolor: '#335' }],
    })
    expect((node as any).color).toBe('#223')
    expect((node as any).bgcolor).toBe('#335')
    handleGraphEdit(app, { ops: [{ op: 'set_color', node: '4', color: '' }] })
    expect((node as any).color).toBeUndefined()
  })

  it('collapse is idempotent set semantics over the native toggle', () => {
    const node = makeNode({
      flags: {},
      collapse: vi.fn(function (this: any) {
        this.flags.collapsed = !this.flags.collapsed
      }),
    })
    const { app } = makeApp([node])
    let out: any = handleGraphEdit(app, { ops: [{ op: 'collapse', node: '4' }] })
    expect(out.applied[0].collapsed).toBe(true)
    out = handleGraphEdit(app, { ops: [{ op: 'collapse', node: '4' }] })
    expect(out.applied[0].collapsed).toBe(true)
    expect((node as any).collapse).toHaveBeenCalledTimes(1)
    out = handleGraphEdit(app, {
      ops: [{ op: 'collapse', node: '4', collapsed: false }],
    })
    expect(out.applied[0].collapsed).toBe(false)
  })

  it('pin sets the requested state', () => {
    const node = makeNode({ pin: vi.fn() })
    const { app } = makeApp([node])
    handleGraphEdit(app, { ops: [{ op: 'pin', node: '4' }] })
    expect((node as any).pin).toHaveBeenCalledWith(true)
    handleGraphEdit(app, { ops: [{ op: 'pin', node: '4', pinned: false }] })
    expect((node as any).pin).toHaveBeenCalledWith(false)
  })

  it('convert_to_subgraph packs nodes via the graph API', () => {
    const a = makeNode({ id: 1 })
    const b = makeNode({ id: 2 })
    const subNode = makeNode({ id: 30 })
    const { app, graph } = makeApp([a, b]) as any
    graph.convertToSubgraph = vi.fn(() => ({ node: subNode }))
    app.canvas = { select: vi.fn() }
    const out: any = handleGraphEdit(app, {
      ops: [{ op: 'convert_to_subgraph', nodes: ['1', '2'] }],
    })
    expect(graph.convertToSubgraph).toHaveBeenCalledWith(new Set([a, b]))
    expect(app.canvas.select).toHaveBeenCalledWith(subNode)
    expect(out.applied[0]).toEqual(
      { op: 'convert_to_subgraph', node_id: '30', packed: 2 })
  })

  it('unpack_subgraph requires a subgraph node', () => {
    const plain = makeNode({ id: 1 })
    const sub = makeNode({ id: 2, subgraph: {} })
    const { app, graph } = makeApp([plain, sub]) as any
    graph.unpackSubgraph = vi.fn()
    expect(() => handleGraphEdit(app, {
      ops: [{ op: 'unpack_subgraph', node: '1' }],
    })).toThrow(/not a subgraph node/)
    handleGraphEdit(app, { ops: [{ op: 'unpack_subgraph', node: '2' }] })
    expect(graph.unpackSubgraph).toHaveBeenCalledWith(
      sub, { skipMissingNodes: true })
  })

  it('create_group wraps the named nodes', () => {
    const a = makeNode({ id: 1, pos: [0, 0], size: [100, 50] })
    const b = makeNode({ id: 2, pos: [300, 100], size: [100, 50] })
    const { app, graph } = makeApp([a, b])
    class FakeGroup {
      title = ''
      pos: number[] = []
      size: number[] = []
      recomputeInsideNodes = vi.fn()
    }
    ;(window as any).LiteGraph = { LGraphGroup: FakeGroup }
    const out: any = handleGraphEdit(app, {
      ops: [{ op: 'create_group', title: 'Pair', nodes: ['1', '2'] }],
    })
    expect(out.applied[0]).toEqual(
      { op: 'create_group', title: 'Pair', node_count: 2 })
    const group = (graph.add as any).mock.calls.at(-1)[0]
    expect(group.title).toBe('Pair')
    expect(group.pos[0]).toBeLessThan(0)
    expect(group.size[0]).toBeGreaterThan(400)
  })
})

describe('handleCanvasCommand', () => {
  it('executes whitelisted commands via extensionManager', async () => {
    const execute = vi.fn(async () => undefined)
    const app = { extensionManager: { command: { execute } } }
    const out: any = await handleCanvasCommand(app, { command: 'Comfy.Undo' })
    expect(execute).toHaveBeenCalledWith('Comfy.Undo')
    expect(out.executed).toBe('Comfy.Undo')
  })

  it('rejects non-whitelisted commands', async () => {
    const app = { extensionManager: { command: { execute: vi.fn() } } }
    await expect(handleCanvasCommand(app, { command: 'Comfy.ClearWorkflow' }))
      .rejects.toThrow(/not allowed/)
  })

  it('pre-selects nodes before selection-dependent commands', async () => {
    const a = makeNode({ id: 1 })
    const b = makeNode({ id: 2 })
    const execute = vi.fn(async () => undefined)
    const { app } = makeApp([a, b]) as any
    app.extensionManager = { command: { execute } }
    app.canvas = { deselectAll: vi.fn(), select: vi.fn(), setDirty: vi.fn() }
    await handleCanvasCommand(app, {
      command: 'Comfy.Graph.GroupSelectedNodes', nodes: ['1', '2'],
    })
    expect(app.canvas.deselectAll).toHaveBeenCalled()
    expect(app.canvas.select).toHaveBeenCalledWith(a)
    expect(app.canvas.select).toHaveBeenCalledWith(b)
    expect(execute).toHaveBeenCalledWith('Comfy.Graph.GroupSelectedNodes')
  })

  it('unknown node in pre-selection fails before executing', async () => {
    const execute = vi.fn(async () => undefined)
    const { app } = makeApp([makeNode({ id: 1 })]) as any
    app.extensionManager = { command: { execute } }
    app.canvas = { deselectAll: vi.fn(), select: vi.fn() }
    await expect(handleCanvasCommand(app, {
      command: 'Comfy.Canvas.FitView', nodes: ['999'],
    })).rejects.toThrow(/not found/)
    expect(execute).not.toHaveBeenCalled()
  })

  it('falls back to api.interrupt when the command system is missing', async () => {
    const interrupt = vi.fn(async () => undefined)
    const app = { api: { interrupt } }
    const out: any = await handleCanvasCommand(app, { command: 'Comfy.Interrupt' })
    expect(interrupt).toHaveBeenCalled()
    expect(out.via).toBe('api.interrupt')
    await expect(handleCanvasCommand(app, { command: 'Comfy.Undo' }))
      .rejects.toThrow(/not exposed/)
  })
})

describe('handleCanvasFocus', () => {
  it('selects and animates to the node', () => {
    const node = makeNode({ pos: [100, 100], size: [200, 100] })
    const canvas = {
      deselectAllNodes: vi.fn(),
      selectNodes: vi.fn(),
      animateToBounds: vi.fn(),
      setDirty: vi.fn(),
    }
    const { app } = makeApp([node]) as any
    app.canvas = canvas
    const out: any = handleCanvasFocus(app, { node: '4' })
    expect(canvas.selectNodes).toHaveBeenCalledWith([node])
    expect(canvas.animateToBounds).toHaveBeenCalledWith([20, 20, 360, 260])
    expect(out.focused).toBe('4')
  })

  it('falls back to centerOnNode', () => {
    const node = makeNode()
    const canvas = {
      selectNode: vi.fn(),
      centerOnNode: vi.fn(),
    }
    const { app } = makeApp([node]) as any
    app.canvas = canvas
    handleCanvasFocus(app, { node: '4' })
    expect(canvas.centerOnNode).toHaveBeenCalledWith(node)
  })

  it('errors on unknown node', () => {
    const { app } = makeApp([makeNode()]) as any
    app.canvas = { centerOnNode: vi.fn() }
    expect(() => handleCanvasFocus(app, { node: '999' })).toThrow(/not found/)
  })
})

describe('handleGraphRun', () => {
  function runApp(queueResult: any) {
    return {
      graph: {},
      graphToPrompt: vi.fn(async () => ({ output: { 1: {} }, workflow: {} })),
      api: { queuePrompt: vi.fn(async () => queueResult) },
    }
  }

  it('queues and returns the prompt id', async () => {
    const app = runApp({ prompt_id: 'p-1', number: 0, node_errors: {} })
    const out: any = await handleGraphRun(app)
    expect(out).toEqual({ queued: true, prompt_id: 'p-1' })
    expect(app.api.queuePrompt).toHaveBeenCalledWith(
      0, { output: { 1: {} }, workflow: {} })
  })

  it('surfaces node_errors when nothing was queued', async () => {
    const app = runApp({
      prompt_id: '',
      node_errors: { 3: { errors: [{ message: 'bad seed' }] } },
    })
    await expect(handleGraphRun(app)).rejects.toThrow(/bad seed/)
  })

  it('maps thrown queue errors through extractRunError', async () => {
    const app = runApp(null)
    app.api.queuePrompt = vi.fn(async () => {
      throw { response: { error: { message: 'boom' } } }
    })
    await expect(handleGraphRun(app)).rejects.toThrow(/queue rejected.*boom/)
  })
})
