import { type Ref, ref, watch } from 'vue'

const NODES_PREFIX = 'comfytv:sidebar:collapsed:'

export function useCollapsedNodeIds(workflowId: Ref<number | null | undefined>) {
  const collapsed = ref<Set<string>>(new Set())

  function load(wid: number) {
    try {
      const raw = localStorage.getItem(NODES_PREFIX + wid)
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) {
          collapsed.value = new Set(arr.map(String))
          return
        }
      }
    } catch {}
    collapsed.value = new Set()
  }

  function save(wid: number) {
    try {
      localStorage.setItem(
        NODES_PREFIX + wid,
        JSON.stringify(Array.from(collapsed.value)),
      )
    } catch {}
  }

  watch(workflowId, (wid) => { if (wid != null) load(wid) })

  function isCollapsed(nodeId: string): boolean {
    return collapsed.value.has(nodeId)
  }

  function toggle(nodeId: string) {
    if (collapsed.value.has(nodeId)) collapsed.value.delete(nodeId)
    else collapsed.value.add(nodeId)
    collapsed.value = new Set(collapsed.value)
    if (workflowId.value != null) save(workflowId.value)
  }

  return { isCollapsed, toggle }
}

export function useCollapsedFlag(
  workflowId: Ref<number | null | undefined>,
  keyPrefix: string,
  defaultValue = false,
) {
  const collapsed = ref(defaultValue)

  function load(wid: number) {
    try {
      const raw = localStorage.getItem(keyPrefix + wid)
      collapsed.value = raw === '1' ? true : raw === '0' ? false : defaultValue
    } catch {
      collapsed.value = defaultValue
    }
  }

  watch(workflowId, (wid) => { if (wid != null) load(wid) })

  function toggle() {
    collapsed.value = !collapsed.value
    const wid = workflowId.value
    if (wid != null) {
      try { localStorage.setItem(keyPrefix + wid, collapsed.value ? '1' : '0') } catch {}
    }
  }

  return { collapsed, toggle }
}
