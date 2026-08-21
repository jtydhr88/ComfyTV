
import { getActivePinia } from 'pinia'
import { createApp } from 'vue'

import { useStageNode } from '@/composables/stages/useStageNode'
import { i18n, t } from '@/i18n'
import { type ComfyNode } from '@/lib/comfyApp'
import { bindNodeDrag, bindProgressRing, bindShellChrome, createNodeScope, ICON_GRIP, installV2ShellCss } from '@/v2/imageStageV2'
import { V2_SHELLS } from '@/v2/registry'
import CropEditorV2 from '@/v2/CropEditorV2.vue'
import type { StageKind, StageVariant } from '@/stores/stageStore'

const CROP_CSS = `
.v2-crop-card {
  padding: 0 6px 6px !important;
  cursor: grab;
  border-radius: 14px;
}
.v2-crop-card:active { cursor: grabbing; }
.v2-crop-host { cursor: default; }
`

const ICON_CROP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2.5V16a2 2 0 002 2h13.5M2.5 6H16a2 2 0 012 2v13.5"/></svg>`

let extraCssInstalled = false
function installCss() {
  installV2ShellCss()
  if (extraCssInstalled) return
  extraCssInstalled = true
  const style = document.createElement('style')
  style.textContent = CROP_CSS
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

  const card = el('div', 'v2-card v2-crop-card')
  const label = el('div', 'v2-label v2-handle', `${ICON_GRIP}${ICON_CROP}<span>${t('v2.cropTitle')}</span>`)
  const editorAnchor = el('div', 'v2-crop-host')
  editorAnchor.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;'
  card.append(label, editorAnchor)

  node.addDOMWidget('v2_shell', 'v2', card, {
    getMinHeight: () => 300,
    hideOnZoom: false,
    serialize: false,
  })

  const [w0, h0] = node.size
  node.setSize([Math.max(w0, 320), Math.max(h0, 360)])

  const stageApi = useStageNode(node as any, kind, variant)
  const { state: stageState } = stageApi
  const scope = createNodeScope(node)
  scope.run(() => bindProgressRing(card, stageState))

  const pinia = getActivePinia()
  let editorApp: ReturnType<typeof createApp> | null = null
  const mountApps = () => {
    editorApp?.unmount()
    editorApp = createApp(CropEditorV2, { node, state: stageState })
    if (pinia) editorApp.use(pinia)
    editorApp.use(i18n)
    editorApp.mount(editorAnchor)
  }
  mountApps()

  const prevConfigure = anyNode.onConfigure
  anyNode.onConfigure = function (...args: unknown[]) {
    prevConfigure?.apply(this, args)
    queueMicrotask(mountApps)
  }

  bindNodeDrag(node, card)

  bindShellChrome(node, { scope, card, socketAnchor: editorAnchor })

  const prevRemoved = anyNode.onRemoved
  anyNode.onRemoved = function (...args: unknown[]) {
    editorApp?.unmount()
    prevRemoved?.apply(this, args)
  }

  return stageApi
}

V2_SHELLS['ComfyTV.CropStage'] = attach
