import { describe, expect, it } from 'vitest'

import {
  assetChipLabel,
  type ImageSlotOption,
  injectImageRefs,
  missingRequiredImageSlots,
  nodeAcceptsAutogrowImages,
  refCoveredImageSlots,
  refSlotWarnings,
  type ResolvedImageRef,
  wiredImageSlots,
} from './assetSlots'

function opt(slot: number): ImageSlotOption {
  return { slot, nodeTitles: [`LoadImage ${slot}`] }
}

function ref(over: Partial<ResolvedImageRef> = {}): ResolvedImageRef {
  return { id: 1, url: '/view?a.png', slot: 0, ...over }
}

describe('assetChipLabel', () => {
  it('prefers the asset name, falls back to a stable id label', () => {
    expect(assetChipLabel({ name: 'hero' } as any, 7)).toBe('hero')
    expect(assetChipLabel({ name: '' } as any, 7)).toBe('asset:7')
    expect(assetChipLabel(undefined, 7)).toBe('asset:7')
  })
})

describe('nodeAcceptsAutogrowImages', () => {
  it('detects an images autogrow group', () => {
    expect(nodeAcceptsAutogrowImages({ inputs: [{ name: 'images.image0' }] })).toBe(true)
    expect(nodeAcceptsAutogrowImages({ inputs: [{ name: 'texts.text0' }] })).toBe(false)
    expect(nodeAcceptsAutogrowImages({ inputs: [] })).toBe(false)
    expect(nodeAcceptsAutogrowImages(null)).toBe(false)
    expect(nodeAcceptsAutogrowImages({})).toBe(false)
  })
})

describe('wiredImageSlots', () => {
  it('returns only the connected image slots', () => {
    const node = {
      inputs: [
        { name: 'images.image0', link: 12 },
        { name: 'images.image1', link: null },
        { name: 'images.image2', link: 3 },
        { name: 'texts.text0', link: 5 },
      ],
    }
    expect(wiredImageSlots(node)).toEqual([0, 2])
    expect(wiredImageSlots(null)).toEqual([])
  })
})

describe('injectImageRefs', () => {
  it('does nothing for an empty ref list', () => {
    const inputs: Record<string, unknown> = {}
    expect(injectImageRefs(inputs, [])).toEqual([])
    expect(inputs).toEqual({})
  })

  it('writes each reference to its pinned slot', () => {
    const inputs: Record<string, unknown> = {}
    injectImageRefs(inputs, [ref({ url: '/a', slot: 0 }), ref({ url: '/b', slot: 1 })])
    expect(inputs).toEqual({ 'images.image0': '/a', 'images.image1': '/b' })
  })

  it('writes a reference to its slot regardless of which other slots are wired', () => {
    const inputs: Record<string, unknown> = { 'images.image0': '/wired' }
    injectImageRefs(inputs, [ref({ url: '/a', slot: 1 })])
    expect(inputs['images.image1']).toBe('/a')
    expect(inputs['images.image0']).toBe('/wired')
  })

  it('a pinned ref overrides an upstream connection and warns', () => {
    const inputs: Record<string, unknown> = { 'images.image0': '/wired' }
    const warnings = injectImageRefs(inputs, [ref({ url: '/pin', slot: 0 })])
    expect(inputs['images.image0']).toBe('/pin')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/override/i)
  })

  it('two refs pinned to the same slot warn, last one wins', () => {
    const inputs: Record<string, unknown> = {}
    const warnings = injectImageRefs(inputs, [
      ref({ url: '/first', slot: 0 }),
      ref({ url: '/second', slot: 0 }),
    ])
    expect(inputs['images.image0']).toBe('/second')
    expect(warnings.some(w => /later one wins/i.test(w))).toBe(true)
  })
})

describe('refCoveredImageSlots', () => {
  it('returns the slots the references are pinned to', () => {
    expect([...refCoveredImageSlots([{ slot: 2 }, { slot: 0 }, { slot: 1 }])].sort())
      .toEqual([0, 1, 2])
  })

  it('is empty for no refs', () => {
    expect([...refCoveredImageSlots([])]).toEqual([])
  })
})

describe('missingRequiredImageSlots', () => {
  it('flags required slots covered by neither a wire nor a ref', () => {
    expect(missingRequiredImageSlots([0, 1, 2], [0], [2])).toEqual([1])
  })

  it('returns nothing when every required slot has a source', () => {
    expect(missingRequiredImageSlots([0, 1], [0], [1])).toEqual([])
  })

  it('honors non-contiguous required slots', () => {
    expect(missingRequiredImageSlots([0, 2], [0], [])).toEqual([2])
  })

  it('is empty when nothing is required', () => {
    expect(missingRequiredImageSlots([], [], [])).toEqual([])
  })
})

describe('refSlotWarnings', () => {
  it('returns nothing for no refs', () => {
    expect(refSlotWarnings([], [], [opt(0)])).toEqual([])
  })

  it('flags a slot pinned by two refs', () => {
    const w = refSlotWarnings([{ slot: 0 }, { slot: 0 }], [], null)
    expect(w).toContainEqual({ kind: 'duplicate', slot: 0 })
  })

  it('flags a pinned ref that overrides a wired slot', () => {
    const w = refSlotWarnings([{ slot: 1 }], [1], null)
    expect(w).toContainEqual({ kind: 'override', slot: 1 })
  })

  it('skips consumability checks when options are unknown (null)', () => {
    expect(refSlotWarnings([{ slot: 0 }], [], null)).toEqual([])
  })

  it('warns noSlots when the workflow binds no image slot but refs exist', () => {
    expect(refSlotWarnings([{ slot: 0 }], [], [])).toEqual([{ kind: 'noSlots' }])
  })

  it('warns overflow when a ref sits on a slot the workflow does not bind', () => {
    const w = refSlotWarnings([{ slot: 0 }, { slot: 1 }], [], [opt(0)])
    expect(w).toContainEqual({ kind: 'overflow', count: 1, total: 1 })
  })

  it('no overflow when every ref lands on a bound slot', () => {
    const w = refSlotWarnings([{ slot: 0 }, { slot: 1 }], [], [opt(0), opt(1)])
    expect(w.some(x => x.kind === 'overflow')).toBe(false)
    expect(w.some(x => x.kind === 'noSlots')).toBe(false)
  })
})
