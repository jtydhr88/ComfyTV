import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  downloadBlob,
  downloadFile,
  extractFilenameFromContentDisposition,
  extractFilenameFromUrl,
} from './download'


describe('extractFilenameFromUrl', () => {
  it('reads `filename` query param', () => {
    expect(extractFilenameFromUrl('/view?filename=cat.png&type=output')).toBe('cat.png')
  })

  it('returns null when no filename param', () => {
    expect(extractFilenameFromUrl('/view?type=output')).toBeNull()
  })

  it('handles absolute URLs', () => {
    expect(extractFilenameFromUrl('https://example.com/x?filename=z.jpg')).toBe('z.jpg')
  })

  it('returns null for garbage input', () => {
    expect(() => extractFilenameFromUrl('::::')).not.toThrow()
  })
})


describe('extractFilenameFromContentDisposition', () => {
  it('returns null when header is null / empty', () => {
    expect(extractFilenameFromContentDisposition(null)).toBeNull()
    expect(extractFilenameFromContentDisposition('')).toBeNull()
  })

  it('reads RFC 5987 filename*=UTF-8\'\'… (with URL encoding)', () => {
    const h = "attachment; filename*=UTF-8''caf%C3%A9.jpg"
    expect(extractFilenameFromContentDisposition(h)).toBe('café.jpg')
  })

  it('falls back to plain ASCII when RFC 5987 decode fails', () => {
    const h = "attachment; filename*=UTF-8''%E0%A4%A; filename=\"plain.png\""
    expect(extractFilenameFromContentDisposition(h)).toBe('plain.png')
  })

  it('reads quoted filename="…"', () => {
    expect(extractFilenameFromContentDisposition('attachment; filename="hello world.png"'))
      .toBe('hello world.png')
  })

  it('reads unquoted filename=…', () => {
    expect(extractFilenameFromContentDisposition('attachment; filename=cat.png'))
      .toBe('cat.png')
  })

  it('returns null when nothing matches', () => {
    expect(extractFilenameFromContentDisposition('attachment')).toBeNull()
  })
})


describe('downloadBlob', () => {
  let clickSpy: any
  let revokeSpy: any
  let originalCreateObjectURL: any
  let originalRevokeObjectURL: any

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL
    originalRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    revokeSpy = vi.fn()
    URL.revokeObjectURL = revokeSpy
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    clickSpy.mockRestore()
  })

  it('creates an object URL, clicks an <a download>, then revokes', async () => {
    downloadBlob('out.png', new Blob(['x']))
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(clickSpy).toHaveBeenCalledOnce()
    await new Promise(resolve => queueMicrotask(() => resolve(null)))
    expect(revokeSpy).toHaveBeenCalledWith('blob:fake')
  })

  it('the synthesized <a> is removed from the DOM', () => {
    downloadBlob('out.png', new Blob(['x']))
    expect(document.querySelectorAll('a').length).toBe(0)
  })
})


describe('downloadFile', () => {
  let clickSpy: any
  let fetchSpy: any
  let originalCreateObjectURL: any
  let originalRevokeObjectURL: any

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL
    originalRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    clickSpy.mockRestore()
    fetchSpy.mockRestore()
  })

  it('throws on empty url', async () => {
    await expect(downloadFile('')).rejects.toThrow(/empty url/)
  })

  it('throws on non-OK HTTP response', async () => {
    fetchSpy.mockResolvedValue(new Response('nope', { status: 404, statusText: 'Not Found' }))
    await expect(downloadFile('/view?filename=x.png')).rejects.toThrow(/download fetch 404/)
  })

  it('uses explicit filename arg when given', async () => {
    fetchSpy.mockResolvedValue(new Response('hi', { status: 200 }))
    await downloadFile('/view?filename=ignored.png', 'explicit.png')
    const link = clickSpy.mock.instances[0] as HTMLAnchorElement
    expect(link.getAttribute('download')).toBe('explicit.png')
  })

  it('falls back to Content-Disposition filename', async () => {
    fetchSpy.mockResolvedValue(new Response('hi', {
      status: 200,
      headers: { 'Content-Disposition': 'attachment; filename="from-header.png"' },
    }))
    await downloadFile('/view?filename=other.png')
    const link = clickSpy.mock.instances[0] as HTMLAnchorElement
    expect(link.getAttribute('download')).toBe('from-header.png')
  })

  it('falls back to URL ?filename= query param', async () => {
    fetchSpy.mockResolvedValue(new Response('hi', { status: 200 }))
    await downloadFile('/view?filename=from-url.png')
    const link = clickSpy.mock.instances[0] as HTMLAnchorElement
    expect(link.getAttribute('download')).toBe('from-url.png')
  })

  it('falls back to "download" default when nothing else matches', async () => {
    fetchSpy.mockResolvedValue(new Response('hi', { status: 200 }))
    await downloadFile('/something-without-filename')
    const link = clickSpy.mock.instances[0] as HTMLAnchorElement
    expect(link.getAttribute('download')).toBe('download')
  })
})
