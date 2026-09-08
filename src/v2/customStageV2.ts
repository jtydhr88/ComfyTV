import { h, ref, watch } from 'vue'

import { spawnFollowUpStage } from '@/composables/stages/spawnFollowUp'
import { useStageNode } from '@/composables/stages/useStageNode'
import { t } from '@/i18n'
import { type ComfyNode } from '@/lib/comfyApp'
import { batchImageUrls, type StageKind, type StageVariant, type TypedValueType } from '@/stores/stageStore'
import { useCustomIoStore } from '@/stores/customIoStore'
import MainPromptInput from '@/components/stages/MainPromptInput.vue'
import { addOptionEverywhere } from '@/composables/stages/workflowCombo'
import { writeWidget } from '@/utils/widget'
import RefChipsV2 from '@/v2/RefChipsV2.vue'
import { bindWidgetCallback, readWidgetStr } from '@/utils/widget'
import CustomInputsV2 from '@/v2/CustomInputsV2.vue'
import CustomIoPanelV2 from '@/v2/CustomIoPanelV2.vue'
import {
  type CustomIo, type OutputKind, OUTPUT_SLOTS, applySlotLabels, emptyCustomIo, exposedRefTypes, hasPromptInput, previewKindOf, primaryOutput,
} from '@/v2/customIo'
import FooterSelectsV2, { type FooterAction } from '@/v2/FooterSelectsV2.vue'
import { createIslandGroup } from '@/v2/islands'
import MediaPreviewV2 from '@/v2/MediaPreviewV2.vue'
import { bindNodeDrag } from '@/v2/nodeDrag'
import { attachOutputToolbar } from '@/v2/outputToolbar'
import { bindPanelCollapse, stageInfoLine } from '@/v2/panelCollapse'
import { V2_SHELLS } from '@/v2/registry'
import ServerSelectV2 from '@/v2/ServerSelectV2.vue'
import { bindShellChrome } from '@/v2/shellChrome'
import {
  bindProgressRing,
  bindPromptResize,
  createNodeScope,
  el,
  ensureMinSize,
  hideNativeWidgets,
  ICON_GRIP,
  RUN_BUTTON_HTML,
} from '@/v2/shellCommon'
import { installV2ShellCss } from '@/v2/shellCss'
import { bindWheelCapture } from '@/v2/wheelCapture'

const ICON_CUSTOM = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 10h18M9 10v10"/><circle cx="6" cy="7" r=".9" fill="currentColor"/></svg>`
const ICON_EXPOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h12M20 17h0"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="17" r="2"/></svg>`

const OUTPUT_TYPE: Record<OutputKind, TypedValueType> = {
  image: 'COMFYTV_IMAGE', images: 'COMFYTV_IMAGES', video: 'COMFYTV_VIDEO',
  audio: 'COMFYTV_AUDIO', text: 'COMFYTV_TEXT', model: 'COMFYTV_MODEL',
}
const TOOLBAR_KIND: Partial<Record<OutputKind, StageKind>> = {
  image: 'image', video: 'video', audio: 'audio',
}

function toolbarSource(io: CustomIo): { kind: StageKind; slot: OutputKind } | null {
  const pk = primaryOutput(io)?.kind
  if (!pk) return null
  if (pk === 'images') return io.outputs.some(o => o.kind === 'image') ? { kind: 'image', slot: 'image' } : null
  const kind = TOOLBAR_KIND[pk]
  return kind ? { kind, slot: pk } : null
}

const CUSTOM_CSS = `
.v2-cio-open { position: relative; }
.v2-cio-host:empty { display: none; }
`
let cssInstalled = false
function installCss() {
  installV2ShellCss()
  if (cssInstalled) return
  cssInstalled = true
  const style = document.createElement('style')
  style.textContent = CUSTOM_CSS
  document.head.appendChild(style)
}

function attach(node: ComfyNode, kind: StageKind, variant: StageVariant) {
  installCss()
  const anyNode = node as any
  const title = String((node.constructor as any)?.title ?? node.comfyClass ?? '')

  const card = el('div', 'v2-card v2-cio-open')
  bindWheelCapture(card)
  const handle = el('div', 'v2-label v2-handle', `${ICON_GRIP}${ICON_CUSTOM}<span>${title}</span>`)
  card.appendChild(handle)
  bindNodeDrag(node, handle)

  const preview = el('div', 'v2-preview')
  const mediaAnchor = el('div', 'v2-mp-host')
  mediaAnchor.style.cssText = 'position:absolute;inset:0;'
  const busy = el('div', 'v2-preview__busy',
    `<div class="v2-preview__spinner"></div><div class="v2-preview__busytext"><span></span><small></small></div>`)
  preview.append(mediaAnchor, busy)

  const panel = el('div', 'v2-panel')
  const refsAnchor = el('div', 'v2-panel__refs')
  const promptAnchor = el('div', 'v2-panel__prompthost')
  const inputsAnchor = el('div', 'v2-panel__custom')
  const footer = el('div', 'v2-panel__footer')
  const wfAnchor = el('div', 'v2-panel__selects')
  const serverAnchor = el('div', 'v2-panel__server')
  const run = el('button', 'v2-run', RUN_BUTTON_HTML) as HTMLButtonElement
  footer.append(wfAnchor, serverAnchor, run)
  panel.append(refsAnchor, promptAnchor, inputsAnchor, footer)
  const overlayHost = el('div', 'v2-cio-host')
  card.append(preview, panel, overlayHost)

  node.addDOMWidget('v2_shell', 'v2', card, {
    getMinHeight: () => 420,
    hideOnZoom: false,
    serialize: false,
  })
  ensureMinSize(node, 340, 480)

  const stageApi = useStageNode(node as any, kind, variant)
  const { state: stageState, onRunRequest, onCancelRequest } = stageApi
  const scope = createNodeScope(node)
  scope.run(() => bindProgressRing(card, stageState))

  const ioStore = useCustomIoStore()
  const io = ref<CustomIo>(emptyCustomIo())
  const label = ref(readWidgetStr(node, 'workflow', ''))
  const previewKind = ref<'image' | 'video' | 'audio' | 'text' | 'model'>('image')
  const panelOpen = ref(false)

  let toolbar: HTMLElement | null = null
  let toolbarKey = ''
  let toolbarSlot: OutputKind = 'image'
  const sourceNode = new Proxy(node as any, {
    get(target, key) {
      if (key === 'connect') {
        return (slot: number, ...rest: unknown[]) =>
          target.connect(slot === 0 ? OUTPUT_SLOTS.indexOf(toolbarSlot) : slot, ...rest)
      }
      const v = Reflect.get(target, key, target)
      return typeof v === 'function' ? v.bind(target) : v
    },
  })
  const onToolbarAction = (actionId: string, context?: unknown) => {
    const src = toolbarSource(io.value)
    if (!src) return
    spawnFollowUpStage(sourceNode, src.kind, actionId, context as any)
  }
  const syncToolbar = () => {
    const src = toolbarSource(io.value)
    const key = src ? `${src.kind}:${src.slot}` : ''
    if (key === toolbarKey) return
    toolbar?.remove()
    toolbar = null
    toolbarKey = key
    if (!src) return
    toolbarSlot = src.slot
    toolbar = attachOutputToolbar(node, card, src.kind, stageState, onToolbarAction)
  }

  const applyIo = (next: CustomIo) => {
    io.value = next
    applySlotLabels(node as any, next)
    const pk = primaryOutput(next)?.kind
    previewKind.value = previewKindOf(pk)
    stageState.outputType = pk ? OUTPUT_TYPE[pk] : 'COMFYTV_IMAGE'
    syncToolbar()
    anyNode.setDirtyCanvas?.(true, true)
  }

  const reload = async () => {
    const next = readWidgetStr(node, 'workflow', '')
    label.value = next
    if (!next) { applyIo(emptyCustomIo()); return }
    const e = await ioStore.load(next)
    if (readWidgetStr(node, 'workflow', '') === next) applyIo(e.io)
  }
  scope.run(() => {
    bindWidgetCallback(node, 'workflow', () => { queueMicrotask(reload) })
    watch(() => ioStore.entry(label.value).version, () => {
      if (label.value) applyIo(ioStore.entry(label.value).io)
    })
  })
  queueMicrotask(reload)

  const previewUrl = () => {
    const out = stageState.output
    if (!out) return null
    const pk = primaryOutput(io.value)?.kind
    if (pk === 'images') return batchImageUrls(out)[0] ?? null
    return out
  }

  const islands = createIslandGroup()
  const overlay = createIslandGroup()
  const closePanel = () => {
    panelOpen.value = false
    overlay.unmountAll()
  }
  const openPanel = () => {
    if (!label.value) return
    panelOpen.value = true
    ensureMinSize(node, 360, 560)
    overlay.unmountAll()
    overlay.mount(overlayHost, CustomIoPanelV2, {
      label: label.value,
      onClose: closePanel,
      onSaved: (next: CustomIo) => applyIo(next),
      onSavedAs: (newLabel: string, next: CustomIo) => {
        addOptionEverywhere('custom', newLabel)
        writeWidget(node, 'workflow', newLabel)
        applyIo(next)
      },
    })
  }
  const footerActions: FooterAction[] = [{
    id: 'expose',
    title: t('v2.custom.expose'),
    icon: ICON_EXPOSE,
    active: () => panelOpen.value,
    onClick: () => { if (panelOpen.value) closePanel(); else openPanel() },
  }]

  const mountApps = () => {
    islands.unmountAll()
    islands.mount(mediaAnchor, {
      render: () => h(MediaPreviewV2, {
        kind: previewKind.value,
        url: previewKind.value === 'text' ? null : previewUrl(),
        text: previewKind.value === 'text' ? stageState.output : null,
        hint: io.value.outputs.length ? t('v2.generatorHint') : t('v2.custom.hint'),
      }),
    })
    islands.mount(inputsAnchor, {
      render: () => h(CustomInputsV2, {
        node, state: stageState, io: io.value, hasWorkflow: !!label.value,
      }),
    })
    islands.mount(promptAnchor, {
      render: () => (hasPromptInput(io.value) ? h(MainPromptInput, { node }) : null),
    })
    islands.mount(refsAnchor, {
      render: () => {
        const types = exposedRefTypes(io.value)
        return types.length ? h(RefChipsV2, { key: types.join('+'), getNode: () => node, types }) : null
      },
    })
    islands.mountWhenVisible(card, wfAnchor, FooterSelectsV2 as any, {
      getNode: () => node, linkKind: 'custom', extra: [], actions: footerActions,
    })
    islands.mountWhenVisible(card, serverAnchor, ServerSelectV2 as any, {
      getNode: () => node, state: stageState,
    })
  }
  mountApps()

  const prevConfigure = anyNode.onConfigure
  anyNode.onConfigure = function (...args: unknown[]) {
    prevConfigure?.apply(this, args)
    queueMicrotask(() => { mountApps(); void reload() })
  }

  const busyPct = busy.querySelector('.v2-preview__busytext span') as HTMLElement
  const busyLabel = busy.querySelector('.v2-preview__busytext small') as HTMLElement
  scope.run(() => {
    watch(
      () => [stageState.running, stageState.progress?.value, stageState.progress?.max, stageState.progress?.text] as const,
      ([running, v, m, text]) => {
        run.dataset.busy = running ? '1' : ''
        busy.dataset.show = running ? '1' : ''
        const max = Number(m) || 0
        const p = running && max > 0 ? Math.min(1, Math.max(0, (Number(v) || 0) / max)) : 0
        busyPct.textContent = p > 0 ? `${Math.round(p * 100)}%` : ''
        busyLabel.textContent = running && text ? String(text) : ''
      },
      { immediate: true },
    )
  })

  run.addEventListener('pointerdown', (e) => e.stopPropagation())
  run.addEventListener('click', (ev) => {
    ev.stopPropagation()
    if (stageState.running) void onCancelRequest()
    else void onRunRequest()
  })

  bindNodeDrag(node, preview)
  bindShellChrome(node, {
    scope, card, socketAnchor: preview, state: stageState,
    media: { source: 'batch' },
    lod: true,
  })
  bindPromptResize(node, promptAnchor, scope)
  bindPanelCollapse(node, {
    scope, panel, footer, run,
    info: () => stageInfoLine(node, stageState),
  })

  const prevRemoved = anyNode.onRemoved
  anyNode.onRemoved = function (...args: unknown[]) {
    overlay.unmountAll()
    islands.unmountAll()
    prevRemoved?.apply(this, args)
  }

  hideNativeWidgets(node)
  return stageApi
}

V2_SHELLS['ComfyTV.CustomStage'] = attach
