import { watch } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import {
  setWidget,
  outputHasLinks,
  spawnConsumingNode,
  spawnAssetImageLoader,
  spawnFollowUpStage,
} from '@/composables/stages/spawnFollowUp'
import {
  useStageStore,
  computePickedImageUrl,
  computePickedFromBatch,
  mergeImagePool,
  imagePoolCount,
  toImagePoolJson,
  removeImageFromPool,
  isPoolPickerKind,
  type StageKind,
  type StageVariant,
  type ImagePickContext,
} from '@/stores/stageStore'
import { useProjectStore } from '@/stores/projectStore'
import { useAssetStore } from '@/stores/assetStore'
import { useEntryStore } from '@/stores/entryStore'
import { useExecutionStore } from '@/stores/executionStore'
import {
  validateNode as validateWorkflowInputs,
  applySlotWarnings,
  type SlotWarningMap,
} from '@/composables/stages/useWorkflowValidator'
import {
  prepareWorkflow,
  subscribePrepState,
} from '@/composables/stages/useWorkflowPrep'
import { getStageMeta } from '@/composables/stages/stageMeta'
import { addWorkflowUploadButton } from '@/composables/stages/workflowUpload'
import {
  claimStageUid,
  ensureStageUid,
  releaseStageUid,
  stageClassName,
} from '@/composables/stages/stageIdentity'
import { outputTypeForKind } from '@/composables/stages/stageOutputType'
import { t } from '@/i18n'
import { useSelectionStore } from '@/stores/selectionStore'
import {
  collectReachableNodeIds,
  buildScopedPrompt,
} from '@/utils/graphSerialize'
import {
  injectImageRefs,
  nodeAcceptsAutogrowImages,
  fetchWorkflowMetaCached,
  workflowRefOfNode,
  type ResolvedImageRef,
} from '@/composables/stages/assetSlots'
import { readImageRefs } from '@/composables/stages/imageRefs'
import {
  expandMentionTokens,
  mentionOrdinalText,
  mentionSendOrders,
  normalizeMentionStyle,
} from '@/composables/stages/imageSlotMentions'
import { extractRunError } from '@/utils/runError'
import { postPickedIndex } from '@/composables/stages/stageApi'
import { cancelRemoteJob, remoteRun } from '@/api'
import { useRemotePreflight } from '@/composables/stages/useRemotePreflight'
import { useServerStore } from '@/stores/serverStore'
import { app } from '@/lib/comfyApp'

export interface UseStageNodeResult {
  state: ReturnType<ReturnType<typeof useStageStore>['registerStage']>
  onRunRequest: () => Promise<void>
  onCancelRequest: () => Promise<void>
  onDisconnect: (slotName: string) => void
  onAction: (actionId: string, context?: ImagePickContext) => void
}

function inputFileUrl(value: string): string {
  if (!value) return ''
  const slash = value.lastIndexOf('/')
  const subfolder = slash >= 0 ? value.slice(0, slash) : ''
  const filename = slash >= 0 ? value.slice(slash + 1) : value
  const params = new URLSearchParams({ filename, type: 'input' })
  if (subfolder) params.set('subfolder', subfolder)
  return `/view?${params.toString()}`
}

export function useStageNode(
  node: any,
  kind: StageKind,
  variant: StageVariant = 'generator',
): UseStageNodeResult {
  const store = useStageStore()
  const executionStore = useExecutionStore()
  const state = store.registerStage(node, kind, variant)

  const usesStageUid = variant !== 'loader' && !isPoolPickerKind(kind)
  if (usesStageUid) {
    claimStageUid(node)
    node.onConfigure = useChainCallback(node.onConfigure, () => {
      claimStageUid(node)
    })
  }

  if (variant === 'generator') {
    const promptWidget = node.widgets?.find((w: any) => w.name === 'main_prompt')
    if (promptWidget) {
      state.mainPrompt = String(promptWidget.value ?? '')
      promptWidget.callback = useChainCallback(promptWidget.callback, () => {
        state.mainPrompt = String(promptWidget.value ?? '')
      })
    }

    if (isPoolPickerKind(kind) || kind === 'image-batch') {
      const idxWidget = node.widgets?.find((w: any) => w.name === 'selected_index')
      if (idxWidget) {
        const initial = Number(idxWidget.value)
        const safe = Number.isFinite(initial) && initial >= 1 ? Math.floor(initial) : 1
        if (idxWidget.value !== safe) idxWidget.value = safe
        state.pickedIndex = safe
        idxWidget.callback = useChainCallback(idxWidget.callback, () => {
          state.pickedIndex = Number(idxWidget.value) || 1
        })
      }
    }

    if (isPoolPickerKind(kind)) {
      const poolWidget = node.widgets?.find((w: any) => w.name === 'pool')
      state.pool = poolWidget ? (String(poolWidget.value ?? '') || null) : null
    }
  } else if (variant === 'loader') {
    const recipeWidget = node.widgets?.find((w: any) => w.name === 'recipe')
    if (recipeWidget) {
      const kindWidget = node.widgets?.find((w: any) => w.name === 'kind')
      const sync = () => {
        const raw = String(recipeWidget.value ?? '').trim()
        if (!raw) {
          store.setOutputSlot(state, 0, null)
          return
        }
        let params: Record<string, unknown> = {}
        try {
          const parsed = JSON.parse(raw)
          if (parsed && typeof parsed === 'object') params = parsed as Record<string, unknown>
        } catch {
          params = {}
        }
        const kind = String(kindWidget?.value ?? 'cube')
        store.setOutputSlot(state, 0, JSON.stringify({ __prim__: { kind, ...params } }))
      }
      sync()
      recipeWidget.callback = useChainCallback(recipeWidget.callback, sync)
      if (kindWidget) kindWidget.callback = useChainCallback(kindWidget.callback, sync)
    } else if (kind === 'text') {
      const textWidget = node.widgets?.find((w: any) => w.name === 'text')
      if (textWidget) {
        const sync = () => {
          const v = String(textWidget.value ?? '')
          store.setOutputSlot(state, 0, v ? v : null)
        }
        sync()
        textWidget.callback = useChainCallback(textWidget.callback, sync)
      }
    } else {
      const widgetName = kind === 'image' ? 'image'
                       : kind === 'video' ? 'video'
                       : kind === 'audio' ? 'audio'
                       : kind === 'model' ? 'model'
                       : null
      const uploadWidget = widgetName
        ? node.widgets?.find((w: any) => w.name === widgetName)
        : null
      if (uploadWidget) {
        const sync = () => {
          const v = String(uploadWidget.value ?? '')
          store.setOutputSlot(state, 0, v ? inputFileUrl(v) : null)
        }
        sync()
        uploadWidget.callback = useChainCallback(uploadWidget.callback, sync)
      }
    }
  }

  const refresh = () => store.refreshStageInputs(node, state, app as any)

  const reValidate = () => {
    const assetStore = useAssetStore()
    assetStore.hydrate()
      .then(() => validateWorkflowInputs(node, kind, {
        assetExists: (id: number) => !!assetStore.byId(id),
      }))
      .then((map: SlotWarningMap) => {
        node._comfytvSlotWarnings = map
        applySlotWarnings(node)
        ;(app as any)?.graph?.setDirtyCanvas?.(true, true)
      })
  }

  const _selectionStore = useSelectionStore()
  const stopBindingsWatch = watch(
    () => _selectionStore.bindingsVersion,
    () => { if (variant === 'generator') queueMicrotask(reValidate) },
  )
  let _prepUnsub: (() => void) | null = null
  const meta = getStageMeta(node.comfyClass)
  const workflowKind = meta?.workflow_kind || null

  function triggerPrepForCurrentWorkflow(): void {
    if (!workflowKind) return
    const wfWidget = node.widgets?.find((w: any) => w.name === 'workflow')
    const label = wfWidget ? String(wfWidget.value ?? '') : ''
    if (!label) return
    _prepUnsub?.()
    _prepUnsub = subscribePrepState(workflowKind, label, (ps) => {
      state.preparingWorkflow = ps.busy
    })
    void prepareWorkflow(workflowKind, label).catch(() => { /* error already on state */ })
  }

  if (variant === 'generator') {
    const wfWidget = node.widgets?.find((w: any) => w.name === 'workflow')
    if (wfWidget) {
      const selectionStore = useSelectionStore()
      wfWidget.callback = useChainCallback(wfWidget.callback, () => {
        queueMicrotask(reValidate)
        queueMicrotask(triggerPrepForCurrentWorkflow)
        queueMicrotask(() => selectionStore.refreshFromCanvas())
        queueMicrotask(() => selectionStore.bumpBindings())
      })
      if (workflowKind) addWorkflowUploadButton(node, wfWidget, workflowKind)
    }
    queueMicrotask(triggerPrepForCurrentWorkflow)
  }

  node.onConnectionsChange = useChainCallback(node.onConnectionsChange, () => {
    queueMicrotask(refresh)
    queueMicrotask(() => store.notifyDownstream())
    if (variant === 'generator') queueMicrotask(reValidate)
  })

  queueMicrotask(refresh)
  if (variant === 'generator') queueMicrotask(reValidate)

  const stopTickWatch = watch(
    () => store.stateTick,
    (n) => {
      refresh()
    },
  )

  const stopPickerWatch = isPoolPickerKind(kind)
    ? watch(
        () => {
          const inp = state.inputs.find(i => i.slot === 'batch')
          return [inp?.source ?? '', inp?.content ?? '', state.pickedIndex ?? 0] as const
        },
        () => {
          const inp = state.inputs.find(i => i.slot === 'batch')

          if (inp && inp.source === 'upstream' && inp.content) {
            const before = imagePoolCount(state.pool)
            const merged = mergeImagePool(state.pool, toImagePoolJson(inp.content))
            store.setPickerPool(node, state, merged)
            const added = imagePoolCount(merged) - before

            if (added > 0) {
              state.pickedIndex = 1
              setWidget(node, 'selected_index', 1)
            }
          }
          const after: string | null = state.pool
            ? computePickedImageUrl(state)
            : (inp && inp.source === 'empty' ? null : computePickedImageUrl(state))
          if (after !== state.output) {
            store.setOutputSlot(state, 0, after)
          }
        },
        { immediate: true },
      )
    : null

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
      const isBridgeIn = typeof node?.comfyClass === 'string'
                         && node.comfyClass.startsWith('ComfyTV.BridgeTo')
      const pm = isBridgeIn
        ? await a.graphToPrompt()
        : await buildScopedPrompt(a, collectReachableNodeIds(a, node))

      const targetId = String(node.id)
      const missingUpstream: string[] = []
      const promptNodeIds = isBridgeIn ? [targetId] : Object.keys(pm?.output ?? {})
      for (const nid of promptNodeIds) {
        const nodeInputs = pm?.output?.[nid]?.inputs
        if (!nodeInputs) continue
        for (const key of Object.keys(nodeInputs)) {
          const val = nodeInputs[key]
          if (!Array.isArray(val) || val.length !== 2) continue
          const upstreamId = val[0]
          if (!isBridgeIn && pm?.output?.[String(upstreamId)]) continue
          const upstreamSlot = Number(val[1]) || 0
          const upstreamNode = a.graph?.getNodeById?.(Number(upstreamId))
                            ?? a.graph?.getNodeById?.(String(upstreamId))
          if (!upstreamNode) continue
          const upstreamState = store.getStage(upstreamNode)
          let snapshot: string | null | undefined
          if (upstreamState) {
            const slotted = upstreamState.outputs?.[upstreamSlot]
            if (slotted != null) {
              snapshot = slotted
            } else if (upstreamSlot === 0 && upstreamState.output) {
              snapshot = upstreamState.output
            }
          }
          if (snapshot != null && snapshot !== '') {
            nodeInputs[key] = snapshot
          } else if (!isBridgeIn) {
            const upstreamLabel = upstreamNode.title
                                  || upstreamNode.comfyClass
                                  || `#${upstreamId}`
            missingUpstream.push(`${upstreamLabel} (#${upstreamId})`)
          }
        }
      }

      if (missingUpstream.length > 0) {
        const list = [...new Set(missingUpstream)].join(', ')
        const msg = t('error.upstreamNotReadyDetail', { list })
        console.warn(`[ComfyTV/stage] ${msg}`)
        ;(app as any)?.extensionManager?.toast?.add?.({
          severity: 'warn',
          summary: t('error.upstreamNotReady'),
          detail: msg,
          life: 6000,
        })
        state.running = false
        return
      }

      const entries = useEntryStore()
      const assetStore = useAssetStore()
      const pid = useProjectStore().currentProjectId || ''

      const refsByNode = new Map<string, ReturnType<typeof readImageRefs>>()
      for (const nid of Object.keys(pm?.output ?? {})) {
        const gn = a.graph?.getNodeById?.(Number(nid)) ?? a.graph?.getNodeById?.(String(nid))
        const refs = readImageRefs(gn)
        if (refs.length) refsByNode.set(String(nid), refs)
      }
      if (refsByNode.size > 0) await assetStore.hydrate()

      for (const [nid, inputs] of Object.entries(pm?.output ?? {})) {
        const obj = (inputs as any)?.inputs
        if (!obj) continue

        const refs = refsByNode.get(String(nid))
        if (refs?.length) {
          const graphNode = a.graph?.getNodeById?.(Number(nid))
                         ?? a.graph?.getNodeById?.(String(nid))
          if (nodeAcceptsAutogrowImages(graphNode)) {
            const resolved: ResolvedImageRef[] = []
            for (const r of refs) {
              const asset = assetStore.byId(r.asset_id)
              if (asset) resolved.push({ id: r.asset_id, url: asset.payload_url, slot: r.slot })
              else console.warn(`[ComfyTV/stage] node #${nid}: image ref ${r.asset_id} missing from library`)
            }
            for (const w of injectImageRefs(obj, resolved)) {
              console.warn(`[ComfyTV/stage] node #${nid}: ${w}`)
            }
          }
        }

        const mp = obj.main_prompt
        if (typeof mp === 'string' && mp.includes('@')) {
          const graphNode = a.graph?.getNodeById?.(Number(nid))
                         ?? a.graph?.getNodeById?.(String(nid))
          let mentionStyle = normalizeMentionStyle(undefined)
          const wfRef = workflowRefOfNode(graphNode)
          if (wfRef) {
            try {
              const meta = await fetchWorkflowMetaCached(wfRef.kind, wfRef.label)
              mentionStyle = normalizeMentionStyle(meta.mention_style)
            } catch {}
          }
          const { text, missing } = expandMentionTokens(
            mp,
            mentionSendOrders(graphNode),
            {
              image: mentionOrdinalText(mentionStyle, n => t('mention.imageExpand', { n }), 'image'),
              video: mentionOrdinalText(mentionStyle, n => t('mention.videoExpand', { n }), 'video'),
              audio: mentionOrdinalText(mentionStyle, n => t('mention.audioExpand', { n }), 'audio'),
            },
          )
          for (const m of missing) {
            console.warn(`[ComfyTV/stage] node #${nid}: @${m.type}_${m.slot} references an empty slot — dropped from prompt`)
          }
          obj.main_prompt = entries.expand(pid, text)
        }
      }
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

  const onDisconnect = (slotName: string) => {
    const idx = (node.inputs || []).findIndex((i: any) => i.name === slotName)
    if (idx < 0) return
    node.disconnectInput(idx)
  }

  const onAction = (actionId: string, context?: ImagePickContext) => {
    if (actionId === 'load-asset') {
      const url = context?.imageUrl
      if (url) void spawnAssetImageLoader(node, url, context?.label, context?.mediaType || 'image')
      return
    }
    if (actionId === 'model-capture-view') {
      const url = context?.imageUrl
      if (kind === 'model' && url) {
        setWidget(node, 'captured_image', url)
        store.setOutputSlot(state, 1, url)
      }
      return
    }
    if (actionId === 'clear-pool' && isPoolPickerKind(kind)) {
      store.clearPickerPool(node, state)
      return
    }
    if (actionId === 'remove-pool-item' && context && isPoolPickerKind(kind)) {
      const removedIndex = Number(context.index) || 0
      const merged = removeImageFromPool(state.pool, context.imageUrl ?? '')
      const count = imagePoolCount(merged)
      if (count === 0) {
        store.clearPickerPool(node, state)
        return
      }
      store.setPickerPool(node, state, merged)
      let idx = state.pickedIndex ?? 1
      if (removedIndex && removedIndex < idx) idx -= 1
      idx = Math.max(1, Math.min(count, idx))
      state.pickedIndex = idx
      setWidget(node, 'selected_index', idx)
      const out = computePickedImageUrl(state)
      if (out !== state.output) store.setOutputSlot(state, 0, out)
      return
    }
    if (actionId === 'pick-item' && context && (isPoolPickerKind(kind) || kind === 'image-batch')) {
      const newIdx = Number(context.index) || 1
      state.pickedIndex = newIdx
      setWidget(node, 'selected_index', newIdx)
      if (kind === 'image-batch') {
        const picked = computePickedFromBatch(state.output, newIdx)
        store.setOutputSlot(state, 1, picked)
        if (state.outputId != null && state.outputId > 0) {
          void postPickedIndex(state.outputId, newIdx)
        }
      }
      return
    }
    spawnFollowUpStage(node, kind, actionId, context)
  }

  let runningPromptId: string | null = null
  let runningJobId: string | null = null
  let watchdogTimer: ReturnType<typeof setTimeout> | null = null
  const clearWatchdog = () => {
    if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null }
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

  const projectStore = useProjectStore()
  const projectIdWidget = node.widgets?.find((w: any) => w.name === 'project_id')

  if (projectIdWidget) {
    projectIdWidget.value = projectStore.currentProjectId
  }

  const stopProjectWatch = watch(
    () => projectStore.currentProjectId,
    (newId) => {
      if (projectIdWidget) projectIdWidget.value = newId
      void restoreLatestOutput(newId)
    },
  )

  const stopTagWatch = watch(
    () => state.outputId,
    (oid) => {
      if (oid && oid > 0) {
        void projectStore.tagOutputStageUid(Number(oid), ensureStageUid(node))
      }
    },
  )

  function applyRestoredOutput(latest: any) {
    const pj = latest.payload_json
    const restored = latest.payload_url
      ? String(latest.payload_url)
      : typeof pj === 'string'
        ? pj
        : (pj != null ? JSON.stringify(pj) : '')
    if (latest.id != null && state.outputId !== latest.id) {
      state.outputId = Number(latest.id)
    }
    state.durationMs = latest.duration_ms != null ? Number(latest.duration_ms) : null
    if (restored && restored !== state.output) {
      store.setOutputSlot(state, 0, restored)
    }
    if (kind === 'image-batch' && restored) {
      const widget = node.widgets?.find((wi: any) => wi.name === 'selected_index')
      const fromDb = Number(latest.picked_index)
      const fromWidget = Number(widget?.value)
      const idx = Number.isFinite(fromDb) && fromDb >= 1 ? Math.floor(fromDb)
                : Number.isFinite(fromWidget) && fromWidget >= 1 ? Math.floor(fromWidget)
                : 1
      state.pickedIndex = idx
      if (widget && widget.value !== idx) widget.value = idx
      const picked = computePickedFromBatch(restored, idx)
      store.setOutputSlot(state, 1, picked ?? null)
    }
  }

  let adoptionTried = false
  async function restoreLatestOutput(projectId: string) {
    if (variant === 'loader') return
    if (isPoolPickerKind(kind)) return
    if (!node.id || node.id < 0) return
    const uid = ensureStageUid(node)
    try {
      let latest = await projectStore.fetchLatestOutput(projectId, uid, outputTypeForKind(kind))

      if (!latest && node.__comfytvFromSave && !adoptionTried) {
        adoptionTried = true
        latest = await projectStore.adoptOutputs(
          projectId, String(node.id), stageClassName(node), uid, outputTypeForKind(kind),
        )
      }
      if (!latest) {
        if (state.output != null) {
          store.setOutputSlot(state, 0, null)
          if (state.outputs.length > 1) state.outputs[1] = null
        }
        return
      }

      applyRestoredOutput(latest)
    } catch (e) {
      console.warn(`[ComfyTV/stage] restoreLatestOutput failed for node ${node.id}`, e)
    }
  }

  let restoreAttempts = 0
  const attemptRestore = () => {
    if (node.id != null && node.id >= 0) {
      void restoreLatestOutput(projectStore.currentProjectId)
      return
    }
    if (++restoreAttempts < 20) {
      setTimeout(attemptRestore, 80)
    }
  }
  queueMicrotask(attemptRestore)

  node.onRemoved = useChainCallback(node.onRemoved, () => {
    stopTickWatch()
    stopPickerWatch?.()
    stopProjectWatch()
    stopTagWatch()
    stopBindingsWatch()
    executionStore.unregisterNodeHandlers(nodeRunHandlers)
    clearWatchdog()
    _prepUnsub?.()
    releaseStageUid(node)
    store.unregisterStage(node)
  })

  return { state, onRunRequest, onCancelRequest, onDisconnect, onAction }
}
