import { describe, expect, it } from 'vitest'

import type { Entry } from '@/api/schemas'

import { BUILTIN_MODULES } from './builtins'
import { getAllModules, modulesForSurface } from './catalog'
import { userSnippetModules } from './userModules'

function entry(id: number, label: string, content: string): Entry {
  return { id, label, content, kind: 'fragment', metadata: {} }
}

const ENTRIES = [entry(1, 'hero', 'a brave knight'), entry(2, 'villain', 'a shadow lord')]

describe('userSnippetModules', () => {
  it('adapts entries into run-time snippet modules on the mention surface', () => {
    const mods = userSnippetModules(ENTRIES)
    expect(mods).toHaveLength(2)
    const m = mods[0]
    expect(m).toMatchObject({
      id: 'snippet:1',
      source: 'user',
      kind: 'snippet',
      label: 'hero',
      body: 'a brave knight',
      apply: 'insert',
      resolveAt: 'run',
      surfaces: ['mention'],
    })
  })

  it('returns nothing for no entries', () => {
    expect(userSnippetModules([])).toEqual([])
  })
})

describe('getAllModules', () => {
  it('merges built-ins with user snippets', () => {
    const all = getAllModules(ENTRIES)
    expect(all.length).toBe(BUILTIN_MODULES.length + ENTRIES.length)
  })

  it('is just the built-ins when there are no entries', () => {
    expect(getAllModules().length).toBe(BUILTIN_MODULES.length)
  })
})

describe('modulesForSurface', () => {
  it('mention surface returns only user snippets (no built-ins live there)', () => {
    const mention = modulesForSurface('mention', ENTRIES)
    expect(mention.map(m => m.id)).toEqual(['snippet:1', 'snippet:2'])
  })

  it('panel surface returns built-ins, never snippets', () => {
    const panel = modulesForSurface('panel', ENTRIES)
    expect(panel.length).toBeGreaterThan(0)
    expect(panel.every(m => m.kind !== 'snippet')).toBe(true)
  })

  it('builder surface returns the camera builder', () => {
    const builder = modulesForSurface('builder', ENTRIES)
    expect(builder.map(m => m.id)).toContain('builder:camera')
  })
})
