import { watch } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import {
  IMAGE_VARIANT_PRESETS,
  type ImagePreset,
} from '@/composables/stages/imagePresets'
import { IMAGE_EDIT_PRESETS } from '@/composables/stages/imageEditPresets'
import { VIDEO_CHANGE_PRESETS } from '@/composables/stages/videoChangePresets'
import {
  useStageStore,
  computePickedImageUrl,
  computePickedFromBatch,
  mergeImagePool,
  imagePoolCount,
  type StageKind,
  type StageVariant,
  type ImagePickContext,
} from '@/stores/stageStore'
import { useProjectStore } from '@/stores/projectStore'
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
import { ensureStageUid, stageClassName } from '@/composables/stages/stageIdentity'
import { useSelectionStore } from '@/stores/selectionStore'
import {
  collectReachableNodeIds,
  buildScopedPrompt,
} from '@/utils/graphSerialize'
import { extractRunError } from '@/utils/runError'
import { postPickedIndex } from '@/composables/stages/stageApi'
import { app } from '@/lib/comfyApp'

const STAGE_CLASS_BY_KIND: Record<StageKind, string> = {
  text:           'ComfyTV.TextStage',
  image:          'ComfyTV.ImageStage',
  video:          'ComfyTV.VideoStage',
  audio:          'ComfyTV.AudioStage',
  panorama:       'ComfyTV.PanoramaStage',
  storyboard:     'ComfyTV.StoryboardStage',
  'image-batch':  'ComfyTV.ShotImagesStage',
  'image-picker': 'ComfyTV.ImagePickerStage',
  timeline:       'ComfyTV.DirectorTimelineStage',
}

const TARGET_GROUP_BY_KIND: Record<StageKind, 'texts' | 'images' | 'videos'> = {
  text:           'texts',
  image:          'images',
  video:          'videos',
  audio:          'videos',
  panorama:       'images',
  storyboard:     'texts',
  'image-batch':  'images',
  'image-picker': 'images',
  timeline:       'images',
}

function findFirstAutogrowSlot(node: any, groupPrefix: string): number {
  if (!node.inputs) return -1
  for (let i = 0; i < node.inputs.length; i++) {
    const n = String(node.inputs[i].name || '')
    if (n.startsWith(groupPrefix + '.')) return i
  }
  return -1
}

function findNamedSlot(node: any, name: string): number {
  if (!node.inputs) return -1
  for (let i = 0; i < node.inputs.length; i++) {
    if (String(node.inputs[i].name || '') === name) return i
  }
  return -1
}

function outputHasLinks(node: any, idx: number): boolean {
  const out = node?.outputs?.[idx]
  return !!(out?.links && out.links.length > 0)
}

function createNodeAt(targetClass: string, pos: [number, number]): any | null {
  const win = window as any
  if (!win.LiteGraph?.createNode) {
    console.error('[ComfyTV/action] LiteGraph.createNode not available')
    return null
  }
  const node = win.LiteGraph.createNode(targetClass)
  if (!node) {
    console.error('[ComfyTV/action] createNode returned null for', targetClass)
    return null
  }
  ;(app as any)?.graph?.add(node)
  node.pos = pos
  return node
}

function posRightOf(srcNode: any, dx: number = 60): [number, number] {
  return [
    (srcNode.pos?.[0] || 0) + (srcNode.size?.[0] || 280) + dx,
    srcNode.pos?.[1] || 0,
  ]
}

function setWidget(node: any, name: string, value: any) {
  const w = node.widgets?.find((wi: any) => wi.name === name)
  if (w) w.value = value
}

function stampLineage(srcNode: any, newNode: any) {
  const store = useStageStore()
  const srcState = store.getStage(srcNode)
  const parentId = srcState?.outputId
  if (parentId != null && parentId > 0) {
    setWidget(newNode, 'parent_output_id', parentId)
  }
}

function wireAndSeed(srcNode: any, newNode: any, preset: ImagePreset, srcSlot: number = 0) {
  const store = useStageStore()

  let slot = -1
  if (preset.inputSocket) {
    slot = findNamedSlot(newNode, preset.inputSocket)
  } else if (preset.inputAutogrowGroup) {
    slot = findFirstAutogrowSlot(newNode, preset.inputAutogrowGroup)
  }
  if (slot < 0) {
    console.warn('[ComfyTV/preset]', preset.id, 'no target slot on',
                 newNode.comfyClass, 'inputs=', newNode.inputs?.map((i: any) => i.name))
  } else {
    srcNode.connect(srcSlot, newNode, slot)
  }

  if (preset.widgets) {
    for (const [name, value] of Object.entries(preset.widgets)) {
      setWidget(newNode, name, value)
    }
    if ('main_prompt' in preset.widgets) {
      const state = store.getStage(newNode)
      if (state) state.mainPrompt = String(preset.widgets.main_prompt ?? '')
    }
  }

  stampLineage(srcNode, newNode)
}

function spawnImagePreset(srcNode: any, preset: ImagePreset, srcSlot: number = 0) {
  const store = useStageStore()

  if (preset.multiTargetClasses && preset.multiTargetClasses.length) {
    const baseX = (srcNode.pos?.[0] || 0) + (srcNode.size?.[0] || 280) + 60
    const baseY = srcNode.pos?.[1] || 0
    const rowGap = 60
    let rowY = baseY
    preset.multiTargetClasses.forEach((cls, i) => {
      const newNode = createNodeAt(cls, [baseX, rowY])
      if (!newNode) return
      wireAndSeed(srcNode, newNode, preset, srcSlot)
      rowY += (newNode.size?.[1] || 260) + rowGap
    })
    store.notifyDownstream()
    return
  }

  const targetClass = preset.targetClass ?? STAGE_CLASS_BY_KIND.image
  const newNode = createNodeAt(targetClass, posRightOf(srcNode))
  if (!newNode) return
  wireAndSeed(srcNode, newNode, preset, srcSlot)
  store.notifyDownstream()
}

function spawnConsumingNode(srcNode: any, targetClass: string, inputSlotName: string, srcSlot: number = 0) {
  const newNode = createNodeAt(targetClass, posRightOf(srcNode))
  if (!newNode) return null
  const slot = findNamedSlot(newNode, inputSlotName)
  if (slot < 0) {
    console.warn('[ComfyTV/action] target', targetClass, 'has no', inputSlotName, 'slot',
                 'inputs=', newNode.inputs?.map((i: any) => i.name))
    return newNode
  }
  srcNode.connect(srcSlot, newNode, slot)
  stampLineage(srcNode, newNode)
  return newNode
}

function spawnExtendVideo(srcNode: any) {
  const store = useStageStore()
  const extract = createNodeAt('ComfyTV.VideoExtractFrameStage', posRightOf(srcNode))
  if (!extract) return
  const extractInSlot = findNamedSlot(extract, 'video')
  if (extractInSlot >= 0) srcNode.connect(0, extract, extractInSlot)
  stampLineage(srcNode, extract)

  const newVideo = createNodeAt('ComfyTV.VideoStage', posRightOf(extract))
  if (!newVideo) return
  const imageSlot = findFirstAutogrowSlot(newVideo, 'images')
  if (imageSlot >= 0) extract.connect(0, newVideo, imageSlot)
  stampLineage(srcNode, newVideo)

  store.notifyDownstream()
}


function spawnPanoramaView(srcNode: any, mode: 'current' | 'four' | 'twelve') {
  if (mode === 'current') {
    spawnConsumingNode(srcNode, 'ComfyTV.PanoramaCurrentViewStage', 'panorama')
    return
  }
  const node = spawnConsumingNode(srcNode, 'ComfyTV.PanoramaMultiViewStage', 'panorama')
  if (!node) return
  setWidget(node, 'view_count', mode === 'four' ? 4 : 12)
}

type SpawnHandler = (srcNode: any, context?: ImagePickContext) => void

function makeImageActionHandlers(srcSlot: number): Record<string, SpawnHandler> {
  return {
    'panorama':   src => spawnConsumingNode(src, 'ComfyTV.PanoramaStage',   'image', srcSlot),
    'multiangle': src => spawnConsumingNode(src, 'ComfyTV.MultiangleStage', 'image', srcSlot),
    'relight':    src => spawnConsumingNode(src, 'ComfyTV.RelightStage',    'image', srcSlot),
    ...Object.fromEntries(
      IMAGE_VARIANT_PRESETS.map(p => [
        `preset:${p.id}`,
        (src: any) => spawnImagePreset(src, p, srcSlot),
      ]),
    ),
    ...Object.fromEntries(
      IMAGE_EDIT_PRESETS.map(p => [
        `edit:${p.id}`,
        (src: any) => spawnImagePreset(src, p, srcSlot),
      ]),
    ),
  }
}

const imageActionHandlers      = makeImageActionHandlers(0)
const imageBatchActionHandlers = makeImageActionHandlers(1)

const SPAWN_HANDLERS: Partial<Record<StageKind, Record<string, SpawnHandler>>> = {
  image: imageActionHandlers,
  'image-picker': imageActionHandlers,
  'image-batch': imageBatchActionHandlers,
  video: {
    'extend': src => spawnExtendVideo(src),
    ...Object.fromEntries(
      VIDEO_CHANGE_PRESETS.map(p => [
        `change:${p.id}`,
        (src: any) => spawnImagePreset(src, p),
      ]),
    ),
  },
  panorama: {
    'view-current': src => spawnPanoramaView(src, 'current'),
    'view-four':    src => spawnPanoramaView(src, 'four'),
    'view-twelve':  src => spawnPanoramaView(src, 'twelve'),
  },
}

function spawnFollowUpStage(
  srcNode: any,
  srcKind: StageKind,
  actionId: string,
  context?: ImagePickContext,
) {
  const handler = SPAWN_HANDLERS[srcKind]?.[actionId]
  if (handler) {
    handler(srcNode, context)
    return
  }

  const targetClass = STAGE_CLASS_BY_KIND[srcKind]
  const targetGroup = TARGET_GROUP_BY_KIND[srcKind]

  const newNode = createNodeAt(targetClass, posRightOf(srcNode))
  if (!newNode) return

  const targetSlot = findFirstAutogrowSlot(newNode, targetGroup)
  if (targetSlot < 0) {
    console.warn('[ComfyTV/action] no autogrow slot for', targetGroup,
                 'on new', targetClass,
                 'inputs=', newNode.inputs?.map((i: any) => i.name))
    return
  }
  srcNode.connect(0, newNode, targetSlot)
  stampLineage(srcNode, newNode)
}

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

  if (variant === 'generator') {
    const promptWidget = node.widgets?.find((w: any) => w.name === 'main_prompt')
    if (promptWidget) {
      state.mainPrompt = String(promptWidget.value ?? '')
      promptWidget.callback = useChainCallback(promptWidget.callback, () => {
        state.mainPrompt = String(promptWidget.value ?? '')
      })
    }

    if (kind === 'image-picker' || kind === 'image-batch') {
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

    if (kind === 'image-picker') {
      // Restore the accumulated pool persisted on the node (survives save/reload).
      const poolWidget = node.widgets?.find((w: any) => w.name === 'pool')
      state.pool = poolWidget ? (String(poolWidget.value ?? '') || null) : null
    }
  } else if (variant === 'loader') {
    const widgetName = kind === 'image' ? 'image'
                     : kind === 'video' ? 'video'
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

  const refresh = () => store.refreshStageInputs(node, state, app as any)

  const reValidate = () => {
    validateWorkflowInputs(node, kind).then((map: SlotWarningMap) => {
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
      })
      if (workflowKind) addWorkflowUploadButton(node, wfWidget, workflowKind)
    }
    queueMicrotask(triggerPrepForCurrentWorkflow)
  }

  node.onConnectionsChange = useChainCallback(node.onConnectionsChange, () => {
    queueMicrotask(refresh)
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

  const stopPickerWatch = kind === 'image-picker'
    ? watch(
        () => {
          const inp = state.inputs.find(i => i.slot === 'batch')
          return [inp?.source ?? '', inp?.content ?? '', state.pickedIndex ?? 0] as const
        },
        () => {
          const inp = state.inputs.find(i => i.slot === 'batch')

          if (inp && inp.source === 'upstream' && inp.content) {
            const before = imagePoolCount(state.pool)
            const merged = mergeImagePool(state.pool, inp.content)
            store.setPickerPool(node, state, merged)
            const added = imagePoolCount(merged) - before
            if (added > 0 && before > 0 && (state.pickedIndex ?? 0) >= 1) {
              const shifted = (state.pickedIndex ?? 1) + added
              state.pickedIndex = shifted
              setWidget(node, 'selected_index', shifted)
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
        summary: 'Workflow preparing',
        detail: 'Hang on — converting workflow to api JSON. Try Run again in a moment.',
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

    state.running = true
    try {
      const a = app as any
      const reachable = collectReachableNodeIds(a, node)
      const pm = await buildScopedPrompt(a, reachable)

      const targetId = String(node.id)
      const myInputs = pm?.output?.[targetId]?.inputs
      const isBridgeIn = typeof node?.comfyClass === 'string'
                         && node.comfyClass.startsWith('ComfyTV.BridgeTo')
      const missingUpstream: string[] = []
      if (myInputs) {
        for (const key of Object.keys(myInputs)) {
          const val = myInputs[key]
          if (!Array.isArray(val) || val.length !== 2) continue
          const upstreamId = val[0]
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
            myInputs[key] = snapshot
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
        const msg =
          `Upstream not ready: ${list}. ` +
          `Run those stage(s) first so they produce a snapshot, then Run this stage again.`
        console.warn(`[ComfyTV/stage] ${msg}`)
        ;(app as any)?.extensionManager?.toast?.add?.({
          severity: 'warn',
          summary: 'Upstream not ready',
          detail: msg,
          life: 6000,
        })
        state.running = false
        return
      }

      const entries = useEntryStore()
      const pid = useProjectStore().currentProjectId || ''
      for (const inputs of Object.values(pm?.output ?? {})) {
        const obj = (inputs as any)?.inputs
        if (!obj) continue
        const mp = obj.main_prompt
        if (typeof mp === 'string' && mp.includes('@')) {
          obj.main_prompt = entries.expand(pid, mp)
        }
      }
      const queueResp = await a.api.queuePrompt(0, pm, { partialExecutionTargets: [targetId] })
      runningPromptId = queueResp?.prompt_id ? String(queueResp.prompt_id) : null
    } catch (e) {
      console.error('[ComfyTV/stage] queuePrompt failed', e)
      const err = extractRunError(e, node.id)
      store.applyExecutionError(state, err)
      runningPromptId = null
    }
  }

  const onCancelRequest = async () => {
    if (!state.running) return
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
    if (actionId === 'clear-pool' && kind === 'image-picker') {
      store.clearPickerPool(node, state)
      return
    }
    if (actionId === 'pick-item' && context && (kind === 'image-picker' || kind === 'image-batch')) {
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
      message: '已取消 / cancelled',
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
        message: 'Backend stopped without sending a result. The prompt worker likely died (CUDA OOM during cleanup is the usual cause). Restart ComfyUI to recover.',
        type: 'WorkerDied',
      })
      runningPromptId = null
    }, 3000)
  }

  const nodeRunHandlers = {
    getNodeId: () => String(node.id),
    onProgress,
    onProgressText,
    onError: onExecError,
    onInterrupted: onExecInterrupted,
    onSuccess: onExecSuccess,
    onStatus,
  }
  executionStore.registerNodeHandlers(nodeRunHandlers)

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
    if (kind === 'image-picker') return
    if (!node.id || node.id < 0) return
    const uid = ensureStageUid(node)
    try {
      let latest = await projectStore.fetchLatestOutput(projectId, uid)

      if (!latest && node.__comfytvFromSave && !adoptionTried) {
        adoptionTried = true
        latest = await projectStore.adoptOutputs(
          projectId, String(node.id), stageClassName(node), uid,
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
    store.unregisterStage(node)
  })

  return { state, onRunRequest, onCancelRequest, onDisconnect, onAction }
}
