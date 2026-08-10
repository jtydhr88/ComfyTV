import { describe, expect, it } from 'vitest'

import {
  channelStops,
  interpolateStops,
  stopsToGradient,
  CHANNEL_STOPS,
  CONTRAST_STOPS,
  GAMMA_STOPS,
  HUE_STOPS,
  LUMA_STOPS,
  TEMP_KELVIN_STOPS,
  TEMP_STOPS,
  type ColorStop,
} from './colorStops'

describe('stop presets', () => {
  it('span 0..1 in ascending offsets', () => {
    for (const stops of [LUMA_STOPS, GAMMA_STOPS, CONTRAST_STOPS, HUE_STOPS,
                         TEMP_STOPS, TEMP_KELVIN_STOPS]) {
      expect(stops[0].offset).toBe(0)
      expect(stops[stops.length - 1].offset).toBe(1)
    }
  })

  it('kelvin ramp is the reverse of the temp ramp', () => {
    expect(TEMP_KELVIN_STOPS[0].color).toEqual(TEMP_STOPS[2].color)
    expect(TEMP_KELVIN_STOPS[2].color).toEqual(TEMP_STOPS[0].color)
  })
})

describe('channelStops', () => {
  it('resolves channel names directly', () => {
    expect(channelStops('red')).toBe(CHANNEL_STOPS.red)
    expect(channelStops('neutral')).toBe(CHANNEL_STOPS.neutral)
  })

  it('strips a trailing plural s', () => {
    expect(channelStops('blues')).toBe(CHANNEL_STOPS.blue)
    expect(channelStops('magentas')).toBe(CHANNEL_STOPS.magenta)
  })

  it('falls back to the luma ramp for unknown names', () => {
    expect(channelStops('bogus')).toBe(LUMA_STOPS)
    expect(channelStops('')).toBe(LUMA_STOPS)
  })
})

describe('stopsToGradient', () => {
  it('renders a css linear gradient with percent offsets', () => {
    expect(stopsToGradient(LUMA_STOPS))
      .toBe('linear-gradient(to right, rgb(0,0,0) 0%, rgb(255,255,255) 100%)')
  })

  it('renders intermediate stops', () => {
    expect(stopsToGradient(GAMMA_STOPS)).toBe(
      'linear-gradient(to right, rgb(0,0,0) 0%, rgb(128,128,128) 50%, rgb(255,255,255) 100%)')
  })

  it('is transparent for an empty list', () => {
    expect(stopsToGradient([])).toBe('transparent')
  })
})

describe('interpolateStops', () => {
  const stops: ColorStop[] = [
    { offset: 0.2, color: [0, 0, 0] },
    { offset: 0.8, color: [255, 100, 0] },
  ]

  it('is transparent for an empty list', () => {
    expect(interpolateStops([], 0.5)).toBe('transparent')
  })

  it('returns the first color at or below the first offset', () => {
    expect(interpolateStops(stops, 0.2)).toBe('rgb(0,0,0)')
    expect(interpolateStops(stops, 0)).toBe('rgb(0,0,0)')
    expect(interpolateStops(stops, -3)).toBe('rgb(0,0,0)')
  })

  it('returns the last color at or beyond the last offset', () => {
    expect(interpolateStops(stops, 0.9)).toBe('rgb(255,100,0)')
    expect(interpolateStops(stops, 1)).toBe('rgb(255,100,0)')
    expect(interpolateStops(stops, 42)).toBe('rgb(255,100,0)')
  })

  it('linearly blends and rounds between neighboring stops', () => {
    expect(interpolateStops(stops, 0.5)).toBe('rgb(127,50,0)')
    expect(interpolateStops(LUMA_STOPS, 0.25)).toBe('rgb(64,64,64)')
  })

  it('picks the correct segment in a multi-stop ramp', () => {
    expect(interpolateStops(GAMMA_STOPS, 0.75)).toBe('rgb(192,192,192)')
    expect(interpolateStops(HUE_STOPS, 1 / 6)).toBe('rgb(255,255,0)')
  })

  it('clamps t into the unit range before sampling', () => {
    expect(interpolateStops(LUMA_STOPS, 2)).toBe('rgb(255,255,255)')
    expect(interpolateStops(LUMA_STOPS, -1)).toBe('rgb(0,0,0)')
  })
})
