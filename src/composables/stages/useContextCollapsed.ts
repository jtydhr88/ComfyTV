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

function makeCollapsedDefaultExpanded(storageKey: string) {
  const collapsed = useStorage<string[]>(storageKey, [])
  return (getNodeId: () => string | number | null | undefined) =>
    computed<boolean>({
      get() {
        const id = getNodeId()
        if (id == null) return false
        return collapsed.value.includes(String(id))
      },
      set(value: boolean) {
        const id = getNodeId()
        if (id == null) return
        const key = String(id)
        const has = collapsed.value.includes(key)
        if (value && !has) collapsed.value = [...collapsed.value, key]
        else if (!value && has) collapsed.value = collapsed.value.filter(x => x !== key)
      },
    })
}

export const useContextCollapsed = makeCollapsed('comfytv:stage:context-expanded')
export const useActionsCollapsed = makeCollapsed('comfytv:stage:actions-expanded')
export const useTextOutputCollapsed = makeCollapsed('comfytv:stage:text-output-expanded')
export const useVideoOutputCollapsed = makeCollapsedDefaultExpanded('comfytv:stage:video-output-collapsed')
