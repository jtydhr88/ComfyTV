import { describe, expect, it } from 'vitest'

import type { EqBand } from '@/composables/widgets/fx/eqMath'
import { QUICK_BANDS, parseEqBands, serializeEqBands, useEqBands } from './useEqBands'

function makeNode(rawBands = '') {
  return {
    widgets: [{ name: 'bands', value: rawBands, callback: undefined as any }],
  } as any
}

const BAND: EqBand = { type: 'peak', f: 1000, g: 3, q: 1 }

describe('parseEqBands / serializeEqBands', () => {
  it('round-trips a band list', () => {
    expect(parseEqBands(serializeEqBands([BAND]))).toEqual([BAND])
  })

  it('parses empty / malformed / non-array input to []', () => {
    expect(parseEqBands('')).toEqual([])
    expect(parseEqBands('{bad')).toEqual([])
    expect(parseEqBands('{"a":1}')).toEqual([])
  })

  it('serializes an empty list to the empty string', () => {
    expect(serializeEqBands([])).toBe('')
  })
})

describe('QUICK_BANDS', () => {
  it('keeps the five quick presets', () => {
    expect(QUICK_BANDS.map(b => b.band.type)).toEqual([
      'peak', 'highpass', 'lowpass', 'lowshelf', 'highshelf',
    ])
  })
})

describe('useEqBands', () => {
  it('reads the initial widget value', () => {
    const node = makeNode(JSON.stringify([BAND]))
    const { bands } = useEqBands(node)
    expect(bands.value).toEqual([BAND])
  })

  it('addBand appends a copy and persists to the widget', () => {
    const node = makeNode()
    const { bands, addBand } = useEqBands(node)
    addBand(BAND)
    expect(bands.value).toEqual([BAND])
    expect(bands.value[0]).not.toBe(BAND)
    expect(node.widgets[0].value).toBe(JSON.stringify([BAND]))
  })

  it('removeBand deletes by index and clears the widget when empty', () => {
    const node = makeNode(JSON.stringify([BAND, { ...BAND, f: 2000 }]))
    const { bands, removeBand } = useEqBands(node)
    removeBand(0)
    expect(bands.value).toEqual([{ ...BAND, f: 2000 }])
    removeBand(0)
    expect(bands.value).toEqual([])
    expect(node.widgets[0].value).toBe('')
  })

  it('assigning [] resets the widget to empty', () => {
    const node = makeNode(JSON.stringify([BAND]))
    const { bands } = useEqBands(node)
    bands.value = []
    expect(node.widgets[0].value).toBe('')
  })
})
