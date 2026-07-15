import { describe, expect, it } from 'vitest'

import {
  nextPartId,
  parsePartsData,
  partColor,
  serializePartsData,
  type Part,
} from './types'

describe('parsePartsData / serializePartsData', () => {
  it('round-trips points and boxes', () => {
    const parts: Part[] = [
      { id: 1, kind: 'points', points: [{ x: 10, y: 20, label: 1 }, { x: 30, y: 40, label: 0 }] },
      { id: 2, kind: 'box', box: { x: 1, y: 2, w: 100, h: 50 } },
    ]
    expect(parsePartsData(serializePartsData(parts))).toEqual(parts)
  })

  it('rounds fractional coords on serialize', () => {
    const parts: Part[] = [{ id: 1, kind: 'points', points: [{ x: 10.6, y: 19.4, label: 1 }] }]
    const parsed = parsePartsData(serializePartsData(parts))
    expect(parsed[0]).toEqual({ id: 1, kind: 'points', points: [{ x: 11, y: 19, label: 1 }] })
  })

  it('serializes empty parts to empty string', () => {
    expect(serializePartsData([])).toBe('')
  })

  it('drops malformed entries on parse', () => {
    const json = JSON.stringify({ parts: [
      { id: 1, kind: 'points', points: [{ x: 1, y: 2 }, { x: 'bad' }] },
      { id: 2, kind: 'box', box: { x: 0, y: 0, w: 0, h: 10 } },
      { id: 3, kind: 'mystery' },
    ] })
    const parsed = parsePartsData(json)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].kind).toBe('points')
    expect((parsed[0] as { points: unknown[] }).points).toHaveLength(1)
  })

  it('returns [] for invalid JSON', () => {
    expect(parsePartsData('{oops')).toEqual([])
    expect(parsePartsData('')).toEqual([])
  })
})

describe('helpers', () => {
  it('nextPartId is max+1', () => {
    expect(nextPartId([])).toBe(1)
    expect(nextPartId([
      { id: 3, kind: 'box', box: { x: 0, y: 0, w: 1, h: 1 } },
      { id: 1, kind: 'points', points: [{ x: 0, y: 0, label: 1 }] },
    ])).toBe(4)
  })

  it('partColor cycles the palette', () => {
    expect(partColor(0)).toBe(partColor(8))
    expect(partColor(1)).not.toBe(partColor(2))
  })
})
