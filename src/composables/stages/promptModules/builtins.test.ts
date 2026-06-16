import { describe, expect, it } from 'vitest'

import { ENHANCE_TAGS, QUICK_PROMPTS } from '../promptHelperCatalog'
import { PROMPT_TEMPLATES } from '../promptTemplateCatalog'
import { applyModule } from './applyModule'
import { BUILTIN_MODULES, QUICK_GROUP, TEMPLATE_GROUP } from './builtins'

const byKind = (k: string) => BUILTIN_MODULES.filter(m => m.kind === k)

describe('BUILTIN_MODULES shape', () => {
  it('covers every shipped catalog entry exactly once', () => {
    const tagCount = QUICK_PROMPTS.length + ENHANCE_TAGS.reduce((n, c) => n + c.tags.length, 0)
    expect(byKind('tag').length).toBe(tagCount)
    expect(byKind('template').length).toBe(PROMPT_TEMPLATES.length)
  })

  it('gives every module a unique id', () => {
    const ids = BUILTIN_MODULES.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('marks everything builtin, edit-time, with at least one surface', () => {
    for (const m of BUILTIN_MODULES) {
      expect(m.source).toBe('builtin')
      expect(m.resolveAt).toBe('edit')
      expect(m.surfaces.length).toBeGreaterThan(0)
      expect(typeof m.body).toBe('string')
    }
  })
})

describe('built-in tags', () => {
  it('are all toggle modules', () => {
    for (const m of byKind('tag')) expect(m.apply).toBe('toggle')
  })

  it('put quick-starters and enhance tags in distinct groups', () => {
    const quick = byKind('tag').filter(m => m.group === QUICK_GROUP)
    expect(quick.length).toBe(QUICK_PROMPTS.length)
    for (const cat of ENHANCE_TAGS) {
      const inCat = byKind('tag').filter(m => m.group === cat.categoryKey)
      expect(inCat.length).toBe(cat.tags.length)
    }
  })
})

describe('built-in templates', () => {
  it('use wrap when a {subject} slot is present, append otherwise', () => {
    for (const m of byKind('template')) {
      expect(m.group).toBe(TEMPLATE_GROUP)
      if (m.body.includes('{subject}')) {
        expect(m.apply).toBe('wrap')
      } else {
        expect(m.apply).toBe('append')
        expect(m.separator).toBe('\n\n')
      }
    }
  })

  it('fold the live prompt into a {subject} template when applied', () => {
    const wrap = byKind('template').find(m => m.apply === 'wrap')
    expect(wrap).toBeDefined()
    const out = applyModule(wrap!, { currentPrompt: 'a lone astronaut' })
    expect(out).toContain('a lone astronaut')
    expect(out).not.toContain('{subject}')
  })
})
