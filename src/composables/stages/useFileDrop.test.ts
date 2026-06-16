import { describe, expect, it, vi } from 'vitest'

import { type FileKind, fileTypeMatchesKind, hasMatchingItem, pickMatchingFile, useFileDrop } from './useFileDrop'

const item = (kind: string, type: string) => ({ kind, type } as DataTransferItem)
const file = (type: string, name = 'f') => ({ type, name } as File)
const drag = (dataTransfer: unknown) => ({ dataTransfer } as unknown as DragEvent)

describe('fileTypeMatchesKind', () => {
  it('matches image/* for image and video/* for video', () => {
    expect(fileTypeMatchesKind('image/png', 'image')).toBe(true)
    expect(fileTypeMatchesKind('image/png', 'video')).toBe(false)
    expect(fileTypeMatchesKind('video/mp4', 'video')).toBe(true)
    expect(fileTypeMatchesKind('video/mp4', 'image')).toBe(false)
    expect(fileTypeMatchesKind('text/plain', 'image')).toBe(false)
  })
})

describe('hasMatchingItem', () => {
  it('is true only when a file item matches the kind', () => {
    expect(hasMatchingItem([item('file', 'image/png')], 'image')).toBe(true)
    expect(hasMatchingItem([item('file', 'video/mp4')], 'image')).toBe(false)
  })

  it('ignores non-file items', () => {
    expect(hasMatchingItem([item('string', 'image/png')], 'image')).toBe(false)
  })

  it('handles empty/null item lists', () => {
    expect(hasMatchingItem([], 'image')).toBe(false)
    expect(hasMatchingItem(null, 'image')).toBe(false)
  })
})

describe('pickMatchingFile', () => {
  it('returns the first file matching the kind', () => {
    const files = [file('text/plain'), file('image/jpeg', 'a'), file('image/png', 'b')]
    expect(pickMatchingFile(files, 'image')).toBe(files[1])
  })

  it('returns null when nothing matches or the list is empty/null', () => {
    expect(pickMatchingFile([file('video/mp4')], 'image')).toBeNull()
    expect(pickMatchingFile([], 'image')).toBeNull()
    expect(pickMatchingFile(null, 'image')).toBeNull()
  })
})

describe('useFileDrop', () => {
  it('activates drag-over only for a matching dragged item', () => {
    const d = useFileDrop(() => 'image', vi.fn())
    d.onDragEnter(drag({ items: [item('file', 'video/mp4')] }))
    expect(d.isDragOver.value).toBe(false)
    d.onDragEnter(drag({ items: [item('file', 'image/png')] }))
    expect(d.isDragOver.value).toBe(true)
  })

  it('counts nested enter/leave so a child leave does not clear too early', () => {
    const d = useFileDrop(() => 'image', vi.fn())
    const enter = drag({ items: [item('file', 'image/png')] })
    d.onDragEnter(enter)
    d.onDragEnter(enter)
    d.onDragLeave()
    expect(d.isDragOver.value).toBe(true)
    d.onDragLeave()
    expect(d.isDragOver.value).toBe(false)
  })

  it('never lets the counter go negative', () => {
    const d = useFileDrop(() => 'image', vi.fn())
    d.onDragLeave()
    d.onDragLeave()
    expect(d.isDragOver.value).toBe(false)
    d.onDragEnter(drag({ items: [item('file', 'image/png')] }))
    expect(d.isDragOver.value).toBe(true)
  })

  it('on drop, passes a matching file and resets drag state', () => {
    const onFile = vi.fn()
    const d = useFileDrop(() => 'image', onFile)
    d.onDragEnter(drag({ items: [item('file', 'image/png')] }))
    const f = file('image/png')
    d.onDrop(drag({ files: [file('text/plain'), f] }))
    expect(onFile).toHaveBeenCalledWith(f)
    expect(d.isDragOver.value).toBe(false)
  })

  it('on drop with no matching file, resets but does not call onFile', () => {
    const onFile = vi.fn()
    const d = useFileDrop(() => 'image', onFile)
    d.onDrop(drag({ files: [file('video/mp4')] }))
    expect(onFile).not.toHaveBeenCalled()
    expect(d.isDragOver.value).toBe(false)
  })

  it('sets the copy drop effect on drag-over', () => {
    const d = useFileDrop(() => 'image', vi.fn())
    const dt = { dropEffect: '' }
    d.onDragOver(drag(dt))
    expect(dt.dropEffect).toBe('copy')
  })

  it('reads the kind lazily via the getter', () => {
    let kind: FileKind = 'image'
    const d = useFileDrop(() => kind, vi.fn())
    d.onDragEnter(drag({ items: [item('file', 'video/mp4')] }))
    expect(d.isDragOver.value).toBe(false)
    kind = 'video'
    d.onDragEnter(drag({ items: [item('file', 'video/mp4')] }))
    expect(d.isDragOver.value).toBe(true)
  })
})
