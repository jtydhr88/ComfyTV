import { describe, it, expect } from 'vitest'
import fixture from './videoLutMath.fixtures.json'
import {
  PREVIEWABLE_LUT_EXTENSIONS,
  applyLut,
  isPreviewableLutFile,
  lutFileExtension,
  parse3dlLut,
  parseCubeLut,
  parseLutText,
  resolvePreviewInterp,
} from './videoLutMath'

interface FixtureCase {
  id: string
  lut: string
  interp: string
  expected: number[]
}

const luts = fixture.luts as Record<string, string>
const cases = fixture.cases as FixtureCase[]

const TOLERANCE = 1

describe('applyLut matches FFmpeg vf_lut3d reference output', () => {
  it('fixture covers identity, all interps, DOMAIN scaling, and .3dl', () => {
    const ids = cases.map((c) => c.id)
    expect(ids).toContain('test17_cube_nearest')
    expect(ids).toContain('test17_cube_trilinear')
    expect(ids).toContain('test17_cube_tetrahedral')
    expect(ids).toContain('identity17_cube_tetrahedral')
    expect(ids).toContain('domain8_cube_tetrahedral')
    expect(ids).toContain('test_3dl_tetrahedral')
  })

  for (const c of cases) {
    it(`stays within ${TOLERANCE}/255 of FFmpeg: ${c.id}`, () => {
      const lut = parseLutText(c.lut, luts[c.lut])
      expect(lut).not.toBeNull()
      const input = fixture.input as number[]
      let maxErr = 0
      for (let i = 0; i < input.length; i += 3) {
        const got = applyLut([input[i], input[i + 1], input[i + 2]], lut!, c.interp)
        for (let ch = 0; ch < 3; ch++) {
          maxErr = Math.max(maxErr, Math.abs(got[ch] - c.expected[i + ch]))
        }
      }
      expect(maxErr).toBeLessThanOrEqual(TOLERANCE)
    })
  }
})

describe('parseCubeLut', () => {
  it('parses size, TITLE, and DOMAIN lines after LUT_3D_SIZE', () => {
    const lut = parseCubeLut(luts['domain8.cube'])
    expect(lut).not.toBeNull()
    expect(lut!.size).toBe(8)
    expect(lut!.data.length).toBe(8 * 8 * 8 * 3)
    expect(lut!.scale[0]).toBeCloseTo(0.5, 6)
    expect(lut!.scale[1]).toBe(1)
    expect(lut!.scale[2]).toBe(1)
  })

  it('defaults scale to 1 without DOMAIN lines', () => {
    const lut = parseCubeLut(luts['test17.cube'])
    expect(lut!.scale).toEqual([1, 1, 1])
  })

  it('stores data red-major, blue-fastest per FFmpeg layout', () => {
    const text = [
      'LUT_3D_SIZE 2',
      '0.0 0.0 0.0', '1.0 0.0 0.0', '0.0 1.0 0.0', '1.0 1.0 0.0',
      '0.0 0.0 1.0', '1.0 0.0 1.0', '0.0 1.0 1.0', '1.0 1.0 1.0',
    ].join('\n')
    const lut = parseCubeLut(text)!
    const at = (r: number, g: number, b: number) => {
      const base = (r * 4 + g * 2 + b) * 3
      return [lut.data[base], lut.data[base + 1], lut.data[base + 2]]
    }
    expect(at(1, 0, 0)).toEqual([1, 0, 0])
    expect(at(0, 1, 0)).toEqual([0, 1, 0])
    expect(at(0, 0, 1)).toEqual([0, 0, 1])
  })

  it('skips comments and blank lines between samples', () => {
    const text = 'LUT_3D_SIZE 2\n# comment\n\n' +
      Array.from({ length: 8 }, () => '0.5 0.5 0.5\n# mid\n').join('')
    const lut = parseCubeLut(text)
    expect(lut).not.toBeNull()
    expect(lut!.data[0]).toBeCloseTo(0.5, 6)
  })

  it('rejects missing size, bad sizes, truncated data, and bad samples', () => {
    expect(parseCubeLut('TITLE "x"\n0 0 0')).toBeNull()
    expect(parseCubeLut('LUT_3D_SIZE 1\n0 0 0')).toBeNull()
    expect(parseCubeLut('LUT_3D_SIZE 300')).toBeNull()
    expect(parseCubeLut('LUT_3D_SIZE 2\n0 0 0\n0 0 0')).toBeNull()
    expect(parseCubeLut('LUT_3D_SIZE 2\n' + 'a b c\n'.repeat(8))).toBeNull()
    expect(parseCubeLut('LUT_3D_SIZE 2\nDOMAIN_MID 0 0 0\n' + '0 0 0\n'.repeat(8)))
      .toBeNull()
  })

  it('ignores DOMAIN lines appearing before LUT_3D_SIZE like FFmpeg', () => {
    const text = 'DOMAIN_MAX 2.0 2.0 2.0\nLUT_3D_SIZE 2\n' + '0 0 0\n'.repeat(8)
    expect(parseCubeLut(text)!.scale).toEqual([1, 1, 1])
  })
})

describe('parse3dlLut', () => {
  it('parses the fixture .3dl with a discarded shaper header', () => {
    const lut = parse3dlLut(luts['test.3dl'])
    expect(lut).not.toBeNull()
    expect(lut!.size).toBe(17)
    expect(lut!.scale).toEqual([1, 1, 1])
  })

  it('stores 3dl data red-slowest matching FFmpeg parse_3dl', () => {
    const threedl = parse3dlLut(luts['test.3dl'])!
    const cube = parseCubeLut(luts['test17.cube'])!
    let maxDiff = 0
    for (let i = 0; i < cube.data.length; i++) {
      maxDiff = Math.max(maxDiff, Math.abs(threedl.data[i] - cube.data[i]))
    }
    expect(maxDiff).toBeLessThanOrEqual(1 / 4096 + 1 / 8192 + 1e-6)
  })

  it('rejects truncated or non-integer files', () => {
    expect(parse3dlLut('0 64 128\n1 2 3')).toBeNull()
    const header = Array.from({ length: 17 }, (_, i) => i * 64).join(' ')
    const bad = header + '\n' + '0.5 1 2\n'.repeat(17 * 17 * 17)
    expect(parse3dlLut(bad)).toBeNull()
  })
})

describe('lut file dispatch', () => {
  it('detects previewable extensions case-insensitively', () => {
    expect(PREVIEWABLE_LUT_EXTENSIONS).toEqual(['.cube', '.3dl'])
    expect(lutFileExtension('A.CUBE')).toBe('.cube')
    expect(isPreviewableLutFile('grade.cube')).toBe(true)
    expect(isPreviewableLutFile('grade.3DL')).toBe(true)
    expect(isPreviewableLutFile('grade.csp')).toBe(false)
    expect(isPreviewableLutFile('grade.m3d')).toBe(false)
    expect(isPreviewableLutFile('grade.dat')).toBe(false)
    expect(isPreviewableLutFile('noext')).toBe(false)
  })

  it('returns null for unsupported formats instead of throwing', () => {
    expect(parseLutText('x.csp', 'anything')).toBeNull()
    expect(parseLutText('x.dat', 'anything')).toBeNull()
    expect(parseLutText('x.m3d', 'anything')).toBeNull()
  })
})

describe('resolvePreviewInterp', () => {
  it('keeps nearest and trilinear, folds pyramid and prism into tetrahedral', () => {
    expect(resolvePreviewInterp('nearest')).toBe('nearest')
    expect(resolvePreviewInterp('trilinear')).toBe('trilinear')
    expect(resolvePreviewInterp('tetrahedral')).toBe('tetrahedral')
    expect(resolvePreviewInterp('pyramid')).toBe('tetrahedral')
    expect(resolvePreviewInterp('prism')).toBe('tetrahedral')
  })
})
