import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  downloadBlob,
  downloadFile,
  extractFilenameFromContentDisposition,
  extractFilenameFromUrl,
} from './download'

describe('extractFilenameFromUrl', () => {
  it('returns the filename query param when present', () => {
    expect(extractFilenameFromUrl('/view?filename=foo.png')).toBe('foo.png')
    expect(extractFilenameFromUrl('/view?filename=foo.png&type=output')).toBe('foo.png')
  })

  it('returns null when no filename param', () => {
    expect(extractFilenameFromUrl('/view?type=output')).toBeNull()
    expect(extractFilenameFromUrl('/static/image.png')).toBeNull()
  })

  it('returns null for un-parseable input', () => {
    expect(extractFilenameFromUrl('://not a url')).toBeNull()
  })
})

describe('extractFilenameFromContentDisposition', () => {
  it('handles RFC 5987 utf-8 extended format', () => {
    expect(extractFilenameFromContentDisposition(
      `attachment; filename="fallback.png"; filename*=UTF-8''hello%20world.png`,
    )).toBe('hello world.png')
  })

  it('handles plain quoted filename', () => {
    expect(extractFilenameFromContentDisposition(
      `attachment; filename="report.json"`,
    )).toBe('report.json')
  })

  it('handles unquoted filename', () => {
    expect(extractFilenameFromContentDisposition(
      'attachment; filename=ace_song.json',
    )).toBe('ace_song.json')
  })

  it('returns null when header is null/empty/un-parseable', () => {
    expect(extractFilenameFromContentDisposition(null)).toBeNull()
    expect(extractFilenameFromContentDisposition('')).toBeNull()
    expect(extractFilenameFromContentDisposition('inline')).toBeNull()
  })

  it('prefers the RFC 5987 form over the plain one when both are present', () => {
    expect(extractFilenameFromContentDisposition(
      `attachment; filename="fallback.png"; filename*=UTF-8''real%20name.png`,
    )).toBe('real name.png')
  })

  it('falls back to plain form when RFC 5987 decoding errors out', () => {
    expect(extractFilenameFromContentDisposition(
      `attachment; filename="ok.png"; filename*=UTF-8''bro%ZZken.png`,
    )).toBe('ok.png')
  })
})

describe('downloadBlob / downloadFile', () => {
  let createdAnchors: HTMLAnchorElement[]
  let createdBlobUrls: string[]

  beforeEach(() => {
    createdAnchors = []
    createdBlobUrls = []
    ;(URL as any).createObjectURL = vi.fn((_blob: Blob) => {
      const u = `blob:test/${createdBlobUrls.length}`
      createdBlobUrls.push(u)
      return u
    })
    ;(URL as any).revokeObjectURL = vi.fn()
    const realCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: any) => {
      const el = realCreate(tag)
      if (tag === 'a') {
        ;(el as any).click = vi.fn()
        createdAnchors.push(el as HTMLAnchorElement)
      }
      return el
    })
  })

  afterEach(() => vi.restoreAllMocks())

  it('downloadBlob synthesizes a blob: URL and clicks an anchor with the right name', () => {
    const blob = new Blob(['x'], { type: 'image/png' })
    downloadBlob('report.png', blob)
    expect(createdAnchors).toHaveLength(1)
    expect(createdAnchors[0].download).toBe('report.png')
    expect(createdAnchors[0].href).toContain('blob:')
    expect((createdAnchors[0] as any).click).toHaveBeenCalled()
  })

  it('downloadFile fetches → derives filename from Content-Disposition → downloads', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(new Blob(['x']), {
        status: 200,
        headers: {
          'content-disposition': `attachment; filename="server-name.png"`,
        },
      }),
    )
    await downloadFile('/view?filename=ignored.png')
    expect(fetchSpy).toHaveBeenCalled()
    expect(createdAnchors[0].download).toBe('server-name.png')
  })

  it('downloadFile falls back to the URL filename param when no header is set', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(new Blob(['x']), { status: 200 }),
    )
    await downloadFile('/view?filename=from-url.png')
    expect(createdAnchors[0].download).toBe('from-url.png')
  })

  it('downloadFile uses the explicit filename arg over everything else', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(new Blob(['x']), {
        status: 200,
        headers: { 'content-disposition': 'attachment; filename="header.png"' },
      }),
    )
    await downloadFile('/view?filename=url.png', 'override.png')
    expect(createdAnchors[0].download).toBe('override.png')
  })

  it('downloadFile falls back to "download" when no filename source exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(new Blob(['x']), { status: 200 }),
    )
    await downloadFile('/static/something')
    expect(createdAnchors[0].download).toBe('download')
  })

  it('downloadFile throws on non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('nope', { status: 404, statusText: 'Not Found' }),
    )
    await expect(downloadFile('/view?filename=x.png')).rejects.toThrow(/download fetch 404/)
  })

  it('downloadFile rejects empty input', async () => {
    await expect(downloadFile('')).rejects.toThrow(/empty url/)
  })
})
