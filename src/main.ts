import { createApp } from 'vue'
import { createPinia, getActivePinia, setActivePinia } from 'pinia'

import ComfyTVSidebar from '@/components/sidebar/ComfyTVSidebar.vue'
import StageCard from '@/components/stages/StageCard.vue'
import MultiangleStageCard from '@/components/stages/MultiangleStageCard.vue'
import PainterStageCard from '@/components/stages/PainterStageCard.vue'
import RelightStageCard from '@/components/stages/RelightStageCard.vue'
import CropStageCard from '@/components/stages/CropStageCard.vue'
import VideoClipStageCard from '@/components/stages/VideoClipStageCard.vue'
import VideoCropStageCard from '@/components/stages/VideoCropStageCard.vue'
import VideoConcatStageCard from '@/components/stages/VideoConcatStageCard.vue'
import VideoSpeedStageCard from '@/components/stages/VideoSpeedStageCard.vue'
import VideoRotateStageCard from '@/components/stages/VideoRotateStageCard.vue'
import VideoSplitStageCard from '@/components/stages/VideoSplitStageCard.vue'
import VideoVolumeStageCard from '@/components/stages/VideoVolumeStageCard.vue'
import VideoMuxAudioStageCard from '@/components/stages/VideoMuxAudioStageCard.vue'
import VideoFramesStageCard from '@/components/stages/VideoFramesStageCard.vue'
import VideoResizeStageCard from '@/components/stages/VideoResizeStageCard.vue'
import RotateStageCard from '@/components/stages/RotateStageCard.vue'
import MirrorStageCard from '@/components/stages/MirrorStageCard.vue'
import ColorGradeStageCard from '@/components/stages/ColorGradeStageCard.vue'
import PanoramaStageCard from '@/components/stages/PanoramaStageCard.vue'
import PanoramaCurrentViewStageCard from '@/components/stages/PanoramaCurrentViewStageCard.vue'
import PanoramaMultiViewStageCard from '@/components/stages/PanoramaMultiViewStageCard.vue'
import CompareStageCard from '@/components/stages/CompareStageCard.vue'
import AssetLoaderCard from '@/components/stages/AssetLoaderCard.vue'
import ModelLoaderCard from '@/components/stages/ModelLoaderCard.vue'
import MeshOpStageCard from '@/components/stages/MeshOpStageCard.vue'
import MeshBooleanStageCard from '@/components/stages/MeshBooleanStageCard.vue'
import GridSplitStageCard from '@/components/stages/GridSplitStageCard.vue'
import DirectorTimelineStageCard from '@/components/stages/DirectorTimelineStageCard.vue'
import OutpaintStageCard from '@/components/stages/OutpaintStageCard.vue'
import StoryboardStageCard from '@/components/stages/StoryboardStageCard.vue'
import Scene3DStageCard from '@/components/stages/Scene3DStageCard.vue'
import LayerEditorStageCard from '@/components/stages/LayerEditorStageCard.vue'
import MaterialStageCard from '@/components/stages/MaterialStageCard.vue'
import SplitPartStageCard from '@/components/stages/SplitPartStageCard.vue'
import ProjectCard from '@/components/stages/ProjectCard.vue'
import ComfyTVMountHost from '@/components/ComfyTVMountHost.vue'
import { registerMount, unregisterMount } from '@/composables/stages/widgetMounts'
import { useStageNode } from '@/composables/stages/useStageNode'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import {
  loadStageMeta,
  getStageMeta,
  isStageKind,
} from '@/composables/stages/stageMeta'
import { useStageStore, type StageKind, type StageVariant } from '@/stores/stageStore'
import { useProjectStore } from '@/stores/projectStore'
import { useEntryStore } from '@/stores/entryStore'
import { useDialogStore } from '@/stores/dialogStore'
import EntryManagerPanel from '@/components/dialog/EntryManagerPanel.vue'
import { useExecutionStore } from '@/stores/executionStore'
import { useSelectionStore } from '@/stores/selectionStore'
import { installAssetCanvasDrop } from '@/composables/sidebar/assetCanvasDrop'
import { i18n } from '@/i18n'

import './tailwind.css'
import './style.css'

import { app, type ComfyNode } from '@/lib/comfyApp'
import {
  isHeadlessConvertMode,
  runHeadlessConvertWorker,
} from '@/composables/stages/headlessConvert'
import type { ComfyExtension, ComfyNodeDef } from '@comfyorg/comfyui-frontend-types'
import { applyHiddenWidgetFlags, getWidget } from '@/utils/widget'
import { checkThemeTokens } from '@/utils/devTokenCheck'
import { installGlobalRunBridge } from '@/utils/globalRunBridge'

;(window as any).__comfytv_host_pinia = getActivePinia()

const pinia = createPinia()
setActivePinia(pinia)

loadStageMeta()

useExecutionStore().bindToApi(app.api)

let mountKeySeq = 0

;(function mountHost() {
  const host = document.createElement('div')
  host.className = 'comfytv-status-host'
  document.body.appendChild(host)
  const hostApp = createApp(ComfyTVMountHost)
  hostApp.use(pinia)
  hostApp.use(i18n)
  hostApp.mount(host)
})()

const RICH_STAGE_CARDS: Record<string, any> = {
  'ComfyTV.MultiangleStage': MultiangleStageCard,
  'ComfyTV.RelightStage':    RelightStageCard,
  'ComfyTV.InpaintStage':    PainterStageCard,
  'ComfyTV.EraseStage':      PainterStageCard,
  'ComfyTV.CropStage':       CropStageCard,
  'ComfyTV.VideoClipStage':  VideoClipStageCard,
  'ComfyTV.VideoCropStage':  VideoCropStageCard,
  'ComfyTV.VideoConcatStage': VideoConcatStageCard,
  'ComfyTV.VideoSpeedStage':  VideoSpeedStageCard,
  'ComfyTV.VideoRotateStage': VideoRotateStageCard,
  'ComfyTV.VideoSplitStage':  VideoSplitStageCard,
  'ComfyTV.VideoVolumeStage': VideoVolumeStageCard,
  'ComfyTV.VideoMuxAudioStage': VideoMuxAudioStageCard,
  'ComfyTV.VideoFramesStage': VideoFramesStageCard,
  'ComfyTV.VideoResizeStage': VideoResizeStageCard,
  'ComfyTV.RotateStage':     RotateStageCard,
  'ComfyTV.MirrorStage':     MirrorStageCard,
  'ComfyTV.ColorGradeStage': ColorGradeStageCard,
  'ComfyTV.PanoramaStage':            PanoramaStageCard,
  'ComfyTV.PanoramaCurrentViewStage': PanoramaCurrentViewStageCard,
  'ComfyTV.PanoramaMultiViewStage':   PanoramaMultiViewStageCard,
  'ComfyTV.CompareStage':             CompareStageCard,
  'ComfyTV.AssetImageLoaderStage':    AssetLoaderCard,
  'ComfyTV.AssetVideoLoaderStage':    AssetLoaderCard,
  'ComfyTV.AssetAudioLoaderStage':    AssetLoaderCard,
  'ComfyTV.AssetModelLoaderStage':    AssetLoaderCard,
  'ComfyTV.ModelLoaderStage':         ModelLoaderCard,
  'ComfyTV.MeshOpStage':              MeshOpStageCard,
  'ComfyTV.MeshBakeMapsStage':        MeshOpStageCard,
  'ComfyTV.MeshPrimitiveStage':       MeshOpStageCard,
  'ComfyTV.MeshBooleanStage':         MeshBooleanStageCard,
  'ComfyTV.GridSplitStage':           GridSplitStageCard,
  'ComfyTV.DirectorTimelineStage':    DirectorTimelineStageCard,
  'ComfyTV.OutpaintStage':            OutpaintStageCard,
  'ComfyTV.StoryboardStage':          StoryboardStageCard,
  'ComfyTV.Scene3DStage':             Scene3DStageCard,
  'ComfyTV.LayerEditorStage':         LayerEditorStageCard,
  'ComfyTV.MaterialStage':            MaterialStageCard,
  'ComfyTV.SplitPartStage':           SplitPartStageCard,
}

const RICH_STAGE_MIN_HEIGHTS: Record<string, number> = {
  'ComfyTV.MultiangleStage': 640,
  'ComfyTV.RelightStage':    640,
  'ComfyTV.InpaintStage':    640,
  'ComfyTV.EraseStage':      640,
  'ComfyTV.CropStage':       620,
  'ComfyTV.VideoClipStage':  680,
  'ComfyTV.VideoCropStage':  700,
  'ComfyTV.VideoConcatStage': 560,
  'ComfyTV.VideoSpeedStage':  620,
  'ComfyTV.VideoRotateStage': 600,
  'ComfyTV.VideoSplitStage':  680,
  'ComfyTV.VideoVolumeStage': 620,
  'ComfyTV.VideoMuxAudioStage': 620,
  'ComfyTV.VideoFramesStage': 700,
  'ComfyTV.VideoResizeStage': 620,
  'ComfyTV.RotateStage':     560,
  'ComfyTV.MirrorStage':     520,
  'ComfyTV.ColorGradeStage': 680,
  'ComfyTV.PanoramaStage':            620,
  'ComfyTV.PanoramaCurrentViewStage': 640,
  'ComfyTV.PanoramaMultiViewStage':   480,
  'ComfyTV.CompareStage':             480,
  'ComfyTV.AssetImageLoaderStage':    420,
  'ComfyTV.AssetVideoLoaderStage':    420,
  'ComfyTV.AssetAudioLoaderStage':    420,
  'ComfyTV.AssetModelLoaderStage':    620,
  'ComfyTV.Model3DStage':             560,
  'ComfyTV.ModelLoaderStage':         760,
  'ComfyTV.MeshOpStage':              720,
  'ComfyTV.MeshBakeMapsStage':        720,
  'ComfyTV.MeshPrimitiveStage':       620,
  'ComfyTV.MeshBooleanStage':         760,
  'ComfyTV.GridSplitStage':           560,
  'ComfyTV.OutpaintStage':            620,
  'ComfyTV.Scene3DStage':             640,
  'ComfyTV.LayerEditorStage':         680,
  'ComfyTV.MaterialStage':            600,
  'ComfyTV.SplitPartStage':           720,
}

const RICH_STAGE_MIN_WIDTHS: Record<string, number> = {
  'ComfyTV.Scene3DStage': 960,
  'ComfyTV.LayerEditorStage': 960,
}

const GENERIC_STAGE_MIN_HEIGHT = 380
const TEXT_PREVIEW_WIDGET_NAME = '$$node-text-preview'
const TEXT_PREVIEW_MAX_HEIGHT = 120

function capTextPreviewWidget(w: any) {
  if (w?.name !== TEXT_PREVIEW_WIDGET_NAME) return
  if (w.options && !w.options.getMaxHeight) {
    w.options.getMaxHeight = () => TEXT_PREVIEW_MAX_HEIGHT
  }
}

function installTextPreviewCap(node: ComfyNode) {
  node.widgets?.forEach(capTextPreviewWidget)
  const anyNode = node as any
  const orig = anyNode.addCustomWidget?.bind(node)
  if (!orig) return
  anyNode.addCustomWidget = (w: any) => {
    const added = orig(w)
    capTextPreviewWidget(added ?? w)
    return added
  }
}

function mountStage(node: ComfyNode, kind: StageKind, variant: StageVariant = 'generator') {
  const container = document.createElement('div')
  container.className = 'comfytv-root'
  const richMinHeight = RICH_STAGE_MIN_HEIGHTS[node.comfyClass]
  const floor = richMinHeight ?? 80
  const lgMinHeight = richMinHeight ?? GENERIC_STAGE_MIN_HEIGHT
  Object.assign(container.style, {
    width: '100%', height: '100%',
    minHeight: `${floor}px`,
    overflow: 'auto',
    background: 'var(--comfy-input-bg, #1e1e1e)',
    color: 'var(--input-text, #e0e0e0)',
    fontSize: '12px',
  })

  node.addDOMWidget('comfytv_stage', 'stage', container, {
    getMinHeight: () => lgMinHeight,
    hideOnZoom: false,
    serialize: false,
  })

  installTextPreviewCap(node)

  const { state, onRunRequest, onCancelRequest, onDisconnect, onAction } = useStageNode(node, kind, variant)

  const Card = RICH_STAGE_CARDS[node.comfyClass] ?? StageCard
  const props: any = { state, node, onRunRequest, onCancelRequest, onDisconnect, onAction }

  const mountKey = `stage-${mountKeySeq++}`
  registerMount(mountKey, container, Card, props)

  node.onRemoved = useChainCallback(node.onRemoved, () => {
    unregisterMount(mountKey)
  })
}

function mountProjectStage(node: ComfyNode) {
  const container = document.createElement('div')
  container.className = 'comfytv-root'
  Object.assign(container.style, {
    width: '100%', height: '100%', minHeight: '120px',
    background: 'var(--comfy-input-bg, #1e1e1e)',
    color: 'var(--input-text, #e0e0e0)',
    fontSize: '12px',
  })

  node.addDOMWidget('comfytv_project', 'project', container, {
    getMinHeight: () => 140,
    hideOnZoom: false,
    serialize: false,
  })

  const mountKey = `project-${mountKeySeq++}`
  registerMount(mountKey, container, ProjectCard, {})

  const store = useProjectStore()
  const idWidget   = getWidget(node, 'project_id')
  const nameWidget = getWidget(node, 'project_name')

  if (idWidget?.value && typeof idWidget.value === 'string') {
    store.setCurrent(idWidget.value)
  }

  const stopProjectSync = (function () {
    return store.$subscribe(() => {
      if (idWidget)   idWidget.value   = store.currentProjectId
      if (nameWidget) nameWidget.value = store.current?.name ?? ''
    })
  })()

  if (idWidget) {
    idWidget.callback = useChainCallback(idWidget.callback, () => {
      if (idWidget.value) store.setCurrent(String(idWidget.value))
    })
  }

  node.onRemoved = useChainCallback(node.onRemoved, () => {
    stopProjectSync()
    unregisterMount(mountKey)
  })
}

const extension: ComfyExtension = {
  name: 'ComfyTV',

  commands: [
    {
      id: 'ComfyTV.openEntryManager',
      label: i18n.global.t('menu.openEntryManager'),
      function: () => {
        useDialogStore().show({
          title: i18n.global.t('menu.entriesTitle'),
          component: EntryManagerPanel,
          width: '480px',
        })
      },
    },
  ],

  setup() {
    if (isHeadlessConvertMode()) {
      console.info('[ComfyTV] headless convert mode — UI init skipped')
      runHeadlessConvertWorker()
      return
    }

    checkThemeTokens()
    const selection = useSelectionStore()
    const a = app as any

    installAssetCanvasDrop(pinia)

    installGlobalRunBridge(a, {
      resolveStore: () => useStageStore(pinia),
      toast: (opts) => a.extensionManager?.toast?.add?.(opts),
      t: (key, params) => i18n.global.t(key, params ?? {}),
    })

    try {
      const ComfyButton = (window as any).comfyAPI?.button?.ComfyButton
      const settingsGroup = (a.menu as any)?.settingsGroup
      if (ComfyButton && settingsGroup?.append) {
        settingsGroup.append(
          new ComfyButton({
            icon: 'at-sign',
            tooltip: i18n.global.t('menu.entriesButtonTooltip'),
            content: 'ComfyTV',
            action: () => {
              useDialogStore().show({
                title: i18n.global.t('menu.entriesTitle'),
                component: EntryManagerPanel,
                width: '900px',
              })
            },
          }),
        )
      }
    } catch (e) {
      console.warn('[ComfyTV] failed to add top-bar button', e)
    }

    useEntryStore().installWebSocketSync()

    try {
      a.api?.addEventListener?.('comfytv-toast', (event: any) => {
        const d = event?.detail ?? event ?? {}
        a.extensionManager?.toast?.add?.({
          severity: d.severity || 'warn',
          summary:  d.summary  || 'ComfyTV',
          detail:   d.detail   || '',
          life:     d.life     || 8000,
        })
      })
    } catch (e) {
      console.warn('[ComfyTV] toast listener install failed', e)
    }

    const hookSelection = () => {
      if (!a.canvas) { requestAnimationFrame(hookSelection); return }
      const prev = a.canvas.onSelectionChange
      a.canvas.onSelectionChange = function (this: any, ...args: unknown[]) {
        if (typeof prev === 'function') {
          try { prev.apply(this ?? a.canvas, args) } catch (e) {
            console.warn('[ComfyTV] prior onSelectionChange threw', e)
          }
        }
        selection.refreshFromCanvas()
      }
    }
    hookSelection()

    let sidebarApp: ReturnType<typeof createApp> | null = null
    a.extensionManager?.registerSidebarTab?.({
      id:      'comfytv-workflow-config',
      title:   'ComfyTV',
      icon:    'pi pi-sliders-h',
      tooltip: i18n.global.t('menu.configSidebarTooltip'),
      type:    'custom',
      render: (container: HTMLElement) => {
        if (sidebarApp) { sidebarApp.unmount(); sidebarApp = null }
        Object.assign(container.style, {
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        })
        sidebarApp = createApp(ComfyTVSidebar)
        sidebarApp.use(pinia)
        sidebarApp.use(i18n)
        sidebarApp.mount(container)
      },
      destroy: () => {
        sidebarApp?.unmount()
        sidebarApp = null
      },
    })
  },

  async beforeRegisterNodeDef(nodeType, nodeData: ComfyNodeDef) {
    const stages = await loadStageMeta()
    if (!stages.has(nodeData.name)) return  //
    if (nodeData.name === 'ComfyTV.ProjectStage') return
    const proto = nodeType.prototype as ComfyNode
    proto.onExecuted = useChainCallback(
      proto.onExecuted,
      function (this: ComfyNode, msg: unknown) {
        const store = useStageStore()
        const state = store.getStage(this)
        if (!state) return
        store.applyExecutedPayload(state, msg)
      },
    )
  },

  loadedGraphNode(node: ComfyNode) {
    ;(node as any).__comfytvFromSave = true
  },

  async nodeCreated(rawNode) {
    const node = rawNode as ComfyNode
    applyHiddenWidgetFlags(node)
    await loadStageMeta()
    const entry = getStageMeta(node.comfyClass)
    if (!entry) return
    if (entry.kind === 'project') {
      mountProjectStage(node)
      const [w, h] = node.size
      node.setSize([Math.max(w, 280), Math.max(h, 150)])
      return
    }

    if (!isStageKind(entry.kind)) {
      console.warn('[ComfyTV] unknown stage kind:', entry.kind, 'for', node.comfyClass)
      return
    }

    mountStage(node, entry.kind, (entry.variant ?? 'generator') as StageVariant)

    const richMin = RICH_STAGE_MIN_HEIGHTS[node.comfyClass]
    const minH = richMin ?? 140
    const minW = RICH_STAGE_MIN_WIDTHS[node.comfyClass] ?? 320
    const [w, h] = node.size
    node.setSize([Math.max(w, minW), Math.max(h, minH)])
  },
}

app.registerExtension(extension)
