import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'

import { t } from '@/i18n'

export interface ExecutionEvent {
  ts: number
  kind: string
  promptId?: string
  label?: string
}

export interface NodeProgress {
  value: number
  max: number
  text?: string
}

export interface NodeRunHandlers {
  getNodeId: () => string
  onProgress?: (detail: any) => void
  onProgressText?: (detail: any) => void
  onError?: (detail: any) => void
  onInterrupted?: (detail: any) => void
  onSuccess?: (detail: any) => void
  onStatus?: (detail: any) => void
}

const HISTORY_LIMIT = 30

export const useExecutionStore = defineStore('comfytv-execution', () => {
  const currentNodeId = ref<string | null>(null)
  const queueRemaining = ref(0)
  const currentPromptId = ref<string | null>(null)
  const recentEvents = ref<ExecutionEvent[]>([])

  const nodeProgress = reactive(new Map<string, NodeProgress>())
  const nodeHandlers = new Set<NodeRunHandlers>()

  const isBusy = computed(() => currentNodeId.value != null || queueRemaining.value > 0)

  function pushEvent(ev: Omit<ExecutionEvent, 'ts'>) {
    recentEvents.value = [
      { ...ev, ts: Date.now() },
      ...recentEvents.value,
    ].slice(0, HISTORY_LIMIT)
  }

  function progressForNode(id: string | number): NodeProgress | undefined {
    return nodeProgress.get(String(id))
  }

  function handlersForId(id: string): NodeRunHandlers | undefined {
    for (const h of nodeHandlers) {
      if (h.getNodeId() === id) return h
    }
    return undefined
  }

  function registerNodeHandlers(handlers: NodeRunHandlers): void {
    nodeHandlers.add(handlers)
  }

  function unregisterNodeHandlers(handlers: NodeRunHandlers): void {
    nodeHandlers.delete(handlers)
    nodeProgress.delete(handlers.getNodeId())
  }

  function bindToApi(api: any): () => void {
    const onStatus = (e: any) => {
      const info = e?.detail?.status?.exec_info ?? e?.detail?.exec_info
      if (info && typeof info.queue_remaining === 'number') {
        queueRemaining.value = info.queue_remaining
      }
      for (const h of nodeHandlers) h.onStatus?.(e?.detail)
    }
    const onProgress = (e: any) => {
      const d = e?.detail
      if (!d) return
      const id = String(d.node)
      const h = handlersForId(id)
      if (!h) return
      const prev = nodeProgress.get(id)
      const next: NodeProgress = {
        value: Number(d.value) || 0,
        max: Math.max(1, Number(d.max) || 1),
        text: prev?.text,
      }
      nodeProgress.set(id, next)
      h.onProgress?.(d)
    }
    const onProgressText = (e: any) => {
      const d = e?.detail
      if (!d) return
      const id = String(d.nodeId ?? d.node)
      const h = handlersForId(id)
      if (!h) return
      const prev = nodeProgress.get(id) ?? { value: 0, max: 1 }
      const next: NodeProgress = { ...prev, text: String(d.text || '') }
      nodeProgress.set(id, next)
      h.onProgressText?.(d)
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
      for (const h of nodeHandlers) h.onSuccess?.(d)
    }
    const onExecutionError = (e: any) => {
      const d = e?.detail
      currentNodeId.value = null
      pushEvent({
        kind: 'error',
        promptId: d?.prompt_id,
        label: d?.exception_message || 'execution failed',
      })
      const h = d?.node_id != null ? handlersForId(String(d.node_id)) : undefined
      h?.onError?.(d)
    }
    const onExecutionInterrupted = (e: any) => {
      const d = e?.detail
      currentNodeId.value = null
      pushEvent({
        kind: 'cancelled',
        promptId: d?.prompt_id,
        label: t('error.cancelled'),
      })
      const h = d?.node_id != null ? handlersForId(String(d.node_id)) : undefined
      h?.onInterrupted?.(d)
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
    api.addEventListener('progress', onProgress)
    api.addEventListener('progress_text', onProgressText)

    return () => {
      api.removeEventListener('status', onStatus)
      api.removeEventListener('execution_start', onExecutionStart)
      api.removeEventListener('executing', onExecuting)
      api.removeEventListener('execution_success', onExecutionSuccess)
      api.removeEventListener('execution_error', onExecutionError)
      api.removeEventListener('execution_interrupted', onExecutionInterrupted)
      api.removeEventListener('execution_cached', onExecutionCached)
      api.removeEventListener('progress', onProgress)
      api.removeEventListener('progress_text', onProgressText)
    }
  }

  return {
    currentNodeId,
    queueRemaining,
    currentPromptId,
    recentEvents,
    nodeProgress,
    isBusy,
    bindToApi,
    progressForNode,
    registerNodeHandlers,
    unregisterNodeHandlers,
  }
})
