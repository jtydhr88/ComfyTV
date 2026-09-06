import { cancelRemoteJob, remoteRun } from '@/api'
import { outputHasLinks, spawnConsumingNode } from '@/composables/stages/spawnFollowUp'
import { ensureStageUid } from '@/composables/stages/stageIdentity'
import { buildRunPrompt } from '@/composables/stages/stagePromptBuild'
import { useRemotePreflight } from '@/composables/stages/useRemotePreflight'
import { t } from '@/i18n'
import { app } from '@/lib/comfyApp'
import { useExecutionStore } from '@/stores/executionStore'
import { useServerStore } from '@/stores/serverStore'
import {
  isPoolPickerKind,
  type StageKind,
  type StageState,
  type StageVariant,
  useStageStore,
} from '@/stores/stageStore'
import { extractRunError } from '@/utils/runError'

type Store = ReturnType<typeof useStageStore>

export interface StageRunController {
  onRunRequest: () => Promise<void>
  onCancelRequest: () => Promise<void>
  registerPreRun: (fn: () => unknown) => () => void
  dispose: () => void
}

export function createStageRun(opts: {
  node: any
  state: StageState
  store: Store
  kind: StageKind
  variant: StageVariant
  refresh: () => void
}): StageRunController {
  const { node, state, store, kind, variant, refresh } = opts
  const executionStore = useExecutionStore()

  let runningPromptId: string | null = null
  let runningJobId: string | null = null
  let watchdogTimer: ReturnType<typeof setTimeout> | null = null
  const clearWatchdog = () => {
    if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null }
  }

  const preRunHooks: Array<() => unknown> = []
  const registerPreRun = (fn: () => unknown) => {
    preRunHooks.push(fn)
    return () => {
      const i = preRunHooks.indexOf(fn)
      if (i >= 0) preRunHooks.splice(i, 1)
    }
  }

  const onRunRequest = async () => {
    if (state.running) return
    if (variant === 'loader') return
    if (state.preparingWorkflow) {
      ;(app as any)?.extensionManager?.toast?.add?.({
        severity: 'warn',
        summary: t('stage.preparingWorkflow'),
        detail: t('stage.preparingWorkflowDetail'),
        life: 3000,
      })
      return
    }
    for (const fn of [...preRunHooks]) {
      try {
        await fn()
      } catch (e) {
        console.warn('[ComfyTV] pre-run hook failed, running anyway:', e)
      }
    }
    refresh()

    const tokenWidget = node.widgets?.find((w: any) => w.name === 'force_run_token')
    if (tokenWidget) tokenWidget.value = Date.now() & 0x7fffffff

    if (
      node.comfyClass === 'ComfyTV.ImageStage'
      && !outputHasLinks(node, 0)
      && !outputHasLinks(node, 1)
    ) {
      spawnConsumingNode(node, 'ComfyTV.ImagePickerStage', 'batch')
    }

    if (
      node.comfyClass === 'ComfyTV.VideoStage'
      && !outputHasLinks(node, 0)
    ) {
      spawnConsumingNode(node, 'ComfyTV.VideoPickerStage', 'batch')
    }

    state.running = true
    try {
      const a = app as any
      const built = await buildRunPrompt(node, store)
      if (!built) {
        state.running = false
        return
      }
      const { pm, targetId, isBridgeIn, pid } = built

      const serverStore = useServerStore()
      const remoteServerId = serverStore.resolveSelection(
        (node as any).properties?.comfytv_server,
      )
      if (remoteServerId != null && !isBridgeIn) {
        const { ensureRemotePreflight } = useRemotePreflight()
        const cleared = await ensureRemotePreflight(
          remoteServerId,
          String(node.comfyClass || ''),
          (pm?.output?.[targetId]?.inputs ?? {}) as Record<string, unknown>,
        )
        if (!cleared) {
          state.running = false
          return
        }
        const resp = await remoteRun({
          server_id: remoteServerId,
          prompt: pm.output,
          target_node_id: targetId,
          project_id: pid,
          stage_uid: ensureStageUid(node),
        })
        runningJobId = resp.job_id
        executionStore.registerRemoteJob(targetId, resp.job_id)
        return
      }

      ;(pm as any).__comfytvOwnRun = true
      const queueResp = await a.api.queuePrompt(0, pm, { partialExecutionTargets: [targetId] })
      runningPromptId = queueResp?.prompt_id ? String(queueResp.prompt_id) : null
    } catch (e) {
      console.error('[ComfyTV/stage] queuePrompt failed', e)
      const err = extractRunError(e, node.id)
      store.applyExecutionError(state, err)
      runningPromptId = null
      runningJobId = null
    }
  }

  const onCancelRequest = async () => {
    if (!state.running) return
    if (runningJobId) {
      try {
        await cancelRemoteJob(runningJobId)
      } catch (e) {
        console.error('[ComfyTV/stage] remote cancel failed', e)
      }
      return
    }
    try {
      const a = app as any
      if (typeof a.api.interrupt === 'function') {
        await a.api.interrupt()
      } else {
        await a.api.fetchApi('/interrupt', { method: 'POST' })
      }
    } catch (e) {
      console.error('[ComfyTV/stage] interrupt failed', e)
    }
  }

  const onProgress = (d: any) => {
    if (!d) return
    if (String(d.node) !== String(node.id)) return
    const prev = state.progress
    state.progress = {
      value: Number(d.value) || 0,
      max: Math.max(1, Number(d.max) || 1),
      text: prev?.text,
    }
  }
  const onProgressText = (d: any) => {
    if (!d) return
    if (String(d.nodeId ?? d.node) !== String(node.id)) return
    const prev = state.progress ?? { value: 0, max: 1 }
    state.progress = { ...prev, text: String(d.text || '') }
  }

  const onExecError = (d: any) => {
    if (!d) return
    const rawType = d.exception_type ? String(d.exception_type) : undefined
    const rawMsg = String(d.exception_message || d.message || 'execution failed')
    const err = {
      message: rawMsg,
      type: rawType,
      traceback: Array.isArray(d.traceback) ? d.traceback.join('') : (d.traceback || undefined),
    }
    store.applyExecutionError(state, err)
    runningPromptId = null
    clearWatchdog()
    console.warn(`[ComfyTV/stage] execution_error on node ${node.id}:`, err)
  }
  const onExecInterrupted = (d: any) => {
    if (!d) return
    store.applyExecutionError(state, {
      message: t('error.cancelled'),
      type: 'Cancelled',
    })
    runningPromptId = null
    clearWatchdog()
    console.warn(`[ComfyTV/stage] execution_interrupted on node ${node.id}`)
  }

  const onExecSuccess = (d: any) => {
    if (!d) return
    if (!runningPromptId || String(d.prompt_id) !== runningPromptId) return
    runningPromptId = null
    clearWatchdog()
    if (state.running) state.running = false
  }

  const onStatus = (d: any) => {
    const remaining = Number(d?.status?.exec_info?.queue_remaining ?? d?.exec_info?.queue_remaining)
    if (!Number.isFinite(remaining) || remaining !== 0) return
    if (!runningPromptId || !state.running) return
    if (watchdogTimer) return
    const pid = runningPromptId
    watchdogTimer = setTimeout(() => {
      watchdogTimer = null
      if (runningPromptId !== pid || !state.running) return
      console.warn(`[ComfyTV/stage] watchdog firing on node ${node.id} — queue empty but no execution_success/error for prompt ${pid}`)
      store.applyExecutionError(state, {
        message: t('error.workerDied'),
        type: 'WorkerDied',
      })
      runningPromptId = null
    }, 3000)
  }

  const onRemoteJob = (d: any) => {
    if (!d) return
    if (runningJobId && d.job_id && d.job_id !== runningJobId) return
    runningJobId = null
    if (d.status === 'done') {
      store.applyExecutedPayload(state, d.ui || {})
    } else if (d.status === 'cancelled') {
      store.applyExecutionError(state, {
        message: t('error.cancelled'),
        type: 'Cancelled',
      })
    } else if (d.status === 'error') {
      store.applyExecutionError(state, {
        message: String(d.error || t('servers.job.failed')),
        type: 'RemoteError',
      })
    }
  }

  const nodeRunHandlers = {
    getNodeId: () => String(node.id),
    onProgress,
    onProgressText,
    onError: onExecError,
    onInterrupted: onExecInterrupted,
    onSuccess: onExecSuccess,
    onStatus,
    onRemoteJob,
  }
  executionStore.registerNodeHandlers(nodeRunHandlers)

  if (variant !== 'loader' && !isPoolPickerKind(kind)) {
    const attemptRemoteRestore = (tries = 0) => {
      if (node.id != null && node.id >= 0) {
        void executionStore.remoteJobForNode(String(node.id)).then((jobId) => {
          if (jobId && !state.running) {
            runningJobId = jobId
            state.running = true
          }
        })
      } else if (tries < 20) {
        setTimeout(() => attemptRemoteRestore(tries + 1), 80)
      }
    }
    queueMicrotask(() => attemptRemoteRestore())
  }

  const dispose = () => {
    executionStore.unregisterNodeHandlers(nodeRunHandlers)
    clearWatchdog()
  }

  return { onRunRequest, onCancelRequest, registerPreRun, dispose }
}
