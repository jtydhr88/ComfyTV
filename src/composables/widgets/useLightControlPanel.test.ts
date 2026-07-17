import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'

import { createDefaultLight } from '@/widgets/three/light/types'
import {
  parseLightNumber,
  selectedLightAt,
  transformModeOptions,
  useLightControlPanel,
} from './useLightControlPanel'

describe('selectedLightAt', () => {
  it('returns the light at the index or null when out of range', () => {
    const lights = [createDefaultLight('directional'), createDefaultLight('point')]
    expect(selectedLightAt(lights, 1)).toBe(lights[1])
    expect(selectedLightAt(lights, 2)).toBeNull()
    expect(selectedLightAt([], 0)).toBeNull()
  })
})

describe('transformModeOptions', () => {
  it('only enables none when nothing is selected', () => {
    expect(transformModeOptions(null)).toEqual([
      { value: 'none', labelKey: 'lightBall.transformNone', enabled: true },
      { value: 'light-position', labelKey: 'lightBall.transformPosition', enabled: false },
      { value: 'target', labelKey: 'lightBall.transformTarget', enabled: false },
    ])
  })

  it('enables target but not position for directional lights', () => {
    const opts = transformModeOptions(createDefaultLight('directional'))
    expect(opts.map((o) => o.enabled)).toEqual([true, false, true])
  })

  it('enables position but not target for point lights', () => {
    const opts = transformModeOptions(createDefaultLight('point'))
    expect(opts.map((o) => o.enabled)).toEqual([true, true, false])
  })

  it('enables both for spot lights', () => {
    const opts = transformModeOptions(createDefaultLight('spot'))
    expect(opts.map((o) => o.enabled)).toEqual([true, true, true])
  })
})

describe('parseLightNumber', () => {
  it('parses finite numbers and rejects the rest', () => {
    expect(parseLightNumber('1.5')).toBe(1.5)
    expect(parseLightNumber('0')).toBe(0)
    expect(parseLightNumber('')).toBe(0)
    expect(parseLightNumber('abc')).toBeNull()
    expect(parseLightNumber('Infinity')).toBeNull()
  })
})

describe('useLightControlPanel', () => {
  it('tracks the selected light and its transform options reactively', () => {
    const props = reactive({
      lights: [createDefaultLight('directional'), createDefaultLight('point')],
      selectedIndex: 0,
    })
    const { selectedLight, transformOptions } = useLightControlPanel(props)
    expect(selectedLight.value?.type).toBe('directional')
    expect(transformOptions.value[1].enabled).toBe(false)

    props.selectedIndex = 1
    expect(selectedLight.value?.type).toBe('point')
    expect(transformOptions.value[1].enabled).toBe(true)

    props.selectedIndex = 5
    expect(selectedLight.value).toBeNull()
  })
})
