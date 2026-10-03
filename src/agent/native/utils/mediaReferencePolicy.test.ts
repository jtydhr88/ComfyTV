import { expect, it } from 'vitest'
import { attachmentPolicy } from './attachableFiles'

it('advertises only capability-approved media in the picker with truthful inspection limits', () => {
  const cap = { attachments: true, attachment_transport: 'asset_refs', attachment_media_types: ['audio', 'document', 'video', 'image'], attachment_mixed_context: true }
  const policy = attachmentPolicy(cap)
  expect(policy.accept).toBe('image/*,video/*,audio/*')
  expect(policy.label).toContain('not inspected')
  expect(policy.label).toContain('on demand')
  expect(policy.label).toContain('not hearing or transcription')
  expect(policy.label).toContain('Documents unsupported')
  expect(policy.label).not.toContain('video/audio/documents')
  expect(policy.mixedContext).toBe(true)
  expect(policy.allowsDeferred).toBe(false)
  for (const kind of ['document', 'text', 'other', '3D']) expect(policy.allows(kind)).toBe(false)
  cap.attachment_media_types.splice(0)
  expect(policy.allows('video')).toBe(true)
  expect(attachmentPolicy(cap).allows('video')).toBe(false)
  expect(attachmentPolicy(cap).accept).toBe('')
  expect(attachmentPolicy({ ...cap, attachments: false }).allows('audio')).toBe(false)
  expect(attachmentPolicy({ ...cap, attachment_media_types: ['audio'] }).accept).toBe('audio/*')
})
