import { useTimeoutFn } from '@vueuse/core'
import { h, markRaw, watch, type Component } from 'vue'

import FxChainCardV2 from '@/v2/FxChainCardV2.vue'
import VideoColorStageCard from '@/components/stages/VideoColorStageCard.vue'
import VideoCurvesStageCard from '@/components/stages/VideoCurvesStageCard.vue'
import { useStageNode } from '@/composables/stages/useStageNode'
import { t } from '@/i18n'
import { app, type ComfyNode } from '@/lib/comfyApp'
import {
  bindNodeDrag,
  bindProgressRing,
  bindShellChrome,
  createNodeScope,
  ensureMinSize,
  ICON_GRIP,
  installV2ShellCss,
  RUN_BUTTON_HTML,
} from '@/v2/imageStageV2'
import { V2_SHELLS } from '@/v2/registry'
import { createIslandGroup } from '@/v2/islands'
import CardEmbedV2 from '@/v2/CardEmbedV2.vue'
import StagePresetBar from '@/components/stages/StagePresetBar.vue'
import MediaPreviewV2 from '@/v2/MediaPreviewV2.vue'
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
  embed?: boolean
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
    card: markRaw(FxChainCardV2), hasRun: true, embed: false,
  },
}

const FX_CSS = `
.v2-fx-host .v2-fx-embed > div > :first-child {
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(160deg, #23232a 0%, #1a1a20 100%);
  border: 1px solid rgba(255,255,255,.07);
  min-height: 150px;
}
.v2-fx-host .v2-fx-embed > div > :nth-child(2) {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background: #232327;
  border: 1px solid rgba(255,255,255,.05);
  box-shadow: 0 8px 24px rgba(0,0,0,.4);
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
.v2-fx-presets { flex: none; margin-top: 10px; }
.v2-fx-footer__spacer { flex: 1; }
.v2-fx-output {
  display: none;
  flex: none;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}
.v2-fx-output[data-show="1"] { display: flex; }
.v2-fx-output__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
  color: #8f8f98;
  font: 500 11px/1 system-ui, sans-serif;
}
.v2-fx-output__spacer { flex: 1; }
.v2-fx-output__btn {
  flex: none;
  display: flex;
  align-items: center;
  gap: 5px;
  border: none;
  padding: 5px 10px;
  border-radius: 8px;
  background: rgba(255,255,255,.06);
  color: #b9b9c0;
  font: 500 11px/1 system-ui, sans-serif;
  cursor: pointer;
}
.v2-fx-output__btn:hover { background: rgba(255,255,255,.12); color: #ececf1; }
.v2-fx-output__btn svg { width: 12px; height: 12px; }
.v2-fx-output__btn[data-done="1"] { background: #a78bfa; color: #17171b; }
.v2-fx-output__box {
  position: relative;
  height: 190px;
  border-radius: 12px;
  overflow: hidden;
}
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

  const card = el('div', 'v2-card')
  const handle = el('div', 'v2-label v2-handle',
    `${ICON_GRIP}${config.icon}<span>${t(config.titleKey)}</span>`)
  card.appendChild(handle)
  bindNodeDrag(node, handle)

  const embedAnchor = el('div', 'v2-fx-host')
  embedAnchor.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;'
  card.appendChild(embedAnchor)

  const presetAnchor = el('div', 'v2-panel__presets v2-fx-presets')
  card.appendChild(presetAnchor)

  let run: HTMLButtonElement | null = null
  let serverAnchor: HTMLElement | null = null
  let outputWrap: HTMLElement | null = null
  let outputMediaAnchor: HTMLElement | null = null
  let saveBtn: HTMLButtonElement | null = null
  if (config.hasRun && config.embed !== false) {
    outputWrap = el('div', 'v2-fx-output')
    const head = el('div', 'v2-fx-output__head')
    const outLabel = el('div', '', t('v2.outputLabel'))
    const outSpacer = el('div', 'v2-fx-output__spacer')
    saveBtn = el('button', 'v2-fx-output__btn',
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 3.5h11a1 1 0 011 1V21l-6.5-4-6.5 4V4.5a1 1 0 011-1z"/></svg>`) as HTMLButtonElement
    saveBtn.title = t('stage.action.loadAsset')
    const dlBtn = el('button', 'v2-fx-output__btn',
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3.5V15M7 10.5l5 5 5-5M4 19.5h16"/></svg>`) as HTMLButtonElement
    dlBtn.title = t('stage.action.download')
    head.append(outLabel, outSpacer, saveBtn, dlBtn)
    const box = el('div', 'v2-fx-output__box')
    outputMediaAnchor = el('div', 'v2-mp-host')
    outputMediaAnchor.style.cssText = 'position:absolute;inset:0;'
    box.appendChild(outputMediaAnchor)
    outputWrap.append(head, box)
    card.appendChild(outputWrap)

    dlBtn.addEventListener('pointerdown', (e) => e.stopPropagation())
    dlBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      const url = String(stageState.output ?? '')
      if (!url) return
      const a = document.createElement('a')
      a.href = (app as any).api.apiURL(url.replace(/^\/api/, ''))
      a.download = decodeURIComponent(url.split('filename=')[1]?.split('&')[0] || 'output.mp4')
      a.click()
    })
  }
  if (config.hasRun && config.embed !== false) {
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

  ensureMinSize(node, 340, 460)

  const stageApi = useStageNode(node as any, kind, variant)
  const { state: stageState, onRunRequest, onCancelRequest, onDisconnect, onAction } = stageApi
  const scope = createNodeScope(node)
  scope.run(() => bindProgressRing(card, stageState))

  const islands = createIslandGroup()
  const mountApps = () => {
    islands.unmountAll()
    const specs: Array<[unknown, Record<string, unknown>, HTMLElement]> = [
      config.embed === false
        ? [config.card, { node, state: stageState, onAction, onRunRequest, onCancelRequest }, embedAnchor]
        : [CardEmbedV2, {
            card: config.card, node, state: stageState,
            onRunRequest, onCancelRequest, onDisconnect, onAction,
          }, embedAnchor],
    ]
    specs.push([StagePresetBar, { node }, presetAnchor])
    if (serverAnchor) {
      specs.push([ServerSelectV2, { getNode: () => node, state: stageState }, serverAnchor])
    }
    if (outputMediaAnchor) {
      specs.push([{
        render: () => h(MediaPreviewV2, {
          kind: 'video',
          url: stageState.output,
          hint: '',
        }),
      }, {}, outputMediaAnchor])
    }
    for (const [comp, props, anchor] of specs) {
      islands.mount(anchor, comp as any, props)
    }
  }
  mountApps()

  const prevConfigure = anyNode.onConfigure
  anyNode.onConfigure = function (...args: unknown[]) {
    prevConfigure?.apply(this, args)
    queueMicrotask(mountApps)
  }

  if (outputWrap) {
    const wrap = outputWrap
    scope.run(() => {
      watch(
        () => stageState.output,
        (out) => { wrap.dataset.show = out ? '1' : '' },
        { immediate: true },
      )
    })
  }
  if (saveBtn) {
    const btn = saveBtn
    const flash = scope.run(() => useTimeoutFn(() => { btn.dataset.done = '' }, 1200, { immediate: false }))
    btn.addEventListener('pointerdown', (e) => e.stopPropagation())
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const url = String(stageState.output ?? '')
      if (!url) return
      const label = decodeURIComponent(url.split('filename=')[1]?.split('&')[0] || 'video')
      onAction('load-asset', { imageUrl: url, label, mediaType: 'video' } as any)
      btn.dataset.done = '1'
      flash?.stop()
      flash?.start()
    })
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
    scope, card, socketAnchor: embedAnchor, socketY: { frac: 0.3, cap: 160 }, state: stageState,
  })

  const prevRemoved = anyNode.onRemoved
  anyNode.onRemoved = function (...args: unknown[]) {
    islands.unmountAll()
    prevRemoved?.apply(this, args)
  }

  return stageApi
}

for (const [cls, config] of Object.entries(CONFIGS)) {
  V2_SHELLS[cls] = (node, kind, variant) => attach(node, kind, variant, config)
}
