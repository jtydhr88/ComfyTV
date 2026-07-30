import { describe, it, expect } from 'vitest'
import { buildPianoKeys, blackRowsGradient } from './pianoRollView'

describe('buildPianoKeys', () => {
  it('returns 128 keys top-down with correct y', () => {
    const keys = buildPianoKeys(10, false)
    expect(keys).toHaveLength(128)
    expect(keys[0].midi).toBe(127)
    expect(keys[127].midi).toBe(0)
    expect(keys[0].y).toBe(0)
    expect(keys[127].y).toBe(1270)
  })

  it('pitched mode: black keys and C labels', () => {
    const keys = buildPianoKeys(10, false)
    const c4 = keys.find((k) => k.midi === 60)!
    expect(c4.label).toBe('C4')
    expect(c4.black).toBe(false)
    expect(keys.find((k) => k.midi === 61)!.black).toBe(true) // C#4
  })

  it('percussion mode: labels from GM drum map, non-drum rows marked black', () => {
    const keys = buildPianoKeys(10, true)
    expect(keys.find((k) => k.midi === 36)!.label).toBe('Kick')
    expect(keys.find((k) => k.midi === 38)!.label).toBe('Snare')
    expect(keys.find((k) => k.midi === 36)!.black).toBe(false)
    const noDrum = keys.find((k) => k.midi === 100)!
    expect(noDrum.black).toBe(true)
    expect(noDrum.label).toBe('')
  })
})

describe('blackRowsGradient', () => {
  it('builds a repeating gradient over 12 rows scaled by note height', () => {
    const g = blackRowsGradient(10)
    expect(g.startsWith('repeating-linear-gradient(to bottom, ')).toBe(true)
    expect(g).toContain('0px 10px')
    expect(g).toContain('110px 120px')
    expect(g).toContain('rgba(0,0,0,0.28)')
  })
})
