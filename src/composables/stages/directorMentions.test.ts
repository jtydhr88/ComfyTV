import { describe, expect, it } from 'vitest'

import {
  clipMentionSource,
  expandDirectorTimeline,
  mergedMentionOrders,
} from './directorMentions'
import { normalizeClip, serializeTimeline } from './useDirectorTimeline'

function clip(overrides: any = {}) {
  return normalizeClip({ id: 'c1', prompt: '', ...overrides })
}

function timeline(clips: any[], chain: 'off' | 'prepend' | 'replace' = 'off') {
  return serializeTimeline(clips, { chain })
}

const OPTS = {
  defaultWorkflow: 'WF',
  expandEntries: (s: string) => s,
  styleFor: async () => 'minimax_tags' as const,
  naturalText: (type: string, n: number) => `${type} ${n}`,
}

async function expand(raw: string, opts: any = {}) {
  return JSON.parse(await expandDirectorTimeline(raw, { ...OPTS, ...opts }))
}

describe('mergedMentionOrders / clipMentionSource', () => {
  it('orders span shared then own refs', () => {
    const c = clip({ images: ['/a', '/b'], videos: ['/v'], audio: [] })
    expect(mergedMentionOrders(c, { images: ['/h'], videos: [], audio: ['/s'] }))
      .toEqual({ image: [0, 1, 2], video: [0], audio: [0] })
  })

  it('source previews shared first, then clip images', () => {
    const c = clip({ images: ['/own.png'] })
    const src = clipMentionSource(() => c,
      () => ({ images: ['/hero.png'], videos: [], audio: [] }))
    expect(src.previewUrl('image', 0)).toBe('/hero.png')
    expect(src.previewUrl('image', 1)).toBe('/own.png')
    expect(src.previewUrl('video', 0)).toBeNull()
    const empty = clipMentionSource(() => null)
    expect(empty.orders()).toEqual({ image: [], video: [], audio: [] })
  })
})

describe('expandDirectorTimeline (selection model)', () => {
  it('cited refs only are sent, ordinals follow the sent list', async () => {
    const out = await expand(timeline([
      clip({ prompt: '@image_0 @image_2 @video_1 @audio_1',
             images: ['/i'], videos: ['/v'], audio: ['/a'] }),
    ]), {
      shared: { images: ['/h1', '/h2'], videos: ['/hv'], audio: ['/ha'] },
    })
    const c = out.clips[0]
    expect(c.prompt).toBe('<Picture 1> <Picture 2> <Video 1> <Audio 2>')
    expect(c.images).toEqual(['/h1', '/i'])
    expect(c.videos).toEqual(['/v'])
    expect(c.audio).toEqual(['/a'])
  })

  it('no mentions at all sends the whole pool untouched', async () => {
    const out = await expand(timeline([
      clip({ prompt: 'plain text', images: ['/own'] }),
    ]), { shared: { images: ['/h'], videos: ['/hv'], audio: [] } })
    const c = out.clips[0]
    expect(c.prompt).toBe('plain text')
    expect(c.images).toEqual(['/h', '/own'])
    expect(c.videos).toEqual(['/hv'])
  })

  it('minimax audio ordinal counts sent videos first', async () => {
    const out = await expand(timeline([
      clip({ prompt: '动作学 @video_0，声音学 @audio_0',
             videos: ['/v'], audio: ['/a'] }),
    ]))
    expect(out.clips[0].prompt).toBe('动作学 <Video 1>，声音学 <Audio 2>')
  })

  it('natural audio ordinal ignores videos', async () => {
    const out = await expand(timeline([
      clip({ prompt: '@video_0 @audio_0', videos: ['/v'], audio: ['/a'] }),
    ]), { styleFor: async () => 'natural' })
    expect(out.clips[0].prompt).toBe('video 1 audio 1')
  })

  it('chain prepend shifts image ordinals on later clips', async () => {
    const out = await expand(timeline([
      clip({ id: 'a', prompt: '@image_0', images: ['/a'] }),
      clip({ id: 'b', prompt: '@image_0', images: ['/b'] }),
    ], 'prepend'))
    expect(out.clips[0].prompt).toBe('<Picture 1>')
    expect(out.clips[1].prompt).toBe('<Picture 2>')
  })

  it('chain replace drops image tokens and sends no images', async () => {
    const missing: string[] = []
    const out = await expand(timeline([
      clip({ id: 'a', prompt: 'x' }),
      clip({ id: 'b', prompt: 'see @image_0 hear @audio_0',
             images: ['/b'], audio: ['/s'] }),
    ], 'replace'), {
      onMissing: (cid: string, type: string, slot: number) =>
        missing.push(`${cid}:${type}_${slot}`),
    })
    expect(out.clips[1].prompt).toBe('see  hear <Audio 1>')
    expect(out.clips[1].images).toEqual([])
    expect(missing).toEqual(['b:image_0'])
  })

  it('entries expansion can introduce mentions and flips manual mode', async () => {
    const out = await expand(timeline([
      clip({ prompt: '@myentry', images: ['/a', '/b'] }),
    ]), { expandEntries: (s: string) => s.replace('@myentry', 'hero @image_1') })
    expect(out.clips[0].prompt).toBe('hero <Picture 1>')
    expect(out.clips[0].images).toEqual(['/b'])
  })

  it('disabled clips untouched, out-of-pool tokens dropped', async () => {
    const missing: string[] = []
    const out = await expand(timeline([
      clip({ id: 'a', enabled: false, prompt: '@image_0', images: ['/a'] }),
      clip({ id: 'b', prompt: '@image_3', images: ['/b'] }),
    ]), {
      onMissing: (cid: string, type: string, slot: number) =>
        missing.push(`${cid}:${type}_${slot}`),
    })
    expect(out.clips[0].prompt).toBe('@image_0')
    expect(out.clips[1].prompt).toBe('')
    expect(missing).toEqual(['b:image_3'])
  })

  it('resolves style per clip workflow with node default fallback', async () => {
    const seen: string[] = []
    await expand(timeline([
      clip({ id: 'a', prompt: '@image_0', images: ['/a'], workflow: 'Special' }),
      clip({ id: 'b', prompt: '@image_0', images: ['/b'] }),
    ]), {
      styleFor: async (label: string) => { seen.push(label); return 'minimax_tags' },
    })
    expect(seen).toEqual(['Special', 'WF'])
  })
})
