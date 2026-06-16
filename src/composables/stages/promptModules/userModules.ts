import type { Entry } from '@/api/schemas'

import type { PromptModule } from './types'

export function userSnippetModules(entries: Entry[]): PromptModule[] {
  return entries.map((e): PromptModule => ({
    id: `snippet:${e.id}`,
    source: 'user',
    kind: 'snippet',
    label: e.label,
    body: e.content,
    apply: 'insert',
    resolveAt: 'run',
    surfaces: ['mention'],
  }))
}
