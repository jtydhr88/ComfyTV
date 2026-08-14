import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '@/lib/comfyApp'
import { findStageNode, installMcpCommandBus } from './useMcpCommandBus'

function makeNode(overrides: any = {}) {
  return {
    id: 3,
    comfyClass: 'ComfyTV.ImageStage',
    title: 'Image',
    properties: { comfytv_stage_uid: 'u1' },
    widgets: [
      { name: 'workflow', value: 'Old Workflow' },
      { name: 'main_prompt', value: 'old prompt' },
    ],
    inputs: [],
    outputs: [{ type: 'COMFYTV_IMAGE', links: [] }],
    connect: vi.fn(() => ({ id: 1 })),
    ...overrides,
  }
}

function makeHost(nodes: any[], projectId = 'p1') {
  const graph = {
    _nodes: nodes,
    getNodeById: (id: any) => nodes.find((n) => String(n.id) === String(id)),
    setDirtyCanvas: vi.fn(),
    add: vi.fn((n: any) => nodes.push(n)),
  }
  const host: any = {
    graph,
    api: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      clientId: 'tab-1',
    },
  }
  const deps = {
    resolveApp: () => host,
    resolveProjectId: () => projectId,
  }
  return { host, graph, deps }
}

function commandHandler(host: any): ((event: any) => Promise<void>) | undefined {
  const call = host.api.addEventListener.mock.calls.find(
    ([event]: [string]) => event === 'comfytv-mcp-command',
  )
  return call?.[1]
}

describe('installMcpCommandBus', () => {
  let fetchApi: ReturnType<typeof vi.fn>
  let uninstall: (() => void) | false

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockClear()
    fetchApi.mockImplementation(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
    uninstall = false
  })

  afterEach(() => {
    if (uninstall) uninstall()
    delete (window as any).LiteGraph
  })

  function postedResults(): any[] {
    return fetchApi.mock.calls
      .filter(([path]) => String(path).includes('/comfytv/mcp_command_result'))
      .map(([, init]) => JSON.parse((init as RequestInit).body as string))
  }

  async function dispatch(host: any, cmd: any) {
    await commandHandler(host)!({ detail: cmd })
  }

  it('ignores malformed, mistargeted and other-project commands', async () => {
    const { host, deps } = makeHost([makeNode()])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, {})
    await dispatch(host, { id: 'c1', action: 'run_stage', target_client_id: 'tab-9' })
    await dispatch(host, { id: 'c2', action: 'run_stage', project_id: 'other' })
    expect(postedResults()).toHaveLength(0)
  })

  it('installs once and uninstalls cleanly', () => {
    const { host, deps } = makeHost([])
    uninstall = installMcpCommandBus(host, deps)
    expect(uninstall).not.toBe(false)
    expect(installMcpCommandBus(host, deps)).toBe(false)
    ;(uninstall as () => void)()
    uninstall = false
    expect(host.api.removeEventListener).toHaveBeenCalled()
  })

  it('add_stage creates, claims a uid and applies fields', async () => {
    const { host, deps } = makeHost([makeNode()])
    const created = makeNode({ id: 9, properties: {}, title: '' })
    ;(window as any).LiteGraph = { createNode: vi.fn(() => created) }
    uninstall = installMcpCommandBus(host, deps)

    await dispatch(host, {
      id: 'c1', action: 'add_stage', node_class: 'ComfyTV.ImageStage',
      title: 'Hero', prompt: 'a cat',
    })

    const [result] = postedResults()
    expect(result.ok).toBe(true)
    expect(result.command_id).toBe('c1')
    expect(result.result.graph_node_id).toBe('9')
    expect(result.result.uid).toBe(created.properties.comfytv_stage_uid)
    expect(created.title).toBe('Hero')
    expect(created.widgets[1].value).toBe('a cat')
  })

  it('add_stage reports unknown node classes', async () => {
    const { host, deps } = makeHost([])
    ;(window as any).LiteGraph = { createNode: vi.fn(() => null) }
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, { id: 'c1', action: 'add_stage', node_class: 'ComfyTV.Nope' })
    const [result] = postedResults()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('could not create node')
  })

  it('set_stage finds by uid and reports updated fields', async () => {
    const node = makeNode()
    const { host, deps } = makeHost([node])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, {
      id: 'c1', action: 'set_stage', node: 'u1',
      prompt: 'new prompt', workflow: 'New Workflow', title: 'Renamed',
    })
    const [result] = postedResults()
    expect(result.ok).toBe(true)
    expect(result.result.updated).toEqual(['workflow', 'prompt', 'title'])
    expect(node.widgets[0].value).toBe('New Workflow')
    expect(node.widgets[1].value).toBe('new prompt')
    expect(node.title).toBe('Renamed')
  })

  it('set_stage applies arbitrary widgets by name', async () => {
    const node = makeNode({
      widgets: [
        { name: 'workflow', value: '' },
        { name: 'main_prompt', value: '' },
        { name: 'duration', value: 5 },
        { name: 'end_zoom', value: 1.3 },
      ],
    })
    const { host, deps } = makeHost([node])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, {
      id: 'c1', action: 'set_stage', node: 'u1',
      widgets: { duration: 8, end_zoom: 1.5 },
    })
    const [result] = postedResults()
    expect(result.ok).toBe(true)
    expect(result.result.updated).toEqual(['widgets.duration', 'widgets.end_zoom'])
    expect(node.widgets[2].value).toBe(8)
    expect(node.widgets[3].value).toBe(1.5)
  })

  it('set_stage routes the stage to a server and back to local', async () => {
    const node = makeNode()
    const { host, deps } = makeHost([node])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, { id: 'c1', action: 'set_stage', node: 'u1', server: '3' })
    expect(node.properties.comfytv_server).toBe('3')
    await dispatch(host, { id: 'c2', action: 'set_stage', node: 'u1', server: 'local' })
    expect(node.properties.comfytv_server).toBe('')
    const results = postedResults()
    expect(results[0].result.updated).toEqual(['server'])
    expect(results[1].ok).toBe(true)
  })

  it('set_stage writes asset refs with slot autofill', async () => {
    const node = makeNode()
    const { host, deps } = makeHost([node])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, {
      id: 'c1', action: 'set_stage', node: 'u1',
      asset_refs: [{ asset_id: 5 }, { asset_id: 9, type: 'video' }, { asset_id: 7, slot: 6 }],
    })
    const [result] = postedResults()
    expect(result.ok).toBe(true)
    expect(result.result.updated).toEqual(['asset_refs'])
    expect(node.properties.comfytv_image_refs).toEqual([
      { asset_id: 5, slot: 0 },
      { asset_id: 9, slot: 0, type: 'video' },
      { asset_id: 7, slot: 6 },
    ])
  })

  it('set_stage autofills slots per type namespace', async () => {
    const node = makeNode()
    const { host, deps } = makeHost([node])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, {
      id: 'c1', action: 'set_stage', node: 'u1',
      asset_refs: [
        { asset_id: 1 }, { asset_id: 2 }, { asset_id: 3, type: 'video' },
        { asset_id: 4, type: 'audio' }, { asset_id: 5, type: 'video' },
      ],
    })
    expect(node.properties.comfytv_image_refs).toEqual([
      { asset_id: 1, slot: 0 },
      { asset_id: 2, slot: 1 },
      { asset_id: 3, slot: 0, type: 'video' },
      { asset_id: 4, slot: 0, type: 'audio' },
      { asset_id: 5, slot: 1, type: 'video' },
    ])
  })

  it('set_stage warns on dangling prompt mentions', async () => {
    const node = makeNode()
    const { host, deps } = makeHost([node])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, {
      id: 'c1', action: 'set_stage', node: 'u1',
      prompt: 'Animate @image_1 gently, keep @image_1 style',
      asset_refs: [{ asset_id: 5 }],
    })
    const [result] = postedResults()
    expect(result.ok).toBe(true)
    expect(result.result.warnings).toHaveLength(1)
    expect(result.result.warnings[0]).toContain('@image_1')
    expect(result.result.warnings[0]).toContain('[0]')
  })

  it('set_stage stays silent when mentions resolve', async () => {
    const node = makeNode()
    const { host, deps } = makeHost([node])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, {
      id: 'c1', action: 'set_stage', node: 'u1',
      prompt: 'Use @image_0 with @video_0 as motion',
      asset_refs: [{ asset_id: 5 }, { asset_id: 9, type: 'video' }],
    })
    const [result] = postedResults()
    expect(result.ok).toBe(true)
    expect(result.result.warnings).toBeUndefined()
  })

  it('connect_stages reports dangling mentions on the destination', async () => {
    const dst = makeNode({
      id: 4,
      properties: { comfytv_stage_uid: 'u2' },
      widgets: [{ name: 'main_prompt', value: 'animate @image_1 softly' }],
      inputs: [{ name: 'images.image0', type: 'COMFYTV_IMAGE', link: null }],
    })
    const src = makeNode({
      connect: vi.fn(() => { dst.inputs[0].link = 9; return { id: 9 } }),
    })
    const { host, deps } = makeHost([src, dst])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, {
      id: 'c1', action: 'connect_stages', from_node: '3', to_node: 'u2',
    })
    const [result] = postedResults()
    expect(result.ok).toBe(true)
    expect(result.result.warnings).toHaveLength(1)
    expect(result.result.warnings[0]).toContain('@image_1')
  })

  it('set_stage clears asset refs with an empty array', async () => {
    const node = makeNode({
      properties: { comfytv_stage_uid: 'u1', comfytv_image_refs: [{ asset_id: 1, slot: 0 }] },
    })
    const { host, deps } = makeHost([node])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, { id: 'c1', action: 'set_stage', node: 'u1', asset_refs: [] })
    expect(node.properties.comfytv_image_refs).toEqual([])
  })

  it('set_stage lists widget names on an unknown widget', async () => {
    const node = makeNode()
    const { host, deps } = makeHost([node])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, {
      id: 'c1', action: 'set_stage', node: 'u1', widgets: { nope: 1 },
    })
    const [result] = postedResults()
    expect(result.ok).toBe(false)
    expect(result.error).toContain("no widget 'nope'")
    expect(result.error).toContain('main_prompt')
  })

  it('set_stage errors on a missing node', async () => {
    const { host, deps } = makeHost([makeNode()])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, { id: 'c1', action: 'set_stage', node: 'nope', prompt: 'x' })
    const [result] = postedResults()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('connect_stages resolves named and autogrow slots', async () => {
    const src = makeNode({ id: 1, properties: { comfytv_stage_uid: 'u-src' } })
    const dst = makeNode({
      id: 2,
      properties: { comfytv_stage_uid: 'u-dst' },
      inputs: [{ name: 'images.0', type: 'COMFYTV_IMAGE', link: null }],
    })
    const { host, deps } = makeHost([src, dst])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, {
      id: 'c1', action: 'connect_stages',
      from_node: 'u-src', to_node: 'u-dst', to_slot: 'images',
    })
    const [result] = postedResults()
    expect(result.ok).toBe(true)
    expect(result.result.input).toBe('images.0')
    expect(src.connect).toHaveBeenCalledWith(0, dst, 0)
  })

  it('connect_stages auto-picks the first free type-compatible input', async () => {
    const src = makeNode({ id: 1, properties: { comfytv_stage_uid: 'u-src' } })
    const dst = makeNode({
      id: 2,
      properties: { comfytv_stage_uid: 'u-dst' },
      inputs: [
        { name: 'video', type: 'COMFYTV_VIDEO', link: null },
        { name: 'images.0', type: 'COMFYTV_IMAGE', link: 7 },
        { name: 'images.1', type: 'COMFYTV_IMAGE', link: null },
      ],
    })
    const { host, deps } = makeHost([src, dst])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, {
      id: 'c1', action: 'connect_stages', from_node: '1', to_node: '2',
    })
    const [result] = postedResults()
    expect(result.ok).toBe(true)
    expect(result.result.input).toBe('images.1')
  })

  it('connect_stages auto-matches comma-separated multi-type inputs', async () => {
    const src = makeNode({ id: 1 })
    const dst = makeNode({
      id: 2,
      properties: { comfytv_stage_uid: 'u-dst' },
      inputs: [
        { name: 'batch', type: 'COMFYTV_IMAGES,COMFYTV_IMAGE', link: null },
      ],
    })
    const { host, deps } = makeHost([src, dst])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, {
      id: 'c1', action: 'connect_stages', from_node: '1', to_node: '2',
    })
    const [result] = postedResults()
    expect(result.ok).toBe(true)
    expect(result.result.input).toBe('batch')
  })

  it('connect_stages errors when no compatible input exists', async () => {
    const src = makeNode({ id: 1 })
    const dst = makeNode({
      id: 2,
      properties: { comfytv_stage_uid: 'u-dst' },
      inputs: [{ name: 'video', type: 'COMFYTV_VIDEO', link: null }],
    })
    const { host, deps } = makeHost([src, dst])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, {
      id: 'c1', action: 'connect_stages', from_node: '1', to_node: '2',
    })
    const [result] = postedResults()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('no free input')
    expect(result.error).toContain('video')
  })

  it('run_stage reuses the mounted stage API and reports started', async () => {
    const state = { running: false, error: null }
    const node = makeNode({
      __comfytvStageApi: {
        state,
        onRunRequest: vi.fn(async () => { state.running = true }),
      },
    })
    const { host, deps } = makeHost([node])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, { id: 'c1', action: 'run_stage', node: 'u1' })
    const [result] = postedResults()
    expect(result.ok).toBe(true)
    expect(result.result.started).toBe(true)
    expect(node.__comfytvStageApi.onRunRequest).toHaveBeenCalled()
  })

  it('run_stage surfaces the stage error when the run does not start', async () => {
    const state = { running: false, error: { message: 'upstream not ready' } }
    const node = makeNode({
      __comfytvStageApi: { state, onRunRequest: vi.fn(async () => {}) },
    })
    const { host, deps } = makeHost([node])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, { id: 'c1', action: 'run_stage', node: 'u1' })
    const [result] = postedResults()
    expect(result.ok).toBe(false)
    expect(result.error).toBe('upstream not ready')
  })

  it('director_get and director_edit route to the mounted director api', async () => {
    const director = {
      getState: vi.fn(() => ({ clips: [], total_seconds: 0 })),
      applyOps: vi.fn(async (ops: any[]) => ({ results: ops.map(o => ({ op: o.op })) })),
    }
    const node = makeNode({ __comfytvStageApi: { director } })
    const { host, deps } = makeHost([node])
    uninstall = installMcpCommandBus(host, deps)

    await dispatch(host, { id: 'c1', action: 'director_get', node: 'u1' })
    await dispatch(host, {
      id: 'c2', action: 'director_edit', node: 'u1',
      ops: [{ op: 'add_clip' }],
    })
    const results = postedResults()
    expect(results[0].ok).toBe(true)
    expect(results[0].result.clips).toEqual([])
    expect(results[1].ok).toBe(true)
    expect(results[1].result.applied).toEqual([{ op: 'add_clip' }])
    expect(director.applyOps).toHaveBeenCalledWith([{ op: 'add_clip' }])
  })

  it('director tools reject a non-director stage', async () => {
    const node = makeNode()
    const { host, deps } = makeHost([node])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, { id: 'c1', action: 'director_get', node: 'u1' })
    const [result] = postedResults()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Director')
  })

  it('cancel_stage calls onCancelRequest on a running stage', async () => {
    const state = { running: true, error: null }
    const node = makeNode({
      __comfytvStageApi: {
        state,
        onCancelRequest: vi.fn(async () => { state.running = false }),
      },
    })
    const { host, deps } = makeHost([node])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, { id: 'c1', action: 'cancel_stage', node: 'u1' })
    const [result] = postedResults()
    expect(result.ok).toBe(true)
    expect(result.result.cancelled).toBe(true)
    expect(node.__comfytvStageApi.onCancelRequest).toHaveBeenCalled()
  })

  it('cancel_stage rejects when the stage is not running', async () => {
    const node = makeNode({
      __comfytvStageApi: { state: { running: false },
                           onCancelRequest: vi.fn() },
    })
    const { host, deps } = makeHost([node])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, { id: 'c1', action: 'cancel_stage', node: 'u1' })
    const [result] = postedResults()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not running')
  })

  it('get_stage returns widgets, edges, refs and warnings', async () => {
    const src = makeNode()
    const node = makeNode({
      id: 4,
      properties: {
        comfytv_stage_uid: 'u2',
        comfytv_image_refs: [{ asset_id: 9, slot: 0 }],
      },
      widgets: [
        { name: 'main_prompt', value: 'use @image_2' },
        { name: 'duration_s', value: 4 },
        { name: 'long', value: 'y'.repeat(5000) },
        { name: 'fn', value: () => {} },
      ],
      inputs: [{ name: 'images.image0', type: 'COMFYTV_IMAGE', link: 11 }],
      outputs: [{ name: 'video', type: 'COMFYTV_VIDEO', links: [12] }],
      pos: [100, 200],
      __comfytvStageApi: { state: { running: false } },
    })
    const { host, deps, graph } = makeHost([src, node])
    ;(graph as any).links = {
      11: { origin_id: 3, target_id: 4 },
      12: { origin_id: 4, target_id: 8 },
    }
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, { id: 'c1', action: 'get_stage', node: 'u2' })
    const [result] = postedResults()
    expect(result.ok).toBe(true)
    const detail = result.result
    expect(detail.widgets.duration_s).toBe(4)
    expect(detail.widgets.long.length).toBe(4001)
    expect(detail.widgets.fn).toBeUndefined()
    expect(detail.inputs[0]).toEqual({
      name: 'images.image0', type: 'COMFYTV_IMAGE',
      connected: true, from_node: '3',
    })
    expect(detail.outputs[0].to_nodes).toEqual(['8'])
    expect(detail.asset_refs).toEqual([{ asset_id: 9, slot: 0 }])
    expect(detail.running).toBe(false)
    expect(detail.pos).toEqual([100, 200])
    expect(detail.warnings?.[0]).toContain('@image_2')
  })

  it('remove_stage removes the node from the graph', async () => {
    const node = makeNode()
    const { host, deps, graph } = makeHost([node])
    ;(graph as any).remove = vi.fn()
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, { id: 'c1', action: 'remove_stage', node: 'u1' })
    const [result] = postedResults()
    expect(result.ok).toBe(true)
    expect(result.result.removed).toBe(true)
    expect(result.result.uid).toBe('u1')
    expect((graph as any).remove).toHaveBeenCalledWith(node)
  })

  it('remove_stage errors on unknown or non-stage nodes', async () => {
    const { host, deps, graph } = makeHost([makeNode()])
    ;(graph as any).remove = vi.fn()
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, { id: 'c1', action: 'remove_stage', node: 'missing' })
    const [result] = postedResults()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not found')
    expect((graph as any).remove).not.toHaveBeenCalled()
  })

  it('scene tools route to the mounted scene3d api', async () => {
    const sceneApi = {
      getState: vi.fn(() => ({
        version: 1,
        primitives: [],
        characters: [{ id: 'char_1', model: 'dragon' }],
        models: [],
      })),
      clipNames: vi.fn(async () => ['fly', 'idle', 'roar']),
      resources: vi.fn(() => ({ camera_presets: [] })),
      isBusy: vi.fn(() => false),
      hasRecordableDuration: vi.fn(() => true),
      applyOps: vi.fn(async () => [{ op: 'add_primitive', id: 'prim_1' }]),
      configureOutput: vi.fn(),
      capture: vi.fn(async () => ({ image: '/view?a.png', images: '' })),
      record: vi.fn(async () => ({ video: '/view?a.webm' })),
    }
    const node = makeNode({
      comfyClass: 'ComfyTV.Scene3DStage',
      __comfytvStageApi: { scene3d: sceneApi },
    })
    const { host, deps } = makeHost([node])
    uninstall = installMcpCommandBus(host, deps)

    await dispatch(host, { id: 'c1', action: 'scene_get', node: 'u1' })
    await dispatch(host, {
      id: 'c2', action: 'scene_edit', node: 'u1',
      ops: [{ op: 'add_primitive', shape: 'cube' }],
    })
    await dispatch(host, {
      id: 'c3', action: 'scene_capture', node: 'u1', channel: 'depth',
    })
    await dispatch(host, { id: 'c4', action: 'scene_record', node: 'u1' })

    const results = postedResults()
    expect(results[0].result.scene.characters[0].available_clips)
      .toEqual(['fly', 'idle', 'roar'])
    expect(sceneApi.clipNames).toHaveBeenCalledWith('char_1')
    expect(results[0].result.has_recordable_duration).toBe(true)
    expect(results[1].result.applied).toEqual([{ op: 'add_primitive', id: 'prim_1' }])
    expect(sceneApi.applyOps).toHaveBeenCalledWith([{ op: 'add_primitive', shape: 'cube' }])
    expect(results[2].result.image).toBe('/view?a.png')
    expect(sceneApi.configureOutput).toHaveBeenCalledWith(
      { channel: 'depth', width: undefined, height: undefined })
    expect(results[3].result.video).toBe('/view?a.webm')
  })

  it('scene tools error on non-scene3d stages and busy scenes', async () => {
    const plain = makeNode()
    const busyNode = makeNode({
      id: 5,
      properties: { comfytv_stage_uid: 'u5' },
      __comfytvStageApi: { scene3d: {
        isBusy: () => true,
        getState: () => ({}), resources: () => ({}),
        hasRecordableDuration: () => false,
      } },
    })
    const { host, deps } = makeHost([plain, busyNode])
    uninstall = installMcpCommandBus(host, deps)

    await dispatch(host, { id: 'c1', action: 'scene_get', node: 'u1' })
    await dispatch(host, {
      id: 'c2', action: 'scene_edit', node: 'u5', ops: [{ op: 'remove', id: 'x' }],
    })
    const results = postedResults()
    expect(results[0].ok).toBe(false)
    expect(results[0].error).toContain('not a mounted Scene3D stage')
    expect(results[1].ok).toBe(false)
    expect(results[1].error).toContain('busy')
  })

  it('run_stage errors when the stage card is not mounted', async () => {
    const { host, deps } = makeHost([makeNode()])
    uninstall = installMcpCommandBus(host, deps)
    await dispatch(host, { id: 'c1', action: 'run_stage', node: 'u1' })
    const [result] = postedResults()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not mounted')
  })
})

describe('findStageNode', () => {
  it('prefers uid matches and falls back to graph ids, stages only', () => {
    const stage = makeNode()
    const native = { id: 8, comfyClass: 'KSampler' }
    const graph = {
      _nodes: [stage, native],
      getNodeById: (id: any) =>
        [stage, native].find((n) => String(n.id) === String(id)),
    }
    expect(findStageNode(graph, 'u1')).toBe(stage)
    expect(findStageNode(graph, '3')).toBe(stage)
    expect(findStageNode(graph, '8')).toBeNull()
    expect(findStageNode(graph, 'missing')).toBeNull()
  })
})
