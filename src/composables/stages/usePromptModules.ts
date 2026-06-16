import { applyModule } from './promptModules/applyModule'
import { builtinModules } from './promptModules/builtins'
import { hasToken } from './promptModules/text'
import type { PromptModule } from './promptModules/types'

export interface PanelGroup {
  key: string
  modules: PromptModule[]
}

export function panelGroups(modules: PromptModule[]): PanelGroup[] {
  const order: string[] = []
  const map = new Map<string, PromptModule[]>()
  for (const m of modules) {
    if (!m.surfaces.includes('panel')) continue
    const g = m.group ?? ''
    if (!map.has(g)) {
      map.set(g, [])
      order.push(g)
    }
    map.get(g)!.push(m)
  }
  return order.map(key => ({ key, modules: map.get(key)! }))
}

export function usePromptModules(
  getText: () => string,
  setText: (text: string) => void,
) {
  const modules = builtinModules()

  function apply(m: PromptModule, params?: Record<string, string>): void {
    if (m.apply === 'insert' || m.resolveAt === 'run') return
    setText(applyModule(m, { currentPrompt: getText(), params }))
  }

  function isActive(m: PromptModule): boolean {
    return m.apply === 'toggle' && hasToken(getText(), m.body)
  }

  return {
    modules,
    groups: panelGroups(modules),
    apply,
    isActive,
  }
}
