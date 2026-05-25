import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface ExecutionEvent {
  ts: number
  kind: string
  promptId?: string
  label?: string
}

const HISTORY_LIMIT = 30

export const useExecutionStore = defineStore('comfytv-execution', () => {
  const currentNodeId = ref<string | null>(null)
  const queueRemaining = ref(0)
  const currentPromptId = ref<string | null>(null)
  const recentEvents = ref<ExecutionEvent[]>([])

  const isBusy = computed(() => currentNodeId.value != null || queueRemaining.value > 0)

  function pushEvent(ev: Omit<ExecutionEvent, 'ts'>) {
    recentEvents.value = [
      { ...ev, ts: Date.now() },
      ...recentEvents.value,
    ].slice(0, HISTORY_LIMIT)
  }

  function bindToApi(api: any): () => void {
    const onStatus = (e: any) => {
      const info = e?.detail?.status?.exec_info ?? e?.detail?.exec_info
      if (info && typeof info.queue_remaining === 'number') {
        queueRemaining.value = info.queue_remaining
      }
    }
    const onExecutionStart = (e: any) => {
      const d = e?.detail
      currentPromptId.value = d?.prompt_id ?? null
      pushEvent({ kind: 'started', promptId: d?.prompt_id })
    }
    const onExecuting = (e: any) => {
      const d = e?.detail
      const nodeId = d?.display_node ?? d?.node ?? null
      currentNodeId.value = nodeId ? String(nodeId) : null
    }
    const onExecutionSuccess = (e: any) => {
      const d = e?.detail
      currentNodeId.value = null
      pushEvent({ kind: 'finished', promptId: d?.prompt_id })
    }
    const onExecutionError = (e: any) => {
      const d = e?.detail
      currentNodeId.value = null
      pushEvent({
        kind: 'error',
        promptId: d?.prompt_id,
        label: d?.exception_message || 'execution failed',
      })
    }
    const onExecutionInterrupted = (e: any) => {
      const d = e?.detail
      currentNodeId.value = null
      pushEvent({
        kind: 'cancelled',
        promptId: d?.prompt_id,
        label: '已取消',
      })
    }
    const onExecutionCached = (e: any) => {
      const d = e?.detail
      const n = Array.isArray(d?.nodes) ? d.nodes.length : 0
      if (n > 0) pushEvent({ kind: 'cached', promptId: d?.prompt_id, label: `${n} cached` })
    }

    api.addEventListener('status', onStatus)
    api.addEventListener('execution_start', onExecutionStart)
    api.addEventListener('executing', onExecuting)
    api.addEventListener('execution_success', onExecutionSuccess)
    api.addEventListener('execution_error', onExecutionError)
    api.addEventListener('execution_interrupted', onExecutionInterrupted)
    api.addEventListener('execution_cached', onExecutionCached)

    return () => {
      api.removeEventListener('status', onStatus)
      api.removeEventListener('execution_start', onExecutionStart)
      api.removeEventListener('executing', onExecuting)
      api.removeEventListener('execution_success', onExecutionSuccess)
      api.removeEventListener('execution_error', onExecutionError)
      api.removeEventListener('execution_interrupted', onExecutionInterrupted)
      api.removeEventListener('execution_cached', onExecutionCached)
    }
  }

  return {
    currentNodeId,
    queueRemaining,
    currentPromptId,
    recentEvents,
    isBusy,
    bindToApi,
  }
})
