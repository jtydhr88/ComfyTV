import { describe, expect, it } from 'vitest'

import { GM_DRUMS, GM_NAMES, GM_PROGRAM_NUMBERS, gmNameForProgram } from './gmPrograms'

describe('gmPrograms', () => {
  it('maps every GM name to a unique program number', () => {
    for (const name of GM_NAMES) {
      expect(GM_PROGRAM_NUMBERS[name]).toBeTypeOf('number')
    }
    const nums = Object.values(GM_PROGRAM_NUMBERS)
    expect(new Set(nums).size).toBe(nums.length)
    expect(Object.keys(GM_PROGRAM_NUMBERS).sort()).toEqual([...GM_NAMES].sort())
  })

  it('keeps program numbers inside the MIDI range', () => {
    for (const num of Object.values(GM_PROGRAM_NUMBERS)) {
      expect(num).toBeGreaterThanOrEqual(0)
      expect(num).toBeLessThanOrEqual(127)
    }
  })

  it('gmNameForProgram inverts the program mapping', () => {
    expect(gmNameForProgram(0)).toBe('piano')
    expect(gmNameForProgram(89)).toBe('warm_pad')
    for (const [name, num] of Object.entries(GM_PROGRAM_NUMBERS)) {
      expect(gmNameForProgram(num)).toBe(name)
    }
  })

  it('gmNameForProgram returns null for unmapped programs', () => {
    expect(gmNameForProgram(2)).toBeNull()
    expect(gmNameForProgram(127)).toBeNull()
    expect(gmNameForProgram(-1)).toBeNull()
  })

  it('names drum notes inside the GM percussion range', () => {
    expect(GM_DRUMS[36]).toBe('Kick')
    expect(GM_DRUMS[38]).toBe('Snare')
    for (const key of Object.keys(GM_DRUMS)) {
      const note = Number(key)
      expect(note).toBeGreaterThanOrEqual(35)
      expect(note).toBeLessThanOrEqual(81)
      expect(GM_DRUMS[note]).toBeTruthy()
    }
  })
})
