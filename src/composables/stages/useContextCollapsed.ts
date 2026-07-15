import { computed } from 'vue'
import { useStorage } from '@vueuse/core'

function makeCollapsed(storageKey: string) {
  const expanded = useStorage<string[]>(storageKey, [])
  return (getNodeId: () => string | number | null | undefined) =>
    computed<boolean>({
      get() {
        const id = getNodeId()
        if (id == null) return true
        return !expanded.value.includes(String(id))
      },
      set(collapsed: boolean) {
        const id = getNodeId()
        if (id == null) return
        const key = String(id)
        const has = expanded.value.includes(key)
        if (collapsed && has) expanded.value = expanded.value.filter(x => x !== key)
        else if (!collapsed && !has) expanded.value = [...expanded.value, key]
      },
    })
}

export const useContextCollapsed = makeCollapsed('comfytv:stage:context-expanded')
export const useActionsCollapsed = makeCollapsed('comfytv:stage:actions-expanded')
