import { ENHANCE_TAGS, QUICK_PROMPTS } from '../promptHelperCatalog'
import { PROMPT_TEMPLATES } from '../promptTemplateCatalog'
import { CAMERA_BUILDER } from './builders'
import type { PromptModule } from './types'

export const QUICK_GROUP = 'promptHelper.quickStart'
export const TEMPLATE_GROUP = 'promptHelper.templates'

function tagSlug(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function quickModules(): PromptModule[] {
  return QUICK_PROMPTS.map((q, i): PromptModule => ({
    id: `quick:${q.labelKey.split('.').pop() ?? i}`,
    source: 'builtin',
    kind: 'tag',
    labelKey: q.labelKey,
    body: q.prompt,
    apply: 'toggle',
    resolveAt: 'edit',
    surfaces: ['panel'],
    group: QUICK_GROUP,
    order: i,
  }))
}

function enhanceModules(): PromptModule[] {
  const out: PromptModule[] = []
  let order = 0
  for (const cat of ENHANCE_TAGS) {
    for (const tag of cat.tags) {
      out.push({
        id: `tag:${tagSlug(tag)}`,
        source: 'builtin',
        kind: 'tag',
        label: tag,
        body: tag,
        apply: 'toggle',
        resolveAt: 'edit',
        surfaces: ['panel'],
        group: cat.categoryKey,
        order: order++,
      })
    }
  }
  return out
}

function templateModules(): PromptModule[] {
  return PROMPT_TEMPLATES.map((t, i): PromptModule => {
    const hasSubject = t.template.includes('{subject}')
    return {
      id: `template:${t.id}`,
      source: 'builtin',
      kind: 'template',
      labelKey: t.labelKey,
      body: t.template,
      apply: hasSubject ? 'wrap' : 'append',
      resolveAt: 'edit',
      surfaces: ['panel'],
      group: TEMPLATE_GROUP,
      separator: hasSubject ? undefined : '\n\n',
      order: i,
    }
  })
}

export const BUILTIN_MODULES: PromptModule[] = [
  ...templateModules(),
  ...quickModules(),
  ...enhanceModules(),
  CAMERA_BUILDER,
]

export function builtinModules(): PromptModule[] {
  return BUILTIN_MODULES
}
