import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { api } from '@agent/scripts/api'
import { uploadToLibrary, toAttachment } from '@agent/comfytv/assets'
import { importAssetFiles } from '@/composables/sidebar/assetImport'
import { attachmentPolicy } from '../../utils/attachableFiles'
import { useAttachment } from './useAttachment'
import { useAgentSession } from './useAgentSession'
import { createAgentRestClient } from '../../services/agent/agentRestClient'
import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
vi.mock('@/composables/sidebar/assetImport', () => ({ importAssetFiles: vi.fn() }))

let scope: ReturnType<typeof effectScope>
beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); scope = effectScope(); vi.clearAllMocks() })
afterEach(() => scope.stop())
const capability = { attachments: true, attachment_transport: 'asset_refs', attachment_media_types: ['image', 'video', 'audio'], attachment_mixed_context: true }
it.each([
  { name: 'notes.pdf', ref: '' },
  { name: 'movie.mp4', ref: 'asset:invalid' },
  { name: 'movie.mp4', ref: 'https://example.com/movie.mp4' }
])('native reference submission rejects unsupported or non-asset input $name / $ref', async attachment => {
  const postMessage = vi.fn(async (_threadId: string, _input: import('../../services/agent/agentRestClient').PostMessageInput) => { throw new Error('fixture rejection') })
  const session = scope.run(() => useAgentSession({ rest: { ...createAgentRestClient(), postMessage }, events: { subscribe: () => () => {} }, attachmentCapability: () => capability }))!
  expect(await session.sendMessage('keep context', [attachment])).toBe(false)
  expect(postMessage).not.toHaveBeenCalled()
})

it.each(['image', 'video', 'audio'] as const)('managed %s refs ignore extensionless and misleading editable labels', async media_type => {
  const postMessage = vi.fn(async (_threadId: string, _input: import('../../services/agent/agentRestClient').PostMessageInput) => ({ message_id: 'm', thread_id: 't' }))
  const session = scope.run(() => useAgentSession({ rest: { ...createAgentRestClient(), postMessage }, events: { subscribe: () => () => {} }, attachmentCapability: () => ({ ...capability, attachment_media_types: [media_type] }) }))!
  for (const name of ['ordinary-library-label', 'misleading-document.pdf']) {
    const attachment = toAttachment({ id: 21, name, media_type, payload_url: '/view' } as any)
    expect(await session.sendMessage('inspect', [attachment])).toBe(true)
    expect(postMessage.mock.calls.at(-1)?.[1].attachments).toEqual(['asset:21'])
  }
  expect(postMessage).toHaveBeenCalledTimes(2)
})

it('disabled media capability rejects canonical managed refs', async () => {
  const postMessage = vi.fn()
  const session = scope.run(() => useAgentSession({ rest: { ...createAgentRestClient(), postMessage }, events: { subscribe: () => () => {} }, attachmentCapability: () => ({ ...capability, attachments: false }) }))!
  expect(await session.sendMessage('inspect', [toAttachment({ id: 21, name: 'ordinary-label', media_type: 'video' } as any)])).toBe(false)
  expect(postMessage).not.toHaveBeenCalled()
})

it('preserves authoritative backend rejection of an unsupported managed asset regardless of display name', async () => {
  const postMessage = vi.fn(async () => { throw new Error('Unsupported actual asset media_type: document') })
  const session = scope.run(() => useAgentSession({ rest: { ...createAgentRestClient(), postMessage }, events: { subscribe: () => () => {} }, attachmentCapability: () => capability }))!
  expect(await session.sendMessage('inspect', [toAttachment({ id: 23, name: 'pretends-to-be-image.png', media_type: 'document' } as any)])).toBe(false)
  expect(postMessage).toHaveBeenCalledTimes(1)
})

it('captures non-mixed media refs before preparation yields, even if caller mutates the array', async () => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const postMessage = vi.fn(async (_threadId: string, _input: import('../../services/agent/agentRestClient').PostMessageInput) => { throw new Error('fixture rejection') })
  const rest = { ...createAgentRestClient(), postMessage }
  const session = scope.run(() => useAgentSession({ rest, events: { subscribe: () => () => {} },
    attachmentCapability: () => ({ ...capability, attachment_mixed_context: false }),
    workflow: { current: () => ({ tabPath: 'origin' }), prepare: () => gate, adopted() {} }
  }))!
  const refs = [{ id: 'asset:21', ref: 'asset:21', name: 'movie.mp4' }]
  const sending = session.sendMessage('inspect', refs)
  refs[0].ref = 'asset:99'
  refs.push({ id: 'asset:22', ref: 'asset:22', name: 'track.wav' })
  release(); await sending
  expect(postMessage.mock.calls[0][1].attachments).toEqual(['asset:21'])
})

it('uploads video/audio as stable asset IDs through native submission, rejects documents without clearing mixed input', async () => {
  const policy = attachmentPolicy(capability)
  const composer = useAgentComposerStore()
  const requests: any[] = []
  vi.mocked(api.fetchApi).mockImplementation(async (_url: string, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body)))
    return new Response(JSON.stringify({ message_id: 'media-message', thread_id: 'media-thread' }), { status: 200 })
  })
  const session = scope.run(() => useAgentSession({ rest: createAgentRestClient(), events: { subscribe: () => () => {} }, attachmentCapability: () => capability }))!
  vi.mocked(importAssetFiles).mockImplementation(async files => files.map(file => ({ id: file.name.endsWith('.mp4') ? 21 : 22, payload_url: '/on-demand' })) as any)
  const upload = vi.fn(uploadToLibrary)
  const onError = vi.fn()
  const attachment = useAttachment({ upload, stage: composer.addAttachment, update: composer.updateAttachment, remove: composer.removeAttachment, onError,
    allowed: file => policy.allows(file.type.split('/')[0]) })
  composer.setText('inspect on demand')
  await attachment.addFiles([new File(['v'], 'movie.mp4', { type: 'video/mp4' }), new File(['a'], 'track.wav', { type: 'audio/wav' }), new File(['d'], 'notes.pdf', { type: 'application/pdf' })])
  expect(upload).toHaveBeenCalledTimes(2)
  expect(composer.attachments.map(a => a.ref)).toEqual(['asset:21', 'asset:22'])
  expect(onError).toHaveBeenCalledTimes(1)
  expect(onError.mock.calls[0][0]).not.toContain('image references only')
  expect(composer.prompt.text.trim()).toBe('inspect on demand')
  expect(await session.sendMessage(composer.prompt.text, composer.attachments, [{ id: '0', title: 'Selected' }])).toBe(true)
  expect(requests[0].attachments).toEqual(['asset:21', 'asset:22'])
  expect(requests[0].selection).toEqual({ node_ids: ['0'], node_locators: ['0'] })
  expect(JSON.stringify(requests[0])).not.toContain('base64')
})
