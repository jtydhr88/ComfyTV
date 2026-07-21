import { describe, it, expect } from 'vitest'
import { fxChainRowsOf, parseFxSpec } from './useFxChain'

describe('parseFxSpec', () => {
  it('summarizes a single spec by label', () => {
    const raw = JSON.stringify({ v: 1, kind: 'ComfyTV.GlowStage', label: 'Glow', domain: 'video', specs: [] })
    expect(parseFxSpec(raw)).toEqual({ label: 'Glow', count: 1 })
  })

  it('joins chain entry labels in order', () => {
    const raw = JSON.stringify({ v: 1, chain: [
      { kind: 'A', label: 'Curves', domain: 'video', specs: [] },
      { kind: 'B', label: 'Color', domain: 'video', specs: [] },
    ] })
    expect(parseFxSpec(raw)).toEqual({ label: 'Curves → Color', count: 2 })
  })

  it('falls back to kind when label is missing', () => {
    const raw = JSON.stringify({ v: 1, kind: 'ComfyTV.OldFilmStage', domain: 'video', specs: [] })
    expect(parseFxSpec(raw)?.label).toBe('ComfyTV.OldFilmStage')
  })

  it('returns null for empty, invalid JSON, or shapeless payloads', () => {
    expect(parseFxSpec(null)).toBeNull()
    expect(parseFxSpec('')).toBeNull()
    expect(parseFxSpec('oops')).toBeNull()
    expect(parseFxSpec('[1,2]')).toBeNull()
    expect(parseFxSpec('{}')).toBeNull()
  })
})

interface FakeNode {
  id: number
  comfyClass?: string
  title?: string
  inputs: { name: string; link: number | null }[]
}

function makeGraphApp(nodes: FakeNode[], links: Record<number, number>) {
  const map = new Map<number, { origin_id: number; origin_slot: number }>()
  for (const [id, origin] of Object.entries(links)) {
    map.set(Number(id), { origin_id: origin, origin_slot: 0 })
  }
  return {
    graph: {
      links: map,
      getNodeById: (id: number) => nodes.find(n => n.id === id) ?? null,
    },
  }
}

function fxNode(id: number, cls: string, title: string,
                videoLink: number | null = null): FakeNode {
  return {
    id,
    comfyClass: cls,
    title,
    inputs: [{ name: 'video', link: videoLink }],
  }
}

function chainNode(videoLink: number | null): FakeNode {
  return {
    id: 99,
    comfyClass: 'ComfyTV.FXChainStage',
    inputs: [{ name: 'video', link: videoLink }],
  }
}

describe('fxChainRowsOf', () => {
  it('walks the video wire upstream, topmost first', () => {
    const src = fxNode(1, 'ComfyTV.VideoLoaderStage', 'Load Video')
    const fx1 = fxNode(2, 'ComfyTV.VideoCurvesStage', 'Video Curves', 1)
    const fx2 = fxNode(3, 'ComfyTV.VideoColorStage', 'Video Color', 2)
    const chain = chainNode(3)
    const gapp = makeGraphApp([src, fx1, fx2, chain], { 1: 1, 2: 2, 3: 3 })
    const rows = fxChainRowsOf(chain, gapp)
    expect(rows.map(r => r.label)).toEqual(['Video Curves', 'Video Color'])
    expect(rows.map(r => r.ordinal)).toEqual([1, 2])
  })

  it('flags stages without a GLSL renderer as no-preview', () => {
    const fx1 = fxNode(1, 'ComfyTV.GlowStage', 'Glow')
    const fx2 = fxNode(2, 'ComfyTV.VideoColorStage', 'Video Color', 1)
    const chain = chainNode(2)
    const gapp = makeGraphApp([fx1, fx2, chain], { 1: 1, 2: 2 })
    expect(fxChainRowsOf(chain, gapp).map(r => r.preview))
      .toEqual([false, true])
  })

  it('returns empty when video is not connected', () => {
    const chain = chainNode(null)
    expect(fxChainRowsOf(chain, makeGraphApp([chain], {}))).toEqual([])
  })

  it('stops below a keyer that has side inputs wired (baked locally)', () => {
    const fx1 = fxNode(1, 'ComfyTV.VideoCurvesStage', 'Video Curves')
    const keyer: FakeNode = {
      id: 2,
      comfyClass: 'ComfyTV.KeyerStage',
      title: 'Keyer',
      inputs: [
        { name: 'video', link: 1 },
        { name: 'in_mask', link: 7 },
      ],
    }
    const fx3 = fxNode(3, 'ComfyTV.VideoColorStage', 'Video Color', 2)
    const chain = chainNode(3)
    const gapp = makeGraphApp([fx1, keyer, fx3, chain],
                              { 1: 1, 2: 2, 3: 3, 7: 1 })
    expect(fxChainRowsOf(chain, gapp).map(r => r.label))
      .toEqual(['Video Color'])
  })
})
