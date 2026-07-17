import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import {
  DEFAULT_HUE_CURVE,
  parseCurves,
  useHueCorrectCurves,
  type HueCurvePoints,
} from './useHueCorrectCurves'

describe('parseCurves', () => {
  it('parses a valid channel map', () => {
    expect(parseCurves('{"sat":[[0,1],[0.5,0.2],[1,1]]}')).toEqual({
      sat: [[0, 1], [0.5, 0.2], [1, 1]],
    })
  })

  it('returns an empty map for empty input', () => {
    expect(parseCurves('')).toEqual({})
  })

  it('returns an empty map for corrupt JSON', () => {
    expect(parseCurves('{oops')).toEqual({})
  })

  it('rejects non-object JSON payloads', () => {
    expect(parseCurves('[[0,1]]')).toEqual({})
    expect(parseCurves('null')).toEqual({})
    expect(parseCurves('"x"')).toEqual({})
  })
})

function setup(initial = '', channelName = 'sat') {
  const curves = ref(initial)
  const channel = ref(channelName)
  const { activeCurve } = useHueCorrectCurves({ curves, channel })
  return { curves, channel, activeCurve }
}

describe('useHueCorrectCurves get', () => {
  it('returns a fresh default curve when nothing is stored', () => {
    const { activeCurve } = setup()
    expect(activeCurve.value).toEqual(DEFAULT_HUE_CURVE)
    expect(activeCurve.value).not.toBe(DEFAULT_HUE_CURVE)
  })

  it('returns the stored curve for the active channel', () => {
    const { activeCurve } = setup('{"sat":[[0,1],[0.4,0.6],[1,1]]}')
    expect(activeCurve.value).toEqual([[0, 1], [0.4, 0.6], [1, 1]])
  })

  it('falls back to the default for a too-short stored curve', () => {
    const { activeCurve } = setup('{"sat":[[0,1]]}')
    expect(activeCurve.value).toEqual(DEFAULT_HUE_CURVE)
  })

  it('tracks the selected channel', () => {
    const { activeCurve, channel } = setup('{"hue":[[0,0.5],[1,0.5]]}')
    expect(activeCurve.value).toEqual(DEFAULT_HUE_CURVE)
    channel.value = 'hue'
    expect(activeCurve.value).toEqual([[0, 0.5], [1, 0.5]])
  })
})

describe('useHueCorrectCurves set', () => {
  it('stores points rounded to 3 decimals', () => {
    const { curves, activeCurve } = setup()
    activeCurve.value = [[0, 1], [0.123456, 0.98765], [1, 1]] as HueCurvePoints
    expect(JSON.parse(curves.value)).toEqual({
      sat: [[0, 1], [0.123, 0.988], [1, 1]],
    })
  })

  it('drops the channel when set back to the default curve', () => {
    const { curves, activeCurve } = setup('{"sat":[[0,1],[0.5,0.2],[1,1]],"hue":[[0,0.5],[1,0.5]]}')
    activeCurve.value = [[0, 1], [1, 1]] as HueCurvePoints
    expect(JSON.parse(curves.value)).toEqual({ hue: [[0, 0.5], [1, 0.5]] })
  })

  it('clears the widget entirely when the last channel resets', () => {
    const { curves, activeCurve } = setup('{"sat":[[0,1],[0.5,0.2],[1,1]]}')
    activeCurve.value = [[0.0004, 1.0004], [1.0004, 0.9996]] as HueCurvePoints
    expect(curves.value).toBe('')
  })

  it('keeps other channels intact when writing one', () => {
    const { curves, channel, activeCurve } = setup('{"hue":[[0,0.5],[1,0.5]]}')
    channel.value = 'lum'
    activeCurve.value = [[0, 0.9], [1, 0.9]] as HueCurvePoints
    expect(JSON.parse(curves.value)).toEqual({
      hue: [[0, 0.5], [1, 0.5]],
      lum: [[0, 0.9], [1, 0.9]],
    })
  })

  it('recovers from corrupt stored JSON by starting a fresh map', () => {
    const { curves, activeCurve } = setup('{broken')
    activeCurve.value = [[0, 0.8], [1, 0.8]] as HueCurvePoints
    expect(JSON.parse(curves.value)).toEqual({ sat: [[0, 0.8], [1, 0.8]] })
  })
})
