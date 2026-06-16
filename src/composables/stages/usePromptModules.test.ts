import { describe, expect, it } from 'vitest'

import { BUILTIN_MODULES } from './promptModules/builtins'
import type { PromptModule } from './promptModules/types'
import { panelGroups, usePromptModules } from './usePromptModules'

function mod(p: Partial<PromptModule> & Pick<PromptModule, 'id' | 'kind' | 'apply'>): PromptModule {
  return { source: 'builtin', body: '', resolveAt: 'edit', surfaces: ['panel'], ...p }
}

describe('panelGroups', () => {
  it('groups panel modules by `group`, preserving first-seen order', () => {
    const mods = [
      mod({ id: 'a', kind: 'template', apply: 'wrap', group: 'g1' }),
      mod({ id: 'b', kind: 'tag', apply: 'toggle', group: 'g2' }),
      mod({ id: 'c', kind: 'tag', apply: 'toggle', group: 'g1' }),
    ]
    const groups = panelGroups(mods)
    expect(groups.map(g => g.key)).toEqual(['g1', 'g2'])
    expect(groups[0].modules.map(m => m.id)).toEqual(['a', 'c'])
  })

  it('excludes modules not on the panel surface', () => {
    const mods = [
      mod({ id: 'a', kind: 'tag', apply: 'toggle', group: 'g1' }),
      mod({ id: 'x', kind: 'snippet', apply: 'insert', resolveAt: 'run', surfaces: ['mention'], group: 'g1' }),
    ]
    expect(panelGroups(mods)[0].modules.map(m => m.id)).toEqual(['a'])
  })

  it('lays out the built-in catalog as templates → quick → enhance', () => {
    const groups = panelGroups(BUILTIN_MODULES)
    expect(groups[0].key).toBe('promptHelper.templates')
    expect(groups[1].key).toBe('promptHelper.quickStart')
    expect(groups[2].key).toBe('promptHelper.category.quality')
  })
})

describe('usePromptModules', () => {
  it('exposes the builtin catalog grouped for the panel', () => {
    const m = usePromptModules(() => '', () => {})
    expect(m.modules.length).toBe(BUILTIN_MODULES.length)
    expect(m.groups.length).toBeGreaterThan(0)
  })

  it('apply toggles a tag in and out of the live text', () => {
    let text = 'a cat'
    const m = usePromptModules(() => text, t => { text = t })
    const tag = mod({ id: 't', kind: 'tag', apply: 'toggle', body: 'neon glow' })
    m.apply(tag)
    expect(text).toBe('a cat, neon glow')
    m.apply(tag)
    expect(text).toBe('a cat')
  })

  it('apply wraps the live prompt into a template {subject}', () => {
    let text = 'a knight'
    const m = usePromptModules(() => text, t => { text = t })
    m.apply(mod({ id: 'w', kind: 'template', apply: 'wrap', body: 'SCENE: {subject}. END' }))
    expect(text).toBe('SCENE: a knight. END')
  })

  it('apply is a no-op for run-time / caret-insert modules', () => {
    let text = 'a cat'
    const m = usePromptModules(() => text, t => { text = t })
    m.apply(mod({ id: 's', kind: 'snippet', apply: 'insert', resolveAt: 'run', body: '@hero' }))
    expect(text).toBe('a cat')
  })

  it('isActive reflects toggle membership only', () => {
    const text = 'a cat, neon glow'
    const m = usePromptModules(() => text, () => {})
    expect(m.isActive(mod({ id: 't', kind: 'tag', apply: 'toggle', body: 'neon glow' }))).toBe(true)
    expect(m.isActive(mod({ id: 't', kind: 'tag', apply: 'toggle', body: 'absent' }))).toBe(false)
    expect(m.isActive(mod({ id: 'w', kind: 'template', apply: 'wrap', body: 'neon glow' }))).toBe(false)
  })
})
