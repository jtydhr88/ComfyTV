import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '@/lib/comfyApp'
import { buildCanvasSnapshot, installCanvasMirror } from './useCanvasMirror'

function makeNode(overrides: any = {}) {
  return {
    id: 3,
    comfyClass: 'ComfyTV.ImageStage',
    title: 'Image',
    properties: { comfytv_stage_uid: 'u1' },
    widgets: [
      { name: 'workflow', value: 'Flux Schnell' },
      { name: 'main_prompt', value: 'a cat @image_0 and @video_1' },
    ],
    inputs: [],
    ...overrides,
  }
}

function makeDeps(nodes: any[], stateByUid: Record<string, any> = {}, projectId = 'p1') {
  const graph = {
    _nodes: nodes,
    links: new Map(),
    getNodeById: (id: any) => nodes.find((n) => n.id === id),
  }
  return {
    deps: {
      resolveApp: () => ({ graph }),
      resolveProjectId: () => projectId,
      resolveStageState: (node: any) => stateByUid[node?.properties?.comfytv_stage_uid],
    },
    graph,
  }
}

describe('buildCanvasSnapshot', () => {
  it('returns null without a project id', () => {
    const { deps } = makeDeps([makeNode()], {}, '')
    expect(buildCanvasSnapshot(deps)).toBeNull()
  })

  it('collects only ComfyTV nodes with widgets, mentions and run state', () => {
    const native = makeNode({ id: 9, comfyClass: 'KSampler' })
    const { deps } = makeDeps(
      [makeNode(), native],
      { u1: { output: '/view?x', error: null } },
    )
    const snap = buildCanvasSnapshot(deps)!
    expect(snap.project_id).toBe('p1')
    expect(snap.stages).toHaveLength(1)
    const s = snap.stages[0]
    expect(s.uid).toBe('u1')
    expect(s.node_id).toBe('ComfyTV.ImageStage')
    expect(s.stage_class).toBe('ImageStage')
    expect(s.workflow).toBe('Flux Schnell')
    expect(s.mentions).toEqual(['image_0', 'video_1'])
    expect(s.last_run).toEqual({ status: 'ok' })
  })

  it('reports error and never states', () => {
    const nodes = [
      makeNode(),
      makeNode({ id: 4, properties: { comfytv_stage_uid: 'u2' } }),
    ]
    const { deps } = makeDeps(nodes, { u1: { error: { message: 'boom' } } })
    const snap = buildCanvasSnapshot(deps)!
    expect(snap.stages[0].last_run).toEqual({ status: 'error', error: 'boom' })
    expect(snap.stages[1].last_run).toEqual({ status: 'never' })
  })

  it('resolves upstream links to source stage uids', () => {
    const src = makeNode({ id: 1, properties: { comfytv_stage_uid: 'u-src' } })
    const dst = makeNode({
      id: 2,
      properties: { comfytv_stage_uid: 'u-dst' },
      inputs: [{ name: 'image', link: 77 }, { name: 'video', link: null }],
    })
    const { deps, graph } = makeDeps([src, dst])
    graph.links.set(77, { id: 77, origin_id: 1, origin_slot: 0 })
    const snap = buildCanvasSnapshot(deps)!
    const dstSnap = snap.stages.find((s: any) => s.uid === 'u-dst')!
    expect(dstSnap.inputs).toEqual([
      { slot: 'image', from_node: '1', from_uid: 'u-src' },
    ])
  })
})

describe('installCanvasMirror', () => {
  let fetchApi: ReturnType<typeof vi.fn>
  let uninstall: (() => void) | false
  let mcpActive: boolean

  function makeHost(): any {
    return {
      api: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
    }
  }

  function activityHandler(host: any): (() => void) | undefined {
    const call = host.api.addEventListener.mock.calls.find(
      ([event]: [string]) => event === 'comfytv-mcp-activity',
    )
    return call?.[1]
  }

  beforeEach(() => {
    vi.useFakeTimers()
    mcpActive = true
    fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockClear()
    fetchApi.mockImplementation(async (path: string) => {
      const body = String(path).includes('/comfytv/mcp_activity')
        ? { active: mcpActive }
        : { ok: true }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    uninstall = false
  })

  afterEach(() => {
    if (uninstall) uninstall()
    vi.useRealTimers()
  })

  async function flush() {
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(0)
  }

  function postedBodies(): any[] {
    return fetchApi.mock.calls
      .filter(([path]) => String(path).includes('/comfytv/canvas_state'))
      .map(([, init]) => JSON.parse((init as RequestInit).body as string))
  }

  it('stays dormant when no MCP client has connected', async () => {
    mcpActive = false
    const { deps } = makeDeps([makeNode()])
    const host = makeHost()
    uninstall = installCanvasMirror(host, deps)
    await flush()
    await vi.advanceTimersByTimeAsync(60000)
    expect(postedBodies()).toHaveLength(0)
  })

  it('activates when the mcp-activity broadcast arrives', async () => {
    mcpActive = false
    const { deps } = makeDeps([makeNode()])
    const host = makeHost()
    uninstall = installCanvasMirror(host, deps)
    await flush()
    expect(postedBodies()).toHaveLength(0)

    activityHandler(host)!()
    await flush()
    expect(postedBodies()).toHaveLength(1)
    expect(postedBodies()[0].stages).toHaveLength(1)
  })

  it('activates at install time when MCP was already active', async () => {
    const { deps } = makeDeps([makeNode()])
    const host = makeHost()
    uninstall = installCanvasMirror(host, deps)
    expect(uninstall).not.toBe(false)
    await flush()
    expect(postedBodies()).toHaveLength(1)
    expect(postedBodies()[0].stages).toHaveLength(1)
  })

  it('heartbeats while unchanged, full posts on change', async () => {
    const node = makeNode()
    const { deps } = makeDeps([node])
    const host = makeHost()
    uninstall = installCanvasMirror(host, deps)
    await flush()
    expect(postedBodies()).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(5000)
    expect(postedBodies()).toHaveLength(1) // unchanged, heartbeat not yet due

    await vi.advanceTimersByTimeAsync(10000)
    let bodies = postedBodies()
    expect(bodies).toHaveLength(2)
    expect(bodies[1]).toEqual({ project_id: 'p1', heartbeat: true })

    node.widgets[1].value = 'a dog'
    await vi.advanceTimersByTimeAsync(5000)
    bodies = postedBodies()
    expect(bodies).toHaveLength(3)
    expect(bodies[2].stages[0].prompt).toBe('a dog')
  })

  it('falls back to a full post after a failed heartbeat', async () => {
    const { deps } = makeDeps([makeNode()])
    const host = makeHost()
    uninstall = installCanvasMirror(host, deps)
    await flush()
    expect(postedBodies()).toHaveLength(1)

    fetchApi.mockImplementationOnce(
      async () => new Response('{"error":"no snapshot"}', { status: 404 }),
    )
    await vi.advanceTimersByTimeAsync(15000) // heartbeat fails
    await vi.advanceTimersByTimeAsync(5000) // next tick re-posts full snapshot
    const bodies = postedBodies()
    expect(bodies[bodies.length - 1].stages).toBeDefined()
  })

  it('refuses a second install and unsubscribes on uninstall', async () => {
    const { deps } = makeDeps([makeNode()])
    const host = makeHost()
    uninstall = installCanvasMirror(host, deps)
    expect(installCanvasMirror(host, deps)).toBe(false)
    await flush()
    ;(uninstall as () => void)()
    uninstall = false
    expect(host.api.removeEventListener).toHaveBeenCalledWith(
      'comfytv-mcp-activity', expect.any(Function),
    )
  })

  it('skips posting entirely when there is no project', async () => {
    const { deps } = makeDeps([makeNode()], {}, '')
    const host = makeHost()
    uninstall = installCanvasMirror(host, deps)
    await flush()
    await vi.advanceTimersByTimeAsync(20000)
    expect(postedBodies()).toHaveLength(0)
  })
})
