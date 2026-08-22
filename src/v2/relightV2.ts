import { markRaw } from 'vue'

import MainPromptInput from '@/components/stages/MainPromptInput.vue'
import StagePresetBar from '@/components/stages/StagePresetBar.vue'
import RelightStageCard from '@/components/stages/RelightStageCard.vue'
import { useStageNode } from '@/composables/stages/useStageNode'
import { t } from '@/i18n'
import { type ComfyNode } from '@/lib/comfyApp'
import { bindNodeDrag } from '@/v2/nodeDrag'
import { bindShellChrome } from '@/v2/shellChrome'
import { bindProgressRing, createNodeScope, ensureMinSize, ICON_GRIP } from '@/v2/shellCommon'
import { installV2ShellCss } from '@/v2/shellCss'
import { createIslandGroup } from '@/v2/islands'
import { V2_SHELLS } from '@/v2/registry'
import CardEmbedV2 from '@/v2/CardEmbedV2.vue'
import type { StageKind, StageVariant } from '@/stores/stageStore'

const RELIGHT_CSS = `
.v2-relight-card {
  background: #1e1e23;
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 16px;
  padding: 0 8px 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,.4);
  box-sizing: border-box;
}
.v2-relight-panel {
  flex: none;
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 14px;
  background: #232327;
  border: 1px solid rgba(255,255,255,.05);
}
.v2-relight-panel .comfytv-prompt-editor { min-height: 40px; font-size: 12px; }

.v2-relight-host .v2-fx-embed > div > div:first-child {
  height: auto;
  flex: 1 1 0%;
  min-height: 200px;
}
`

const ICON_LIGHT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2.5v3M4.9 4.9l2.1 2.1M2.5 12h3M19.1 4.9L17 7M21.5 12h-3"/><path d="M8.5 18a4.8 4.8 0 117 0v1.6a1 1 0 01-1 1h-5a1 1 0 01-1-1z"/></svg>`

let extraCssInstalled = false
function installCss() {
  installV2ShellCss()
  if (extraCssInstalled) return
  extraCssInstalled = true
  const style = document.createElement('style')
  style.textContent = RELIGHT_CSS
  document.head.appendChild(style)
}

function el(tag: string, cls: string, html?: string) {
  const e = document.createElement(tag)
  e.className = cls
  if (html != null) e.innerHTML = html
  return e
}

function attach(node: ComfyNode, kind: StageKind, variant: StageVariant) {
  installCss()
  const anyNode = node as any

  const card = el('div', 'v2-card v2-relight-card')
  const handle = el('div', 'v2-label v2-handle',
    `${ICON_GRIP}${ICON_LIGHT}<span>${t('v2.relightTitle')}</span>`)
  card.appendChild(handle)
  bindNodeDrag(node, handle)

  const embedAnchor = el('div', 'v2-relight-host')
  embedAnchor.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;'
  const panel = el('div', 'v2-relight-panel')
  const promptAnchor = el('div', 'v2-relight-prompt')
  const presetAnchor = el('div', 'v2-panel__presets')
  panel.append(promptAnchor, presetAnchor)
  card.append(embedAnchor, panel)

  node.addDOMWidget('v2_shell', 'v2', card, {
    getMinHeight: () => 560,
    hideOnZoom: false,
    serialize: false,
  })

  ensureMinSize(node, 380, 700)

  const stageApi = useStageNode(node as any, kind, variant)
  const { state: stageState, onRunRequest, onCancelRequest, onDisconnect, onAction } = stageApi
  const scope = createNodeScope(node)
  scope.run(() => bindProgressRing(card, stageState))

  const islands = createIslandGroup()
  const mountApps = () => {
    islands.unmountAll()
    islands.mount(embedAnchor, CardEmbedV2, {
      card: markRaw(RelightStageCard), node, state: stageState,
      onRunRequest, onCancelRequest, onDisconnect, onAction,
    })
    islands.mount(promptAnchor, MainPromptInput, { node })
    islands.mount(presetAnchor, StagePresetBar, { node })
  }
  mountApps()

  const prevConfigure = anyNode.onConfigure
  anyNode.onConfigure = function (...args: unknown[]) {
    prevConfigure?.apply(this, args)
    queueMicrotask(mountApps)
  }

  bindShellChrome(node, {
    scope, card, socketAnchor: embedAnchor, socketY: { frac: 0.3, cap: 200 }, state: stageState,
  })

  const prevRemoved = anyNode.onRemoved
  anyNode.onRemoved = function (...args: unknown[]) {
    islands.unmountAll()
    prevRemoved?.apply(this, args)
  }

  return stageApi
}

V2_SHELLS['ComfyTV.RelightStage'] = attach
