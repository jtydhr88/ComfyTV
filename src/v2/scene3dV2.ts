
import { markRaw } from 'vue'

import Scene3DStageCard from '@/components/stages/Scene3DStageCard.vue'
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

const SCENE_CSS = `
.v2-scene-card {
  background: var(--v2-card-bg);
  border: 1px solid var(--v2-card-border);
  border-radius: 16px;
  padding: 0 8px 8px;
  box-shadow: var(--v2-slab-shadow);
  box-sizing: border-box;
}
`

const ICON_SCENE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2.5l8 4.5v9l-8 4.5-8-4.5V7z"/><path d="M12 11.5L4 7M12 11.5l8-4.5M12 11.5V21"/></svg>`

let extraCssInstalled = false
function installCss() {
  installV2ShellCss()
  if (extraCssInstalled) return
  extraCssInstalled = true
  const style = document.createElement('style')
  style.textContent = SCENE_CSS
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

  const card = el('div', 'v2-card v2-scene-card')
  const handle = el('div', 'v2-label v2-handle',
    `${ICON_GRIP}${ICON_SCENE}<span>${t('v2.scene3dTitle')}</span>`)
  card.appendChild(handle)
  bindNodeDrag(node, handle)

  const embedAnchor = el('div', 'v2-scene-host')
  embedAnchor.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;'
  card.appendChild(embedAnchor)

  node.addDOMWidget('v2_shell', 'v2', card, {
    getMinHeight: () => 520,
    hideOnZoom: false,
    serialize: false,
  })

  ensureMinSize(node, 620, 700)

  const stageApi = useStageNode(node as any, kind, variant)
  const { state: stageState, onRunRequest, onCancelRequest, onDisconnect, onAction } = stageApi
  const scope = createNodeScope(node)
  scope.run(() => bindProgressRing(card, stageState))

  const islands = createIslandGroup()
  const mountApps = () => {
    islands.unmountAll()
    islands.mount(embedAnchor, CardEmbedV2, {
      card: markRaw(Scene3DStageCard), node, state: stageState,
      onRunRequest, onCancelRequest, onDisconnect, onAction,
    })
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

V2_SHELLS['ComfyTV.Scene3DStage'] = attach
