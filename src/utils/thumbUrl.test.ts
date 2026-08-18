import { describe, expect, it } from 'vitest'
import { THUMB_TILE, thumbUrl } from './thumbUrl'

describe('thumbUrl', () => {
  it('rewrites local /view image urls to the thumb endpoint', () => {
    const src = '/view?filename=a.png&type=output'
    expect(thumbUrl(src, 256)).toBe(
      `/comfytv/thumb?url=${encodeURIComponent(src)}&max=256`)
  })

  it('supports /api/view and subfolders', () => {
    const src = '/api/view?filename=b.jpg&subfolder=comfytv%2Fvideo&type=output'
    expect(thumbUrl(src, THUMB_TILE)).toContain('/comfytv/thumb?url=')
  })

  it('handles annotated filenames', () => {
    const src = '/view?filename=a.png%20%5Boutput%5D&type=input'
    expect(thumbUrl(src, 256)).toContain('/comfytv/thumb?url=')
  })

  it('passes through non-image files', () => {
    const src = '/view?filename=a.mp4&type=output'
    expect(thumbUrl(src, 256)).toBe(src)
  })

  it('passes through absolute, blob and data urls', () => {
    expect(thumbUrl('http://other:8188/view?filename=a.png', 256))
      .toBe('http://other:8188/view?filename=a.png')
    expect(thumbUrl('blob:http://x/123', 256)).toBe('blob:http://x/123')
    expect(thumbUrl('data:image/png;base64,AAAA', 256))
      .toBe('data:image/png;base64,AAAA')
  })

  it('passes through empty and query-less values', () => {
    expect(thumbUrl('', 256)).toBe('')
    expect(thumbUrl(null, 256)).toBe('')
    expect(thumbUrl('/view', 256)).toBe('/view')
  })
})
