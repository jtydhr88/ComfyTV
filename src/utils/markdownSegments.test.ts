import { describe, expect, it } from 'vitest'

import { extractMediaRefs, segmentMarkdown } from './markdownSegments'

describe('segmentMarkdown', () => {
  it('returns nothing for empty text', () => {
    expect(segmentMarkdown('')).toEqual([])
  })

  it('keeps plain prose as a single segment', () => {
    const segments = segmentMarkdown('Hello **world**\n\n- a\n- b')
    expect(segments).toHaveLength(1)
    expect(segments[0].type).toBe('prose')
  })

  it('splits fenced code out of prose', () => {
    const segments = segmentMarkdown(
      'Before\n\n```python\nprint(1)\n```\n\nAfter')
    expect(segments.map(s => s.type)).toEqual(['prose', 'code', 'prose'])
    expect(segments[1]).toMatchObject({ code: 'print(1)', lang: 'python' })
  })

  it('treats an unterminated trailing fence as code', () => {
    const segments = segmentMarkdown('Intro\n\n```js\nconst x = ')
    expect(segments.map(s => s.type)).toEqual(['prose', 'code'])
    expect(segments[1]).toMatchObject({ lang: 'js' })
  })

  it('normalizes a missing language to an empty string', () => {
    const segments = segmentMarkdown('```\nraw\n```')
    expect(segments).toEqual([{ type: 'code', code: 'raw', lang: '' }])
  })
})

describe('extractMediaRefs', () => {
  it('collects video and audio links as cards', () => {
    const refs = extractMediaRefs(
      'See [the clip](/comfytv/out/final.mp4) and '
      + 'https://x.test/song.mp3?dl=1')
    expect(refs).toEqual([
      { kind: 'video', url: '/comfytv/out/final.mp4' },
      { kind: 'audio', url: 'https://x.test/song.mp3?dl=1' },
    ])
  })

  it('skips inline markdown images but keeps image links', () => {
    const refs = extractMediaRefs(
      '![shown](/out/a.png) plus [download](/out/b.png)')
    expect(refs).toEqual([{ kind: 'image', url: '/out/b.png' }])
  })

  it('dedupes repeated urls and ignores non-media links', () => {
    const refs = extractMediaRefs(
      '[a](/x.mp4) [b](/x.mp4) [doc](/readme.txt) https://plain.test/page')
    expect(refs).toEqual([{ kind: 'video', url: '/x.mp4' }])
  })
})
