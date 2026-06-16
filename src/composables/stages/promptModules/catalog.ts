import type { Entry } from '@/api/schemas'

import { builtinModules } from './builtins'
import type { ModuleSurface, PromptModule } from './types'
import { userSnippetModules } from './userModules'

export function getAllModules(entries: Entry[] = []): PromptModule[] {
  return [...builtinModules(), ...userSnippetModules(entries)]
}

export function modulesForSurface(surface: ModuleSurface, entries: Entry[] = []): PromptModule[] {
  return getAllModules(entries).filter(m => m.surfaces.includes(surface))
}
