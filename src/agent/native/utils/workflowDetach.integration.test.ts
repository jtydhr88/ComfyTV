// Mount the real panel + Composer and execute the Root's workflow/submission
// slices. Only host IO and unrelated visual children are replaced. The request
// assertion is on JSON emitted by the real session and REST client (not a mock
// postMessage). This is a happy-dom integration test, not live ComfyUI E2E.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createPinia, setActivePinia, storeToRefs } from 'pinia'
import { computed, defineComponent, effectScope, nextTick, reactive, ref, watch } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@agent/i18n'
import { api } from '@agent/scripts/api'
import AgentPanel from '../components/agent/AgentPanel.vue'
import { useAgentPanelStore } from '../stores/agent/agentPanelStore'
import { useAgentComposerStore } from '../stores/agent/agentComposerStore'
import { useCanvasSelection } from '../composables/agent/useCanvasSelection'
import { useAgentSession } from '../composables/agent/useAgentSession'
import { useAgentDraftSubmission } from '../composables/agent/useAgentDraftSubmission'
import { createAgentRestClient } from '../services/agent/agentRestClient'

const host = vi.hoisted(() => ({ workflow: null as any }))
vi.mock('@agent/platform/workflow/management/stores/workflowStore', () => ({ useWorkflowStore: () => host.workflow }))
const root = readFileSync('src/agent/native/AgentPanelRoot.vue', 'utf8')
function between(start: string, end: string) {
  expect(root).toContain(start)
  expect(root).toContain(end)
  return root.slice(root.indexOf(start), root.indexOf(end))
}
const disposers: (() => void)[] = []
beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); vi.clearAllMocks() })
afterEach(() => { disposers.splice(0).forEach(fn => fn()) })

function fixture() {
  const first = { path: 'one.json', filename: 'one.json', isTemporary: false, isPersisted: true, activeState: { nodes: [{ id: 1 }] }, changeTracker: { prepareForSave: vi.fn() } }
  host.workflow = reactive({ activeWorkflow: first, openWorkflows: [first] })
  const agentPanelStore = useAgentPanelStore()
  const composerStore = useAgentComposerStore()
  const { selectedWorkflow: selectedTarget } = storeToRefs(agentPanelStore)
  const selectionTags = computed(() => composerStore.nodes)
  const requests: { url: string; body: any }[] = []
  vi.mocked(api.fetchApi).mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body)); requests.push({ url, body })
      if (body.attachments?.length && (body.workflow_id || body.draft || body.selection || body.workflow_references?.length))
        return new Response(JSON.stringify({ error: 'Incompatible image context. Nothing was cleared.' }), { status: 400 })
      return new Response(JSON.stringify({ thread_id: 'chat', message_id: 'turn', status: 'accepted' }))
    }
    return new Response(JSON.stringify({ messages: [], workflow_id: 'old-workflow' }))
  })
  const scope = effectScope()
  disposers.push(() => scope.stop())
  const sandbox: any = {
    computed, ref, watch, agentPanelStore, composerStore, selectedTarget, selectionTags,
    useCanvasSelection, agentEnabled: ref(true), selectedNodes: ref([]),
    canReferenceNodes: computed(() => selectedTarget.value !== null),
    dismissedSelectionSignature: ref(null),
    agentNodeSelectionStore: { isActive: false, isLoadingWorkflow: false, saveNodeIds: vi.fn() },
    workflowStore: host.workflow, cloudIdFor: (target: any) => target.path,
    useAgentDraftSubmission, useTelemetry: () => undefined,
    imagePolicy: ref({ mixedContext: false }),
    showPanel: ref(true), isSending: ref(false), isStreaming: ref(false), status: ref('idle'), workflowSelecting: ref(false),
    consumeSelection: () => composerStore.setNodes([]), replaceSelectionTags: composerStore.setNodes,
    nodeReferenceWorkflow: null, exitNodeSelectionMode: vi.fn(),
    cancelWorkflowSelection: vi.fn(), invalidateEaglePicker: vi.fn(), refreshHistory: vi.fn(),
    toast: { add: vi.fn() }, t: (key: string) => i18n.global.t(key),
  }
  vm.createContext(sandbox)
  const run = (code: string) => scope.run(() => vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, sandbox))
  run(between('composerStore.setNodeScope(selectedTarget.value', 'function viewedGraphNodes()')
    + between('watch(\n  selectedTarget,', 'watch(\n  () => canvasStore.currentGraph,'))
  run(between('const workflowDetached =', 'const workflowTabs =') + '\nglobalThis.context={workflowDetached, selectedTargetTab, editableWorkflowId, targetWorkflowTurnContext, targetWorkflowDraft};')
  const session = scope.run(() => useAgentSession({
    rest: createAgentRestClient(), events: { subscribe: () => () => {} },
    workflow: { current: sandbox.context.targetWorkflowTurnContext, draft: sandbox.context.targetWorkflowDraft, adopted() {} }
  }))!
  Object.assign(sandbox, { ...sandbox.context, sendMessage: session.sendMessage, stopTurn: session.stopTurn, newChat: session.newChat, loadThread: session.loadThread })
  // Missing production handler deliberately yields no listener in RED; the
  // first failure must be the absent visible unlink control, not a harness error.
  const toggle = root.includes('function onToggleWorkflowLink()')
    ? between('function onToggleWorkflowLink()', 'function onNewChat()') : ''
  run(between('const { submit: onSend } =', 'function onStop()') + toggle
    + between('function onNewChat()', 'const panelRef =')
    + between('async function onSelectHistory(', 'function buildTranscriptMarkdown(')
    + '\nglobalThis.handlers={onSend,onNewChat,onSelectHistory,...(typeof onToggleWorkflowLink === "function" ? {onToggleWorkflowLink} : {})};')
  const attributes = [':visible-tab-path', ':streaming', ':submitting', ':workflow-detached', ':active-tab', '@send', '@toggle-workflow-link', '@new-chat', '@select-history']
    .map(name => root.match(new RegExp(`${name}="[^"]+"`))?.[0] ?? '').join(' ')
  const wrapper = mount(defineComponent({
    components: { AgentPanel },
    setup: () => ({ ...sandbox.context, ...sandbox.handlers, showPanel: sandbox.showPanel, workflowStore: host.workflow, isSending: sandbox.isSending, isStreaming: sandbox.isStreaming, status: sandbox.status }),
    template: `<AgentPanel v-if="showPanel" :entries="[]" :history-groups="[]" ${attributes} />`
  }), { global: {
    plugins: [i18n], directives: { tooltip: {} },
    stubs: { InlinePromptEditor: true, EmptyState: true, ConversationView: true, ChatHistoryScreen: true, AgentFeedbackCaption: true, RunModePopover: true }
  } })
  disposers.push(() => wrapper.unmount())
  return { wrapper, agentPanelStore, composerStore, requests, session, first, sandbox }
}

async function send(f: ReturnType<typeof fixture>, image = true) {
  f.composerStore.setText('Describe this')
  if (image) f.composerStore.addAttachment({ id: 'asset:7', ref: 'asset:7', name: 'image.png' })
  await nextTick()
  const prompt = f.composerStore.prompt
  await f.wrapper.get('button[aria-label="Send"]').trigger('click')
  await flushPromises()
  return prompt
}

describe('explicit native workflow detachment to REST', () => {
  it('disables relink when no active workflow exists', async () => {
    const f = fixture()
    host.workflow.activeWorkflow = null
    await nextTick()
    expect(f.wrapper.text()).toContain('No workflow linked')
    expect(f.wrapper.get('button[aria-label="Link current workflow"]').attributes()).toHaveProperty('disabled')
  })
  it('does not automatically strip workflow context when an image is added and restores a rejected draft', async () => {
    const f = fixture()
    const prompt = await send(f)
    expect(f.requests[0].body).toMatchObject({ workflow_id: 'one.json', draft: { content: f.first.activeState }, attachments: ['asset:7'] })
    expect(f.agentPanelStore.selectedWorkflow?.path).toBe('one.json')
    expect(f.composerStore.prompt).toEqual(prompt)
    expect(f.composerStore.attachments.map(a => a.ref)).toEqual(['asset:7'])
    expect(JSON.stringify(f.session.entries.value)).toContain('Incompatible image context. Nothing was cleared.')
  })
  it('preserves workflow references across unlink and sends them for explicit backend rejection, never silently dropping them', async () => {
    const f = fixture()
    f.composerStore.setWorkflowReferences([{ id: 'other', name: 'Reference', textOffset: 0 }])
    await f.wrapper.get('button[aria-label="Unlink workflow"]').trigger('click')
    expect(f.composerStore.workflowReferences.map(r => r.id)).toEqual(['other'])
    await send(f)
    expect(f.requests[0].body.workflow_references).toEqual([{ workflow_id: 'other', name: 'Reference' }])
    expect(f.requests[0].body).not.toHaveProperty('workflow_id')
    expect(f.composerStore.workflowReferences.map(r => r.id)).toEqual(['other'])
    expect(f.composerStore.attachments.map(a => a.ref)).toEqual(['asset:7'])
    expect(JSON.stringify(f.session.entries.value)).toContain('Incompatible image context. Nothing was cleared.')
  })
  it.each(['streaming', 'submitting'])('disables the visible workflow action while %s', async (state) => {
    const f = fixture()
    f.sandbox[state === 'streaming' ? 'isStreaming' : 'isSending'].value = true
    await nextTick()
    expect(f.wrapper.get('button[aria-label="Unlink workflow"]').attributes()).toHaveProperty('disabled')
    await f.wrapper.get('button[aria-label="Unlink workflow"]').trigger('click')
    expect(f.agentPanelStore.selectedWorkflow?.path).toBe('one.json')
    f.sandbox[state === 'streaming' ? 'isStreaming' : 'isSending'].value = true
    f.sandbox.handlers.onToggleWorkflowLink()
    expect(f.agentPanelStore.selectedWorkflow?.path).toBe('one.json')
  })
  it('retains explicit unlink when the panel closes and reopens', async () => {
    const f = fixture()
    await f.wrapper.get('button[aria-label="Unlink workflow"]').trigger('click')
    f.agentPanelStore.close()
    f.sandbox.showPanel.value = false
    await nextTick()
    expect(f.wrapper.findComponent(AgentPanel).exists()).toBe(false)
    f.agentPanelStore.open()
    f.sandbox.showPanel.value = true
    await nextTick()
    expect(f.wrapper.text()).toContain('No workflow linked')
    expect(f.agentPanelStore.selectedWorkflow).toBeNull()
    await send(f)
    expect(f.requests[0].body).not.toHaveProperty('workflow_id')
  })
  it('refuses unlink with an explicit warning when node references remain, preserving the entire draft', async () => {
    const f = fixture()
    f.composerStore.setText('Keep these references')
    f.composerStore.setNodeScope('one.json')
    f.composerStore.setNodes([{ id: '1', title: 'Node' }])
    f.composerStore.setWorkflowReferences([{ id: 'ref-workflow', name: 'Reference', textOffset: 0 }])
    f.composerStore.addAttachment({ id: 'asset:7', ref: 'asset:7', name: 'image.png' })
    const prompt = f.composerStore.prompt
    await f.wrapper.get('button[aria-label="Unlink workflow"]').trigger('click')
    expect(f.agentPanelStore.selectedWorkflow?.path).toBe('one.json')
    expect(f.composerStore.prompt).toEqual(prompt)
    expect(f.sandbox.toast.add).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'warn', detail: 'Remove node references before unlinking the workflow. Nothing was cleared.'
    }))
    expect(f.requests).toHaveLength(0)
  })
  it('keeps explicit unlink across new chat, history load, and active tab changes until relink', async () => {
    const f = fixture()
    await f.wrapper.get('button[aria-label="Unlink workflow"]').trigger('click')
    await f.wrapper.get('button[aria-label="New chat"]').trigger('click')
    expect(f.agentPanelStore.selectedWorkflow).toBeNull()
    expect(f.sandbox.invalidateEaglePicker).toHaveBeenCalled()
    await f.sandbox.handlers.onSelectHistory('previous-chat')
    expect(f.agentPanelStore.selectedWorkflow).toBeNull()
    const second = { ...f.first, path: 'two.json', filename: 'two.json' }
    host.workflow.activeWorkflow = second
    host.workflow.openWorkflows.push(second)
    await nextTick()
    expect(f.agentPanelStore.selectedWorkflow).toBeNull()
    expect(useAgentPanelStore().selectedWorkflow).toBeNull()
    await f.wrapper.get('button[aria-label="Link current workflow"]').trigger('click')
    expect(f.agentPanelStore.selectedWorkflow?.path).toBe('two.json')
    await send(f, false)
    expect(f.requests.at(-1)?.body.workflow_id).toBe('two.json')
    host.workflow.activeWorkflow = f.first
    await nextTick()
    expect(f.agentPanelStore.selectedWorkflow?.path).toBe('one.json')
  })
  it('unlinks through visible UI and sends an image without workflow_id/draft; relinks ordinary text to the active workflow', async () => {
    const f = fixture()
    expect(f.agentPanelStore.selectedWorkflow?.path).toBe('one.json')
    await f.wrapper.get('button[aria-label="Unlink workflow"]').trigger('click')
    expect(f.wrapper.text()).toContain('No workflow linked')
    expect(f.agentPanelStore.selectedWorkflow).toBeNull()
    await send(f)
    expect(f.requests).toHaveLength(1)
    expect(f.requests[0].body).toMatchObject({ content: 'Describe this@[Image: image.png]', attachments: ['asset:7'] })
    expect(f.requests[0].body).not.toHaveProperty('workflow_id')
    expect(f.requests[0].body).not.toHaveProperty('draft')
    expect(host.workflow.activeWorkflow.activeState).toEqual(f.first.activeState)
    expect(f.first.changeTracker.prepareForSave).not.toHaveBeenCalled()
    await f.wrapper.get('button[aria-label="Link current workflow"]').trigger('click')
    await send(f, false)
    expect(f.requests).toHaveLength(2)
    expect(f.requests[1].body).toMatchObject({ workflow_id: 'one.json', draft: { content: f.first.activeState } })
  })
})
