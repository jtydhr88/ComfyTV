import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { computed, effectScope, ref, watch } from 'vue'
import { expect, it, vi } from 'vitest'
import { attachmentPolicy } from './attachableFiles'
import { getMediaTypeFromFilename } from '@agent/utils/formatUtil'

it('actual panel accepts filename-classified media and invalidates queued library picks across capability/thread switches', () => {
  const panel = readFileSync('src/agent/native/AgentPanelRoot.vue', 'utf8')
  const code = panel.slice(panel.indexOf('const attachmentCapability ='), panel.indexOf('function onMentionPick('))
  const assets: Record<number, any> = { 1: { id: 1, media_type: 'video' }, 2: { id: 2, media_type: 'audio' }, 3: { id: 3, media_type: 'text' } }
  let picker: any
  let uploadOptions: any
  const add = vi.fn()
  const remove = vi.fn()
  const sandbox: any = { ref, computed, watch, attachmentPolicy, getMediaTypeFromFilename,
    threadId: ref('media'), newChatRequests: ref(0), api: { fetchApi: () => new Promise(() => {}) },
    closeEaglePicker() {}, closeAssetPicker() {}, openAssetPicker: (handlers: any) => { picker = handlers },
    useAttachment: (options: any) => { uploadOptions = options; return {} },
    useAssetStore: () => ({ byId: (id: number) => assets[id] }), assetIdOf: (s: string) => Number(s.split(':')[1]),
    toAttachment: (a: any) => ({ id: `asset:${a.id}`, ref: `asset:${a.id}` }),
    panelRef: ref({ addAttachment: add }), composerStore: { addAttachment() {}, updateAttachment() {}, removeAttachment: remove, attachments: [] },
    toast: { add: vi.fn() }, exitNodeSelectionMode() {}, MAX_ATTACHMENT_BYTES: 20, uploadToLibrary() {}, hasVideoType() {},
  }
  vm.createContext(sandbox)
  const scope = effectScope()
  try {
    scope.run(() => vm.runInContext(ts.transpileModule(code + '\nglobalThis.state={attachmentCapability,imagePolicy,onOpenAssets};', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, sandbox))
    sandbox.state.attachmentCapability.value = { attachments: true, attachment_transport: 'asset_refs', attachment_media_types: ['image', 'video', 'audio'] }
    expect(uploadOptions.allowed(new File(['v'], 'movie.mp4'))).toBe(true)
    expect(uploadOptions.allowed(new File(['a'], 'track.wav', { type: 'application/octet-stream' }))).toBe(true)
    expect(uploadOptions.allowed(new File(['d'], 'doc.pdf', { type: 'image/png' }))).toBe(false)
    sandbox.state.onOpenAssets()
    picker.select(assets[1]); picker.select(assets[2]); picker.select(assets[3])
    expect(add.mock.calls.map(c => c[0].ref)).toEqual(['asset:1', 'asset:2'])
    const old = picker
    sandbox.threadId.value = 'other'
    old.select(assets[1]); old.deselect(assets[2])
    expect(add).toHaveBeenCalledTimes(2)
    expect(remove).not.toHaveBeenCalled()
    sandbox.state.onOpenAssets()
    const beforeDisabled = picker
    sandbox.state.attachmentCapability.value = { attachments: false }
    beforeDisabled.deselect(assets[1])
    expect(remove).not.toHaveBeenCalled()
  } finally { scope.stop() }
})
