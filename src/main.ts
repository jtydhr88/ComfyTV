import { createApp } from 'vue'
import { createPinia, getActivePinia, setActivePinia } from 'pinia'

import WorkflowConfigSidebar from '@/components/sidebar/WorkflowConfigSidebar.vue'
import StageCard from '@/components/stages/StageCard.vue'
import MultiangleStageCard from '@/components/stages/MultiangleStageCard.vue'
import PainterStageCard from '@/components/stages/PainterStageCard.vue'
import CropStageCard from '@/components/stages/CropStageCard.vue'
import RotateStageCard from '@/components/stages/RotateStageCard.vue'
import MirrorStageCard from '@/components/stages/MirrorStageCard.vue'
import PanoramaStageCard from '@/components/stages/PanoramaStageCard.vue'
import PanoramaCurrentViewStageCard from '@/components/stages/PanoramaCurrentViewStageCard.vue'
import PanoramaMultiViewStageCard from '@/components/stages/PanoramaMultiViewStageCard.vue'
import CompareStageCard from '@/components/stages/CompareStageCard.vue'
import GridSplitStageCard from '@/components/stages/GridSplitStageCard.vue'
import DirectorTimelineStageCard from '@/components/stages/DirectorTimelineStageCard.vue'
import OutpaintStageCard from '@/components/stages/OutpaintStageCard.vue'
import StoryboardStageCard from '@/components/stages/StoryboardStageCard.vue'
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
import { i18n } from '@/i18n'

import './tailwind.css'
import './style.css'

import { app, type ComfyNode } from '@/lib/comfyApp'
import type { ComfyExtension, ComfyNodeDef } from '@comfyorg/comfyui-frontend-types'
import { applyHiddenWidgetFlags, getWidget } from '@/utils/widget'
import { checkThemeTokens } from '@/utils/devTokenCheck'

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
  'ComfyTV.InpaintStage':    PainterStageCard,
  'ComfyTV.EraseStage':      PainterStageCard,
  'ComfyTV.CropStage':       CropStageCard,
  'ComfyTV.RotateStage':     RotateStageCard,
  'ComfyTV.MirrorStage':     MirrorStageCard,
  'ComfyTV.PanoramaStage':            PanoramaStageCard,
  'ComfyTV.PanoramaCurrentViewStage': PanoramaCurrentViewStageCard,
  'ComfyTV.PanoramaMultiViewStage':   PanoramaMultiViewStageCard,
  'ComfyTV.CompareStage':             CompareStageCard,
  'ComfyTV.GridSplitStage':           GridSplitStageCard,
  'ComfyTV.DirectorTimelineStage':    DirectorTimelineStageCard,
  'ComfyTV.OutpaintStage':            OutpaintStageCard,
  'ComfyTV.StoryboardStage':          StoryboardStageCard,
}

const RICH_STAGE_MIN_HEIGHTS: Record<string, number> = {
  'ComfyTV.MultiangleStage': 640,
  'ComfyTV.InpaintStage':    640,
  'ComfyTV.EraseStage':      640,
  'ComfyTV.CropStage':       620,
  'ComfyTV.RotateStage':     560,
  'ComfyTV.MirrorStage':     520,
  'ComfyTV.PanoramaStage':            620,
  'ComfyTV.PanoramaCurrentViewStage': 640,
  'ComfyTV.PanoramaMultiViewStage':   480,
  'ComfyTV.CompareStage':             480,
  'ComfyTV.GridSplitStage':           560,
  'ComfyTV.OutpaintStage':            620,
}

function mountStage(node: ComfyNode, kind: StageKind, variant: StageVariant = 'generator') {
  const container = document.createElement('div')
  container.className = 'comfytv-root'
  const richMinHeight = RICH_STAGE_MIN_HEIGHTS[node.comfyClass]
  const floor = richMinHeight ?? 80
  Object.assign(container.style, {
    width: '100%', height: '100%',
    minHeight: `${floor}px`,
    overflow: 'auto',
    background: 'var(--comfy-input-bg, #1e1e1e)',
    color: 'var(--input-text, #e0e0e0)',
    fontSize: '12px',
  })

  const measuredMinHeight = () => {
    const inner = container.firstElementChild as HTMLElement | null
    return Math.max(floor, inner?.scrollHeight ?? 0)
  }

  node.addDOMWidget('comfytv_stage', 'stage', container, {
    getMinHeight: measuredMinHeight,
    hideOnZoom: false,
    serialize: false,
  })

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
      label: 'ComfyTV — open entry manager',
      function: () => {
        useDialogStore().show({
          title: 'ComfyTV Entries',
          component: EntryManagerPanel,
          width: '900px',
        })
      },
    },
  ],

  setup() {
    checkThemeTokens()
    const selection = useSelectionStore()
    const a = app as any

    try {
      const ComfyButton = (window as any).comfyAPI?.button?.ComfyButton
      const settingsGroup = (a.menu as any)?.settingsGroup
      if (ComfyButton && settingsGroup?.append) {
        settingsGroup.append(
          new ComfyButton({
            icon: 'at-sign',
            tooltip: 'ComfyTV — entries (fragments / characters / …)',
            content: 'ComfyTV',
            action: () => {
              useDialogStore().show({
                title: 'ComfyTV Entries',
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
      tooltip: 'Edit the selected stage node\'s workflow config',
      type:    'custom',
      render: (container: HTMLElement) => {
        if (sidebarApp) { sidebarApp.unmount(); sidebarApp = null }
        Object.assign(container.style, {
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        })
        sidebarApp = createApp(WorkflowConfigSidebar)
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
    const [w, h] = node.size
    node.setSize([Math.max(w, 320), Math.max(h, minH)])
  },
}

app.registerExtension(extension)
