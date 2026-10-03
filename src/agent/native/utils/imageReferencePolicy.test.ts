import { describe, expect, it } from 'vitest'
import * as policy from './attachableFiles'

describe('image reference capability', () => {
  it('advertises mixed capture only with explicit enabled reference capability, retaining media restrictions', () => {
    const refs = policy.attachmentPolicy({ attachments: true, attachment_transport: 'asset_refs', attachment_mixed_context: true })
    expect(refs.mixedContext).toBe(true)
    expect(refs.label).toContain('captured')
    expect(refs.label).toContain('not inspected')
    expect(refs.label).toContain('not applied')
    expect(refs.label).toContain('skills')
    expect(refs.label).not.toContain('Combining images with selection')
    expect(refs.allowsDeferred).toBe(false)
    expect(refs.allows('video')).toBe(false)
    for (const cap of [
      { attachments: false, attachment_transport: 'asset_refs', attachment_mixed_context: true },
      { attachment_transport: 'asset_refs', attachment_mixed_context: true },
      { attachments: true, attachment_mixed_context: true },
      { attachments: true, attachment_transport: 'asset_refs' }
    ]) expect(policy.attachmentPolicy(cap).mixedContext).toBe(false)
  })
  it('limits mixed node capture to root-level selections and explicitly rejects nested selections', () => {
    const refs = policy.attachmentPolicy({ attachments: true, attachment_transport: 'asset_refs', attachment_mixed_context: true })
    expect(refs.label).toContain('root-level node selections')
    expect(refs.label).toContain('Nested selections are currently unsupported and rejected')
    expect(refs.label).not.toContain('scoped node selections')
  })
  it('permits only images when gated reference transport is enabled', () => {
    expect(policy).toHaveProperty('attachmentPolicy')
    const refs = policy.attachmentPolicy({ attachments: true, attachment_transport: 'asset_refs' })
    expect(refs.accept).toBe('image/*')
    expect(refs.allows('image')).toBe(true)
    for (const kind of ['video', 'audio', 'document', 'other']) expect(refs.allows(kind)).toBe(false)
    expect(refs.label).toContain('not inspected')
    for (const context of ['selection', 'skills', 'workflow', 'saved preferences'])
      expect(refs.label).toContain(context)
    expect(refs.label).toContain('Send without images')
    const off = policy.attachmentPolicy({ attachments: false, attachment_transport: 'asset_refs' })
    expect(off.allows('image')).toBe(false)
    expect(off.label).toContain('disabled')
    expect(refs.allowsDeferred).toBe(false)
    expect(off.allowsDeferred).toBe(false)
    expect(policy.attachmentPolicy({ attachments: false }).allowsDeferred).toBe(false)
    expect(policy.attachmentPolicy({ attachments: true }).allowsDeferred).toBe(true)
    expect(policy.attachmentPolicy({ attachments: true }).allows('video')).toBe(true)
  })
})
