import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, effectScope } from 'vue'
import type { ComfyWorkflow } from '@agent/platform/workflow/management/stores/comfyWorkflow'
import { api } from '@agent/scripts/api'
import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { createAgentRestClient } from '../../services/agent/agentRestClient'
import { composerPromptForSend } from '../../utils/composerPrompt'
import { useAgentSession } from './useAgentSession'
import { useAgentDraftSubmission } from './useAgentDraftSubmission'

const scopes: ReturnType<typeof effectScope>[] = []
beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); vi.clearAllMocks() })
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))
function fixture() {
  const scope = effectScope(); scopes.push(scope)
  return scope.run(() => {
    const composer = useAgentComposerStore()
    const first = { path: 'origin', isTemporary: true, activeState: { version: 0.4, nodes: [{ id: 0, type: 'Prompt', widgets_values: ['original'] }], links: [], groups: [] } } as unknown as ComfyWorkflow
    let target = first
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const requests: any[] = []
    vi.mocked(api.fetchApi).mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        requests.push(JSON.parse(String(init.body)))
        return new Response(JSON.stringify({ error: 'fixture failure' }), { status: 400 })
      }
      return new Response(JSON.stringify([]))
    })
    const session = useAgentSession({ rest: createAgentRestClient(), events: { subscribe: () => () => {} },
      attachmentCapability: () => ({ attachments: true, attachment_transport: 'asset_refs', attachment_mixed_context: true }),
      workflow: { current: () => ({ tabPath: first.path }), identity: () => first, adopted() {},
        prepare: () => gate, draft: () => ({ content: first.activeState! }) }
    })
    const options = {
      canSubmit: () => true, target: () => target, editableWorkflowId: () => undefined,
      captureMixedContext: () => true,
      selection: { staged: computed(() => composer.nodes), workflow: () => target,
        consume: () => { const nodes = composer.nodes; composer.setNodes([]); return nodes }, replace: composer.setNodes, exit() {} },
      send: session.sendMessage, stop: session.stopTurn
    }
    const submission = useAgentDraftSubmission(options)
    composer.setText('keep my prompt')
    composer.addAttachment({ id: 'asset:7', ref: 'asset:7', name: 'original.png' })
    composer.setNodeScope(first.path)
    composer.setNodes([{ id: '0', title: 'Original' }])
    composer.setWorkflowReferences([{ id: 'reference', name: 'Original reference', textOffset: 2 }])
    const submit = () => submission.submit(composerPromptForSend(composer.prompt).text, composer.attachments, composer.workflowReferences)
    return { composer, session, submit, requests, release, switchTarget: () => { target = { ...first, path: 'other' } as ComfyWorkflow; composer.setNodeScope('other') } }
  })!
}

describe('mixed submission restoration', () => {
  it('does not overwrite a new editor draft after a delayed rejection', async () => {
    const f = fixture()
    const sending = f.submit()
    f.composer.setText('new edit wins')
    f.composer.addAttachment({ id: 'asset:8', ref: 'asset:8', name: 'new.png' })
    const expected = JSON.parse(JSON.stringify(f.composer.prompt))
    f.release(); await sending
    expect(f.composer.prompt).toEqual(expected)
    expect(f.requests[0].attachments).toEqual(['asset:7'])
  })
  it('never restores originating nodes into another workflow after rejection', async () => {
    const f = fixture()
    const sending = f.submit()
    f.switchTarget()
    f.release(); await sending
    expect(f.composer.nodes).toEqual([])
    expect(f.requests[0].selection).toEqual({ node_ids: ['0'], node_locators: ['0'] })
  })
  it.each(['new-chat', 'history'])('does not resurrect a pending prompt after %s invalidates it', async (navigation) => {
    const f = fixture()
    const sending = f.submit()
    f.composer.invalidateSubmission() // Native navigation handlers invalidate synchronously.
    if (navigation === 'new-chat') f.session.newChat()
    else await f.session.loadThread('history')
    f.release(); await sending
    expect(f.requests).toEqual([])
    expect(f.composer.prompt).toEqual({ text: '', references: [] })
    expect(f.composer.submission).toBeNull()
  })
  it('owns the recovery prompt and node/image objects at click time during delayed preparation', async () => {
    const f = fixture()
    const expected = JSON.parse(JSON.stringify(f.composer.prompt))
    const originalAttachment = f.composer.attachments[0]
    const originalNode = f.composer.nodes[0]
    const sending = f.submit()
    originalAttachment.name = 'late mutation'
    originalNode.title = 'late node mutation'
    f.release(); await sending
    expect(f.composer.prompt).toEqual(expected)
    expect(f.requests).toHaveLength(1)
  })
})
