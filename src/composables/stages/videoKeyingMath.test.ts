import { describe, expect, it } from 'vitest'
import fixtures from './videoKeyingMath.fixtures.json'
import {
  applyColorSuppress,
  applyDespill,
  applyKeyer,
  applyPik,
  deriveKeyer,
  derivePik,
  keyingLuma,
  parseKeyColor,
  type ColorSuppressParams,
  type DespillParams,
  type KeyerParams,
  type PikParams,
  type Rgb,
} from './videoKeyingMath'

const TOL = 1e-4
const INPUT = fixtures.input as Rgb[]

function despillParams(raw: Record<string, unknown>): Partial<DespillParams> {
  return {
    screen: raw.screen as string,
    spillMix: raw.spill_mix as number | undefined,
    expand: raw.expand as number | undefined,
    redScale: raw.red_scale as number | undefined,
    greenScale: raw.green_scale as number | undefined,
    blueScale: raw.blue_scale as number | undefined,
    brightness: raw.brightness as number | undefined,
    clampBlack: raw.clamp_black as boolean | undefined,
    clampWhite: raw.clamp_white as boolean | undefined,
    outputSpillmap: raw.output_spillmap as boolean | undefined,
  }
}

function suppressParams(
  raw: Record<string, unknown>,
): Partial<ColorSuppressParams> {
  return {
    red: raw.red as number | undefined,
    green: raw.green as number | undefined,
    blue: raw.blue as number | undefined,
    cyan: raw.cyan as number | undefined,
    magenta: raw.magenta as number | undefined,
    yellow: raw.yellow as number | undefined,
    preserveLuma: raw.preserve_luma as boolean | undefined,
    luminanceMath: raw.luminance_math as string | undefined,
    output: raw.output as string | undefined,
  }
}

function keyerParams(raw: Record<string, unknown>): Partial<KeyerParams> {
  return {
    mode: raw.mode as string | undefined,
    keyColor: raw.key_color as string | undefined,
    luminanceMath: raw.luminance_math as string | undefined,
    softnessLower: raw.softness_lower as number | undefined,
    toleranceLower: raw.tolerance_lower as number | undefined,
    center: raw.center as number | undefined,
    toleranceUpper: raw.tolerance_upper as number | undefined,
    softnessUpper: raw.softness_upper as number | undefined,
    despill: raw.despill as number | undefined,
    despillAngle: raw.despill_angle as number | undefined,
  }
}

function pikParams(raw: Record<string, unknown>): Partial<PikParams> {
  return {
    screen: raw.screen as string | undefined,
    pickColor: raw.pick_color as string | undefined,
    redWeight: raw.red_weight as number | undefined,
    blueGreenWeight: raw.blue_green_weight as number | undefined,
    alphaBias: raw.alpha_bias as string | undefined,
    despillBias: raw.despill_bias as string | undefined,
    useAlphaBias: raw.use_alpha_bias_for_despill as boolean | undefined,
    screenSubtraction: raw.screen_subtraction as boolean | undefined,
    clampAlpha: raw.clamp_alpha as boolean | undefined,
    clipBlack: raw.clip_black as number | undefined,
    clipWhite: raw.clip_white as number | undefined,
    replaceMode: raw.replace_mode as string | undefined,
    replaceColor: raw.replace_color as string | undefined,
  }
}

function expectClose(
  got: number[],
  want: number[],
  label: string,
): void {
  for (let ch = 0; ch < want.length; ch++) {
    expect(Math.abs(got[ch] - want[ch]),
      `${label} ch ${ch}: got=${got[ch]} want=${want[ch]}`)
      .toBeLessThan(TOL)
  }
}

describe('applyDespill fixtures', () => {
  fixtures.despill.forEach((c, i) => {
    it(`set ${i} (${JSON.stringify(c.params)})`, () => {
      const p = despillParams(c.params)
      INPUT.forEach((rgb, j) => {
        expectClose(applyDespill(rgb, p), c.expected[j],
          `set ${i} px ${j} in=${JSON.stringify(rgb)}`)
      })
    })
  })
})

describe('applyColorSuppress fixtures', () => {
  fixtures.suppress.forEach((c, i) => {
    it(`set ${i} (${JSON.stringify(c.params)})`, () => {
      const p = suppressParams(c.params)
      INPUT.forEach((rgb, j) => {
        expectClose(applyColorSuppress(rgb, p), c.expected[j],
          `set ${i} px ${j} in=${JSON.stringify(rgb)}`)
      })
    })
  })
})

describe('applyKeyer fixtures', () => {
  fixtures.keyer.forEach((c, i) => {
    it(`set ${i} (${JSON.stringify(c.params)})`, () => {
      const d = deriveKeyer(keyerParams(c.params))
      INPUT.forEach((rgb, j) => {
        expectClose(applyKeyer(rgb, d), c.expected[j],
          `set ${i} px ${j} in=${JSON.stringify(rgb)}`)
      })
    })
  })
})

describe('applyPik fixtures', () => {
  fixtures.pik.forEach((c, i) => {
    it(`set ${i} (${JSON.stringify(c.params)})`, () => {
      const d = derivePik(pikParams(c.params))
      INPUT.forEach((rgb, j) => {
        expectClose(applyPik(rgb, d), c.expected[j],
          `set ${i} px ${j} in=${JSON.stringify(rgb)}`)
      })
    })
  })
})

describe('parseKeyColor', () => {
  it('parses hex and falls back on junk', () => {
    expect(parseKeyColor('#00FF00', [0, 0, 0])).toEqual([0, 1, 0])
    expect(parseKeyColor('00ff00', [0, 0, 0])).toEqual([0, 1, 0])
    expect(parseKeyColor('', [0.5, 0.5, 0.5])).toEqual([0.5, 0.5, 0.5])
    expect(parseKeyColor('#12345', [0, 0, 0])).toEqual([0, 0, 0])
    expect(parseKeyColor('#zzzzzz', [0, 0, 0])).toEqual([0, 0, 0])
  })
})

describe('keyingLuma', () => {
  it('supports weighted, average and max modes', () => {
    expect(keyingLuma([1, 1, 1])).toBeCloseTo(1, 6)
    expect(keyingLuma([0.3, 0.6, 0.9], 'average')).toBeCloseTo(0.6, 6)
    expect(keyingLuma([0.3, 0.6, 0.9], 'max')).toBeCloseTo(0.9, 6)
    expect(keyingLuma([1, 0, 0], 'rec2020')).toBeCloseTo(0.2627, 6)
    expect(keyingLuma([1, 0, 0], 'bogus')).toBeCloseTo(0.2126, 6)
  })
})

describe('derivePik screen kinds', () => {
  it('resolves pick color to green or blue', () => {
    expect(derivePik({ screen: 'pick', pickColor: '#30C060' }).screenKind)
      .toBe('green')
    expect(derivePik({ screen: 'pick', pickColor: '#3060C0' }).screenKind)
      .toBe('blue')
    expect(derivePik({ screen: 'blue' }).screenKind).toBe('blue')
  })
})
