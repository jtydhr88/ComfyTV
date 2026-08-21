
import { getActivePinia } from 'pinia'
import { createApp, markRaw, watch, type Component } from 'vue'

import FXChainStageCard from '@/components/stages/FXChainStageCard.vue'
import VideoColorStageCard from '@/components/stages/VideoColorStageCard.vue'
import VideoCurvesStageCard from '@/components/stages/VideoCurvesStageCard.vue'
import { useStageNode } from '@/composables/stages/useStageNode'
import { i18n, t } from '@/i18n'
import { type ComfyNode } from '@/lib/comfyApp'
import {
  bindNodeDrag,
  bindProgressRing,
  bindShellChrome,
  createNodeScope,
  ICON_GRIP,
  installV2ShellCss,
  RUN_BUTTON_HTML,
} from '@/v2/imageStageV2'
import { V2_SHELLS } from '@/v2/registry'
import CardEmbedV2 from '@/v2/CardEmbedV2.vue'
import ServerSelectV2 from '@/v2/ServerSelectV2.vue'
import type { StageKind, StageVariant } from '@/stores/stageStore'

const ICON_COLOR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 010 18c-1.5 0-2-1-1.3-2.2.8-1.4-.2-2.8-1.9-2.8H7a4 4 0 01-4-4"/><circle cx="8" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="13" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="17" cy="11" r="1.2" fill="currentColor" stroke="none"/></svg>`
const ICON_CURVE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20C10 20 14 4 20 4"/><path d="M4 20V4M4 20h16"/></svg>`
const ICON_CHAIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="5" height="5" rx="1.2"/><rect x="16" y="6" width="5" height="5" rx="1.2"/><rect x="9.5" y="14" width="5" height="5" rx="1.2"/><path d="M8 8.5h8M5.5 11v3.5a2 2 0 002 2h2M18.5 11v3.5a2 2 0 01-2 2h-2"/></svg>`

interface FxShellConfig {
  titleKey: string
  icon: string
  card: Component
  hasRun: boolean
}

const CONFIGS: Record<string, FxShellConfig> = {
  'ComfyTV.VideoColorStage': {
    titleKey: 'v2.videoColorTitle', icon: ICON_COLOR,
    card: markRaw(VideoColorStageCard), hasRun: false,
  },
  'ComfyTV.VideoCurvesStage': {
    titleKey: 'v2.videoCurvesTitle', icon: ICON_CURVE,
    card: markRaw(VideoCurvesStageCard), hasRun: false,
  },
  'ComfyTV.FXChainStage': {
    titleKey: 'v2.fxChainTitle', icon: ICON_CHAIN,
    card: markRaw(FXChainStageCard), hasRun: true,
  },
}

const FX_CSS = `
.v2-fx-card {
  background: #1e1e23;
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 16px;
  padding: 0 8px 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,.4);
  box-sizing: border-box;
}
.v2-fx-footer {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding: 9px 14px;
  border-radius: 14px;
  background: #232327;
  border: 1px solid rgba(255,255,255,.05);
  color: #8f8f98;
  font: 500 11px/1 system-ui, sans-serif;
}
.v2-fx-footer__spacer { flex: 1; }
`

let extraCssInstalled = false
function installCss() {
  installV2ShellCss()
  if (extraCssInstalled) return
  extraCssInstalled = true
  const style = document.createElement('style')
  style.textContent = FX_CSS
  document.head.appendChild(style)
}

function el(tag: string, cls: string, html?: string) {
  const e = document.createElement(tag)
  e.className = cls
  if (html != null) e.innerHTML = html
  return e
}

function attach(node: ComfyNode, kind: StageKind, variant: StageVariant, config: FxShellConfig) {
  installCss()
  const anyNode = node as any

  const card = el('div', 'v2-card v2-fx-card')
  const handle = el('div', 'v2-label v2-handle',
    `${ICON_GRIP}${config.icon}<span>${t(config.titleKey)}</span>`)
  card.appendChild(handle)
  bindNodeDrag(node, handle)

  const embedAnchor = el('div', 'v2-fx-host')
  embedAnchor.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;'
  card.appendChild(embedAnchor)

  let run: HTMLButtonElement | null = null
  let serverAnchor: HTMLElement | null = null
  if (config.hasRun) {
    const footer = el('div', 'v2-fx-footer')
    const label = el('div', '', t('v2.renderChain'))
    const spacer = el('div', 'v2-fx-footer__spacer')
    serverAnchor = el('div', 'v2-fx-footer__server')
    run = el('button', 'v2-run', RUN_BUTTON_HTML) as HTMLButtonElement
    footer.append(label, spacer, serverAnchor, run)
    card.appendChild(footer)
  }

  node.addDOMWidget('v2_shell', 'v2', card, {
    getMinHeight: () => 360,
    hideOnZoom: false,
    serialize: false,
  })

  const [w0, h0] = node.size
  node.setSize([Math.max(w0, 340), Math.max(h0, 460)])

  const stageApi = useStageNode(node as any, kind, variant)
  const { state: stageState, onRunRequest, onCancelRequest, onDisconnect, onAction } = stageApi
  const scope = createNodeScope(node)
  scope.run(() => bindProgressRing(card, stageState))

  const pinia = getActivePinia()
  let mountedApps: Array<ReturnType<typeof createApp>> = []
  const mountApps = () => {
    for (const a of mountedApps) a.unmount()
    mountedApps = []
    const specs: Array<[unknown, Record<string, unknown>, HTMLElement]> = [
      [CardEmbedV2, {
        card: config.card, node, state: stageState,
        onRunRequest, onCancelRequest, onDisconnect, onAction,
      }, embedAnchor],
    ]
    if (serverAnchor) {
      specs.push([ServerSelectV2, { getNode: () => node, state: stageState }, serverAnchor])
    }
    for (const [comp, props, anchor] of specs) {
      const a = createApp(comp as any, props)
      if (pinia) a.use(pinia)
      a.use(i18n)
      a.mount(anchor)
      mountedApps.push(a)
    }
  }
  mountApps()

  const prevConfigure = anyNode.onConfigure
  anyNode.onConfigure = function (...args: unknown[]) {
    prevConfigure?.apply(this, args)
    queueMicrotask(mountApps)
  }

  if (run) {
    const runBtn = run
    scope.run(() => {
      watch(() => stageState.running, (v) => {
        runBtn.dataset.busy = v ? '1' : ''
      })
    })
    runBtn.addEventListener('pointerdown', (e) => e.stopPropagation())
    runBtn.addEventListener('click', (ev) => {
      ev.stopPropagation()
      if (stageState.running) void onCancelRequest()
      else void onRunRequest()
    })
  }

  bindShellChrome(node, {
    scope, card, socketAnchor: embedAnchor, socketY: { frac: 0.3, cap: 160 },
  })

  const prevRemoved = anyNode.onRemoved
  anyNode.onRemoved = function (...args: unknown[]) {
    for (const a of mountedApps) a.unmount()
    mountedApps = []
    prevRemoved?.apply(this, args)
  }

  return stageApi
}

for (const [cls, config] of Object.entries(CONFIGS)) {
  V2_SHELLS[cls] = (node, kind, variant) => attach(node, kind, variant, config)
}
