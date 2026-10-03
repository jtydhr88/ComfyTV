import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { api } from '@agent/scripts/api'
import { createAgentRestClient } from '../../services/agent/agentRestClient'
import { useAgentSession, type AgentSessionDeps } from './useAgentSession'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { serializeWorkflowReferences } from '../../utils/workflowReferenceText'

beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); vi.clearAllMocks() })
function fixture(accepted = false) {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const graph = {
    last_node_id: 12, last_link_id: 1, version: 0.4,
    nodes: [{ id: 0, type: 'CLIPTextEncode', pos: [12, 34], size: [400, 200], flags: {}, order: 0, mode: 0,
      inputs: [{ name: 'clip', type: 'CLIP', link: 1 }], outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [] }],
      properties: { 'Node name for S&R': 'CLIPTextEncode' }, widgets_values: ['  原文\\\"\n  '] },
      { id: 12, type: 'CheckpointLoaderSimple', widgets_values: ['model.safetensors'] }],
    links: [[1, 12, 1, 0, 0, 'CLIP']], groups: [{ title: 'Keep', bounding: [1, 2, 600, 400], color: '#fff' }],
    config: {}, extra: { ds: { scale: 1.2, offset: [3, 4] }, extension: { untouched: ['x', null, true] } }
  }
  const context = { id: 'saved-origin', tabPath: 'origin.json' }
  const tabs = { open_tabs: [{ workflow_id: 'saved-origin', name: 'Origin' }], current_tab: 'saved-origin' }
  const attachments = [{ ref: 'asset:7', name: 'original.png' }]
  const tags = [{ id: '0', title: 'Prompt', locatorId: '0' }]
  const references = [{ id: 'reference', name: '参考', textOffset: 2 }]
  const requests: { url: string; body: any }[] = []
  vi.mocked(api.fetchApi).mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      requests.push({ url, body: JSON.parse(String(init.body)) })
      if (accepted) return new Response(JSON.stringify({ thread_id: 'fixture-chat', message_id: 'fixture-turn' }))
      return new Response(JSON.stringify({ error: 'Fixture rejection; no model invoked' }), { status: 400 })
    }
    return new Response(JSON.stringify([]))
  })
  const workflow = {
    current: vi.fn(() => context), draft: vi.fn(() => ({ content: graph })), tabs: () => tabs,
    prepare: vi.fn(() => gate), adopted: vi.fn()
  }
  const capability = { attachments: true, attachment_transport: 'asset_refs', attachment_mixed_context: true }
  const deps = { rest: createAgentRestClient(), events: { subscribe: () => () => {} }, workflow,
    attachmentCapability: () => capability } as AgentSessionDeps
  const session = useAgentSession(deps)
  return { session, workflow, graph, context, tabs, attachments, tags, references, requests, release, capability }
}

describe('mixed asset reference click-time capture through REST JSON', () => {
  it('records the same click-time reference labels after a fixture ACK, not live mutated objects', async () => {
    const f = fixture(true)
    const sending = f.session.sendMessage('display capture', f.attachments, f.tags, f.references)
    f.attachments[0].name = 'LATE IMAGE'
    f.tags[0].title = 'LATE NODE'
    f.references[0].name = 'LATE REFERENCE'
    f.release()
    expect(await sending).toBe(true)
    const transcript = JSON.stringify(f.session.entries.value)
    expect(transcript).toContain('original.png')
    expect(transcript).toContain('Prompt #0')
    expect(transcript).toContain('参考')
    expect(transcript).not.toContain('LATE')
  })
  it.each(['new-chat', 'history'])('suppresses the old POST on %s during delayed preparation', async (navigation) => {
    const f = fixture()
    const sending = f.session.sendMessage('old', f.attachments, f.tags, f.references)
    if (navigation === 'new-chat') f.session.newChat()
    else await f.session.loadThread('history-thread')
    f.release()
    expect(await sending).toBe(false)
    expect(f.requests).toHaveLength(0)
    expect(f.session.entries.value).toEqual([])
  })
  it('keeps exact scoped locators distinct from colliding local root IDs through JSON', async () => {
    const f = fixture()
    Reflect.set(f.graph, 'definitions', { subgraphs: [{ id: '6c0ac044-71f8-4ac0-af9c-14e36c9c33d7', nodes: [{ id: 0, type: 'NestedPrompt', widgets_values: ['nested, not root'] }], links: [] }] })
    f.graph.nodes.push({ id: 13, type: '6c0ac044-71f8-4ac0-af9c-14e36c9c33d7', widgets_values: [] })
    const tags = [{ id: '0', title: 'Nested', locatorId: '6c0ac044-71f8-4ac0-af9c-14e36c9c33d7:0' }, { id: '0', title: 'Root' }]
    const sending = f.session.sendMessage('scoped selection', f.attachments, tags)
    tags[0].locatorId = 'c5cc8591-5f24-4fc4-9ed1-aa00ff776655:0'
    f.release()
    await sending
    expect(f.requests[0].body.selection).toEqual({ node_ids: ['0', '0'], node_locators: ['6c0ac044-71f8-4ac0-af9c-14e36c9c33d7:0', '0'] })
    expect(f.requests[0].body.draft.content.definitions.subgraphs[0].nodes[0].widgets_values).toEqual(['nested, not root'])
    // Capture only: semantic validation / acceptance belongs to the backend.
  })
  it.each(['ordinary', 'old-reference-capability', 'no-images'])('retains existing post-prepare behavior for %s', async (mode) => {
    const f = fixture()
    if (mode === 'ordinary') f.capability.attachment_transport = 'inline'
    if (mode === 'old-reference-capability') f.capability.attachment_mixed_context = false
    const sending = f.session.sendMessage('unchanged semantics', mode === 'no-images' ? [] : f.attachments, f.tags)
    f.graph.nodes[0].widgets_values[0] = 'ordinary post-prepare graph'
    f.release()
    await sending
    expect(f.requests[0].body.selection).toEqual({ node_ids: ['0'] })
    expect(f.requests[0].body.draft.content.nodes[0].widgets_values).toEqual(['ordinary post-prepare graph'])
  })
  it('pins absence of a target while a workflow is linked during preparation', async () => {
    const f = fixture()
    f.workflow.current.mockImplementation((...args: any[]) => args.length === 0 ? undefined as any : args[0] === null ? undefined as any : f.context)
    f.workflow.draft.mockReturnValue(undefined as any)
    const sending = f.session.sendMessage('unlinked', f.attachments)
    f.workflow.current.mockImplementation((...args: any[]) => args[0] === null ? undefined as any : f.context)
    f.release()
    await sending
    expect(f.requests[0].body).not.toHaveProperty('workflow_id')
    expect(f.requests[0].body).not.toHaveProperty('draft')
  })
  it.each([undefined, () => 'silently omitted', Symbol('omitted'), new Date('2026-01-01'), new Map([['lost', 1]])])('rejects a non-JSON graph value instead of losing it: %s', async (value) => {
    const f = fixture()
    Reflect.set(f.graph.extra, 'mustNotDisappear', value)
    const sending = f.session.sendMessage('keep every field', f.attachments)
    f.release()
    expect(await sending).toBe(false)
    expect(f.workflow.prepare).not.toHaveBeenCalled()
    expect(f.requests).toHaveLength(0)
  })
  it('rejects a non-finite graph rather than silently replacing its value with null', async () => {
    const f = fixture()
    f.graph.extra.ds.scale = Number.NaN
    const sending = f.session.sendMessage('keep exact graph', f.attachments)
    f.release()
    expect(await sending).toBe(false)
    expect(f.workflow.prepare).not.toHaveBeenCalled()
    expect(f.requests).toHaveLength(0)
    expect(JSON.stringify(f.session.entries.value)).toContain('finite JSON')
  })
  it.each(['closed', 'rebound', 'mutated-id'])('fails visibly when a temporary origin is %s during preparation', async (change) => {
    const f = fixture()
    if (change !== 'mutated-id') Reflect.deleteProperty(f.context, 'id')
    const original = {}
    const identity = vi.fn((): object | undefined => original)
    Object.assign(f.workflow, { identity })
    const sending = f.session.sendMessage('must not downgrade', f.attachments, f.tags)
    if (change === 'closed') {
      f.workflow.current.mockReturnValue(undefined as any)
      identity.mockReturnValue(undefined)
    } else if (change === 'rebound') {
      identity.mockReturnValue({}) // Same path and undefined ID, different tab object.
    } else {
      f.context.id = 'different-saved-workflow'
    }
    f.release()
    expect(await sending).toBe(false)
    expect(f.requests).toHaveLength(0)
    expect(JSON.stringify(f.session.entries.value)).toContain('no longer available')
  })
  it('sends a temporary unsaved draft on an existing thread without inventing an ID', async () => {
    const f = fixture()
    useAgentConversationStore().setThreadId('existing')
    Reflect.deleteProperty(f.context, 'id')
    const expectedGraph = JSON.parse(JSON.stringify(f.graph))
    const sending = f.session.sendMessage('temporary', f.attachments, f.tags)
    f.graph.nodes[0].widgets_values[0] = 'late'
    f.release()
    await sending
    expect(f.requests[0].url).toContain('/existing/messages')
    expect(f.requests[0].body).not.toHaveProperty('workflow_id')
    expect(f.requests[0].body.draft).toEqual({ content: expectedGraph })
  })
  it('freezes the complete graph, composed content, references and advisory tabs before prepare', async () => {
    const f = fixture()
    const expectedGraph = JSON.parse(JSON.stringify(f.graph))
    const text = '  原文\n '
    const expectedContent = serializeWorkflowReferences(text, f.references)
    const sending = f.session.sendMessage(text, f.attachments, f.tags, f.references)
    f.graph.nodes[0].widgets_values[0] = 'EDIT AFTER CLICK'
    f.graph.links.splice(0)
    f.graph.extra.extension.untouched.push('late')
    f.tabs.open_tabs[0].name = 'LATE TAB'
    f.tabs.current_tab = 'other'
    f.references[0].name = 'LATE REF'
    f.attachments[0].ref = 'asset:8'
    f.tags[0].id = '12'
    f.release()
    expect(await sending).toBe(false)
    expect(f.requests).toHaveLength(1)
    expect(f.requests[0].body).toEqual({ content: expectedContent, workflow_id: 'saved-origin',
      draft: { content: expectedGraph }, attachments: ['asset:7'], selection: { node_ids: ['0'], node_locators: ['0'] },
      workflow_references: [{ workflow_id: 'reference', name: '参考' }],
      open_tabs: [{ workflow_id: 'saved-origin', name: 'Origin' }], current_tab: 'saved-origin' })
    expect(f.workflow.draft).toHaveBeenCalledTimes(1)
    expect(f.workflow.draft).toHaveBeenCalledBefore(f.workflow.prepare)
  })
})
