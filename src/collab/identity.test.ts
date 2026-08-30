import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api', () => ({ apiFetch: vi.fn() }))

// Node's builtin (non-functional) localStorage shadows happy-dom's; install a
// working stub before the module under test touches it.
const backing = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => { backing.set(k, String(v)) },
  removeItem: (k: string) => { backing.delete(k) },
  clear: () => { backing.clear() },
}

import { colorForSid, hashToInt, loadName, randomName, saveName } from './identity'

describe('colorForSid', () => {
  it('is deterministic and hue-quantized', () => {
    expect(colorForSid('abc')).toBe(colorForSid('abc'))
    const m = colorForSid('abc').match(/^hsl\((\d+), 80%, 62%\)$/)
    expect(m).not.toBeNull()
    expect(Number(m![1]) % 10).toBe(0)
    expect(Number(m![1])).toBeLessThanOrEqual(360)
  })

  it('differs across typical sids', () => {
    const hues = new Set(['a1', 'b2', 'c3', 'd4', 'e5'].map(colorForSid))
    expect(hues.size).toBeGreaterThan(1)
  })
})

describe('hashToInt', () => {
  it('is non-negative', () => {
    for (const s of ['', 'x', 'longer-string', '中文']) {
      expect(hashToInt(s)).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('names', () => {
  beforeEach(() => localStorage.clear())

  it('randomName yields two words', () => {
    expect(randomName().split(' ')).toHaveLength(2)
  })

  it('loadName generates once then persists', () => {
    const first = loadName()
    expect(first.length).toBeGreaterThan(0)
    expect(loadName()).toBe(first)
  })

  it('saveName trims and caps at 40 chars', () => {
    saveName(`  ${'x'.repeat(60)}  `)
    expect(loadName()).toBe('x'.repeat(40))
  })
})
