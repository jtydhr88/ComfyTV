import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

import { getStageMeta } from '@/composables/stages/stageMeta'

interface SelectedStage {
  nodeId: string | number
  comfyClass: string
  workflowKind: string
  workflowLabel: string
}

export const useSelectionStore = defineStore('comfytv-selection', () => {
  const selected = ref<SelectedStage | null>(null)

  const selectedKey = computed(() =>
    selected.value
      ? `${selected.value.workflowKind}::${selected.value.workflowLabel}`
      : null,
  )

  const bindingsVersion = ref(0)
  function bumpBindings() { bindingsVersion.value++ }

  function refreshFromCanvas() {
    const app = (window as any).app
    const selectedNodes: any = app?.canvas?.selected_nodes
    let nodes: any[] = []
    if (selectedNodes) {
      if (typeof selectedNodes[Symbol.iterator] === 'function') {
        nodes = Array.from(selectedNodes as Iterable<any>)
      } else {
        nodes = Object.values(selectedNodes)
      }
    }
    if (nodes.length !== 1) {
      if (selected.value !== null) selected.value = null
      return
    }
    const node = nodes[0]
    const cls  = String(node?.comfyClass ?? '')
    const meta = getStageMeta(cls)
    if (!meta || !meta.workflow_kind) {
      if (selected.value !== null) selected.value = null
      return
    }
    const wfWidget = (node.widgets ?? []).find((w: any) => w.name === 'workflow')
    const label = wfWidget ? String(wfWidget.value ?? '') : ''
    const next: SelectedStage = {
      nodeId:        node.id,
      comfyClass:    cls,
      workflowKind:  meta.workflow_kind,
      workflowLabel: label,
    }
    const cur = selected.value
    if (
      !cur ||
      cur.nodeId       !== next.nodeId ||
      cur.comfyClass   !== next.comfyClass ||
      cur.workflowKind !== next.workflowKind ||
      cur.workflowLabel !== next.workflowLabel
    ) {
      selected.value = next
    }
  }

  return { selected, selectedKey, bindingsVersion, bumpBindings, refreshFromCanvas }
})
