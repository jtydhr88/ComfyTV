import { describe, expect, it } from 'vitest'

import { dragMayMatchKind, mediaTypeOf } from './mediaFileTypes'

describe('mediaTypeOf', () => {
  it('uses MIME types when the platform provides them', () => {
    expect(mediaTypeOf(new File(['x'], 'opaque', { type: 'image/png' }))).toBe('image')
  })

  it.each([
    ['photo.HEIC', 'image'],
    ['clip.MOV', 'video'],
    ['voice.M4A', 'audio'],
  ] as const)('recognizes a promised %s file with no MIME as %s', (name, kind) => {
    expect(mediaTypeOf(new File(['x'], name, { type: '' }))).toBe(kind)
  })

  it('does not mistake an unknown file for media', () => {
    expect(mediaTypeOf(new File(['x'], 'workflow.json', { type: '' }))).toBeNull()
  })
})

describe('dragMayMatchKind', () => {
  it('allows a promised file whose MIME is hidden until drop', () => {
    const event = {
      dataTransfer: { items: [{ kind: 'file', type: '' }] },
    } as unknown as DragEvent
    expect(dragMayMatchKind(event, 'image')).toBe(true)
  })

  it('still rejects a mismatching declared MIME', () => {
    const event = {
      dataTransfer: { items: [{ kind: 'file', type: 'application/json' }] },
    } as unknown as DragEvent
    expect(dragMayMatchKind(event, 'image')).toBe(false)
  })
})
