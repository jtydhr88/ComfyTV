// Execute the actual panel watcher/handlers and picker click code with Vue.
// Host IO is mocked; this is not browser E2E coverage.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { computed, effectScope, nextTick, ref, watch } from 'vue'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(`${process.cwd()}/${path}`, 'utf8')
function between(s: string, start: string, end: string) {
  expect(s).toContain(start)
  expect(s).toContain(end)
  return s.slice(s.indexOf(start), s.indexOf(end))
}
const panel = source('src/agent/native/AgentPanelRoot.vue')
const popup = source('src/components/stages/EaglePickerPopup.vue')
const policy = between(source('src/agent/native/utils/attachableFiles.ts'), 'export interface AttachmentCapability', 'const MEDIA_ATTACHABLE_KINDS').replaceAll('export ', '')
const tick = async () => { await nextTick(); await new Promise(r => setImmediate(r)); await nextTick() }
function fixture() {
  const calls = { imports: 0, adds: 0 }
  const pending: any[] = []
  const urls: string[] = []
  const picker: any = { open: false, handlers: null }
  const props: any = { addedIds: [] }
  const sandbox: any = {
    ref, computed, watch, console, AGENT_ATTACH_ACCEPT: 'image/*,video/*,audio/*',
    threadId: ref('inline'), newChatRequests: ref(0),
    api: { fetchApi: (url: string) => { urls.push(url); return new Promise(r => pending.push(r)) } },
    useAssetStore: () => ({ byId: () => ({ media_type: 'image' }) }), assetIdOf: () => 7,
    toast: { add: () => {} }, panelRef: ref({ addAttachment: () => calls.adds++ }),
    attachedAssetIds: () => [], exitNodeSelectionMode: () => {}, composerStore: { removeAttachment: () => {} },
    closeAssetPicker: () => {},
    closeEaglePicker: () => { picker.open = false; picker.handlers = null },
    openEaglePicker: (handlers: any) => { picker.open = true; picker.handlers = handlers; props.canPick = handlers.canPick },
    toAttachment: () => ({ id: 'asset:7', ref: 'asset:7' }), props, pendingId: ref(null),
    importedEagleAsset: () => undefined,
    importEagleAsset: async () => { calls.imports++; return { id: 7, media_type: 'image' } },
    emit: (event: string, asset: any) => picker.handlers?.[event]?.(asset), app: {}, t: (s: string) => s,
  }
  vm.createContext(sandbox)
  const code = policy + between(panel, 'const attachmentCapability =', 'const attachment = useAttachment(')
    + between(panel, 'function allowEagleImport()', 'function onOpenAssets()')
    + between(popup, 'function toggle(asset:', 'function itemTooltip(')
    + between(panel, 'async function onSelectHistory(', 'function buildTranscriptMarkdown(')
    + between(panel, 'function onNewChat()', 'const panelRef =')
    + '\nglobalThis.state={attachmentCapability,imagePolicy,onOpenEagle,onPick,onSelectHistory,onNewChat};'
  const scope = effectScope()
  scope.run(() => vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, sandbox))
  return { ...sandbox, context: sandbox, calls, pending, picker, urls, stop: () => scope.stop() }
}
async function inline(f: any) {
  f.pending[0]({ ok: true, json: async () => ({ attachments: true, attachment_transport: 'inline' }) })
  await tick()
  f.state.onOpenEagle()
  expect(f.picker.open).toBe(true)
}

describe('Eagle picker context lifetime (actual component code)', () => {
  it.each(['onSelectHistory', 'onNewChat'])('invalidates at %s entry before asynchronous thread loading', async (action) => {
    const f = fixture()
    try {
      await inline(f)
      Object.assign(f.context, {
        composerStore: { invalidateSubmission() {}, setWorkflowReferences() {}, resetPromptHistory() {} },
        cancelWorkflowSelection() {}, agentPanelStore: { resetWorkflowTarget() {}, setWorkflowTarget() {} },
        workflowStore: {}, newChat() {}, loadThread: () => new Promise(() => {}),
      })
      void f.state[action]('other')
      await f.state.onPick({ id: 'queued-click' })
      expect(f.calls.imports).toBe(0)
      expect(f.picker.open).toBe(false)
    } finally { f.stop() }
  })
  it.each(['disabled', 'references', 'inline'])('invalidates an old picker after switching to %s, including a queued click', async (kind) => {
    const f = fixture()
    try {
      await inline(f)
      f.threadId.value = kind === 'inline' ? 'another-inline' : kind
      // Invoke before a Vue render/unmount: closing alone is insufficient.
      await f.state.onPick({ id: 'new' })
      expect(f.calls.imports).toBe(0)
      await tick()
      f.pending[1]({ ok: true, json: async () => ({ attachments: kind !== 'disabled', attachment_transport: kind === 'references' ? 'asset_refs' : 'inline' }) })
      await tick()
      expect(f.picker.open).toBe(false)
      await f.state.onPick({ id: 'new' })
      expect(f.calls.imports).toBe(0)
      expect(f.calls.adds).toBe(0)
    } finally { f.stop() }
  })
  it('invalidates on a capability change in the same thread', async () => {
    const f = fixture()
    try {
      await inline(f)
      f.state.attachmentCapability.value = { attachments: true, attachment_transport: 'asset_refs' }
      await f.state.onPick({ id: 'new' })
      expect(f.calls.imports).toBe(0)
      expect(f.picker.open).toBe(false)
    } finally { f.stop() }
  })
  it('does not attach an old import response to a new inline thread/picker', async () => {
    const f = fixture()
    try {
      await inline(f)
      let resolve: any
      f.context.importEagleAsset = () => new Promise(r => { resolve = r })
      const oldImport = f.state.onPick({ id: 'old' })
      f.threadId.value = 'another-inline'
      await tick()
      f.pending[1]({ ok: true, json: async () => ({ attachments: true, attachment_transport: 'inline' }) })
      await tick()
      f.state.onOpenEagle()
      resolve({ id: 7, media_type: 'image' })
      await oldImport
      expect(f.calls.adds).toBe(0)
    } finally { f.stop() }
  })
  it('ordinary inline and consumers without an optional guard still import', async () => {
    const f = fixture()
    try {
      await inline(f)
      await f.state.onPick({ id: 'new' })
      expect(f.calls.imports).toBe(1)
      expect(f.calls.adds).toBe(1)
      delete f.props.canPick
      await f.state.onPick({ id: 'another' })
      expect(f.calls.imports).toBe(2)
    } finally { f.stop() }
  })
  it('captures the current thread URL and ignores a stale async capability response', async () => {
    const f = fixture()
    try {
      f.threadId.value = 'disabled/id'
      await tick()
      expect(f.urls[1]).toContain('/disabled%2Fid/attachment-capability')
      f.pending[1]({ ok: true, json: async () => ({ attachments: false }) })
      await tick()
      f.pending[0]({ ok: true, json: async () => ({ attachments: true, attachment_transport: 'inline' }) })
      await tick()
      f.state.onOpenEagle()
      expect(f.picker.open).toBe(false)
    } finally { f.stop() }
  })
  it('wires the import-time guard through the actual dock template', () => {
    expect(source('src/agent/shell/AgentDock.vue')).toContain(':can-pick="eaglePicker.handlers.canPick"')
    expect(popup).toContain('canPick?: () => boolean')
  })
})
