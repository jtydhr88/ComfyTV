import { useTimeoutFn } from '@vueuse/core'
import { h, watch, type Component } from 'vue'

import MainPromptInput from '@/components/stages/MainPromptInput.vue'
import StagePresetBar from '@/components/stages/StagePresetBar.vue'
import { useStageNode } from '@/composables/stages/useStageNode'
import { t } from '@/i18n'
import { app, type ComfyNode } from '@/lib/comfyApp'
import CardEmbedV2 from '@/v2/CardEmbedV2.vue'
import FooterSelectsV2 from '@/v2/FooterSelectsV2.vue'
import MediaPreviewV2 from '@/v2/MediaPreviewV2.vue'
import ServerSelectV2 from '@/v2/ServerSelectV2.vue'
import { createIslandGroup } from '@/v2/islands'
import { bindNodeDrag } from '@/v2/nodeDrag'
import { bindShellChrome } from '@/v2/shellChrome'
import { installV2ShellCss } from '@/v2/shellCss'
import {
  ICON_GRIP,
  RUN_BUTTON_HTML,
  bindProgressRing,
  bindPromptResize,
  createNodeScope,
  ensureMinSize,
} from '@/v2/shellCommon'
import type { StageKind, StageVariant } from '@/stores/stageStore'

export interface FxShellConfig {
  titleKey: string
  icon: string
  card: Component
  hasRun: boolean
  embed?: boolean
  plain?: boolean
  outputKind?: 'video' | 'image' | 'audio'
  outputStrip?: boolean
  prompt?: boolean
  linkKind?: string
  minW?: number
  minH?: number
  hostClass?: string
}

const FX_CSS = `
.v2-fx-host:not(.v2-fx-plain) .v2-fx-embed > div > :first-child {
  border-radius: 12px;
  overflow: hidden;
  background: var(--v2-media-bg);
  border: 1px solid var(--v2-media-border);
  min-height: 150px;
}
.v2-fx-host:not(.v2-fx-plain) .v2-fx-embed > div > :nth-child(2) {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--v2-slab-bg);
  border: 1px solid var(--v2-slab-border);
  box-shadow: var(--v2-slab-shadow);
  max-height: 380px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--v2-scrollbar) transparent;
}
.v2-fx-host:not(.v2-fx-plain) .v2-fx-embed > div > :nth-child(2):focus { outline: none; }
.v2-fx-host input[type="range"] { accent-color: var(--v2-accent); }
.v2-fx-host .ctv-fx-num:focus { border-color: var(--v2-accent-border); outline: none; }
.v2-fx-host:not(.v2-fx-plain) .v2-fx-embed > div > :nth-child(3):not(:last-child) {
  color: var(--v2-text-faint);
  font-size: 10px;
  padding-top: 2px;
}
.v2-fx-plain .v2-fx-embed {
  border-radius: 14px;
  padding: 10px 12px;
  background: var(--v2-slab-bg);
  border: 1px solid var(--v2-slab-border);
  box-shadow: var(--v2-slab-shadow);
}
.v2-fx-footer {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding: 9px 14px;
  border-radius: 14px;
  background: var(--v2-slab-bg);
  border: 1px solid var(--v2-slab-border);
  color: var(--v2-text-muted);
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
  color: var(--v2-text-muted);
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
  background: var(--v2-chip-bg);
  color: var(--v2-text-mid);
  font: 500 11px/1 system-ui, sans-serif;
  cursor: pointer;
}
.v2-fx-output__btn:hover { background: var(--v2-hover-bg); color: var(--v2-text-strong); }
.v2-fx-output__btn svg { width: 12px; height: 12px; }
.v2-fx-output__btn[data-done="1"] { background: var(--v2-accent); color: var(--v2-run-fg); }
.v2-fx-output__box {
  position: relative;
  height: 190px;
  border-radius: 12px;
  overflow: hidden;
}
.v2-fx-output[data-kind="audio"] .v2-fx-output__box { height: 96px; }
.v2-fx-promptpanel {
  flex: none;
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 14px;
  background: var(--v2-slab-bg);
  border: 1px solid var(--v2-slab-border);
}
.v2-fx-promptpanel .comfytv-prompt-editor { min-height: 40px; font-size: 12px; }
.v2-fx-seg.v2-fx-plain .v2-fx-embed,
.v2-fx-meshprim.v2-fx-plain .v2-fx-embed {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}
.v2-fx-seg .v2-fx-embed > div {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.v2-fx-seg .v2-fx-embed > div > :first-child {
  border-radius: 12px;
  overflow: hidden;
  background: var(--v2-media-bg);
  border: 1px solid var(--v2-media-border);
}
.v2-fx-seg .v2-fx-embed > div > :not(:first-child) {
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--v2-slab-bg);
  border: 1px solid var(--v2-slab-border);
}
.v2-fx-meshprim .v2-fx-embed > div {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.v2-fx-meshprim .v2-fx-embed > div > :first-child {
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--v2-slab-bg);
  border: 1px solid var(--v2-slab-border);
}
.v2-fx-meshprim .v2-fx-embed > div > :nth-child(2) {
  border-radius: 12px;
  overflow: hidden;
  background: var(--v2-media-bg);
  border: 1px solid var(--v2-media-border);
}
.v2-fx-meshprim .v2-fx-embed > div > :nth-child(n+3) {
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--v2-slab-bg);
  border: 1px solid var(--v2-slab-border);
}
.v2-fx-modelload.v2-fx-plain .v2-fx-embed {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}
.v2-fx-modelload .v2-fx-embed > div {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 !important;
}
.v2-fx-modelload .v2-fx-embed > div > button:first-child {
  order: 3;
  height: 36px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid var(--v2-chip-border);
  background: var(--v2-slab-bg);
}
.v2-fx-modelload .v2-fx-embed > div > button:first-child:hover {
  border-color: var(--v2-accent-border);
}
.v2-fx-modelload .v2-fx-embed > div > .ctv-hover-host {
  order: 1;
  border-radius: 12px;
  overflow: hidden;
  background: var(--v2-media-bg);
  border: 1px solid var(--v2-media-border);
}
.v2-fx-modelload .v2-fx-embed > div > :not(button):not(.ctv-hover-host) {
  order: 2;
}
.v2-fx-modelload .v2-fx-embed > div > .ctv\\:shrink-0 { display: none; }
.v2-fx-footer__wf {
  flex: none;
  min-width: 0;
  max-width: 60%;
  display: flex;
  align-items: center;
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

export function attachFxShell(node: ComfyNode, kind: StageKind, variant: StageVariant, config: FxShellConfig) {
  return attach(node, kind, variant, config)
}

function attach(node: ComfyNode, kind: StageKind, variant: StageVariant, config: FxShellConfig) {
  installCss()
  const anyNode = node as any

  const card = el('div', 'v2-card')
  const handle = el('div', 'v2-label v2-handle',
    `${ICON_GRIP}${config.icon}<span>${t(config.titleKey)}</span>`)
  card.appendChild(handle)
  bindNodeDrag(node, handle)

  const embedAnchor = el('div',
    (config.plain ? 'v2-fx-host v2-fx-plain' : 'v2-fx-host') + (config.hostClass ? ` ${config.hostClass}` : ''))
  embedAnchor.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;'
  card.appendChild(embedAnchor)
  if (!config.plain) {
    embedAnchor.addEventListener('pointerover', (e) => {
      const slab = embedAnchor.querySelector('.v2-fx-embed > div > :nth-child(2)') as HTMLElement | null
      if (!slab || slab.scrollHeight <= slab.clientHeight + 1) return
      const inSlab = slab.contains(e.target as Node)
      if (inSlab) {
        if (slab.dataset.captureWheel !== 'true') {
          slab.dataset.captureWheel = 'true'
          slab.tabIndex = -1
        }
        if (!slab.contains(document.activeElement)) slab.focus({ preventScroll: true })
      } else if (document.activeElement === slab) {
        slab.blur()
      }
    })
    embedAnchor.addEventListener('pointerleave', () => {
      const slab = embedAnchor.querySelector('.v2-fx-embed > div > :nth-child(2)') as HTMLElement | null
      if (slab && document.activeElement === slab) slab.blur()
    })
  }

  let promptAnchor: HTMLElement | null = null
  if (config.prompt) {
    const promptPanel = el('div', 'v2-fx-promptpanel')
    promptAnchor = el('div', 'v2-panel__prompthost')
    promptPanel.appendChild(promptAnchor)
    card.appendChild(promptPanel)
  }

  const presetAnchor = el('div', 'v2-panel__presets v2-fx-presets')
  card.appendChild(presetAnchor)

  let run: HTMLButtonElement | null = null
  let serverAnchor: HTMLElement | null = null
  let outputWrap: HTMLElement | null = null
  let outputMediaAnchor: HTMLElement | null = null
  let saveBtn: HTMLButtonElement | null = null
  if (config.hasRun && config.embed !== false && config.outputStrip !== false) {
    outputWrap = el('div', 'v2-fx-output')
    outputWrap.dataset.kind = config.outputKind ?? 'video'
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
  let wfAnchor: HTMLElement | null = null
  if (config.hasRun && config.embed !== false) {
    const footer = el('div', 'v2-fx-footer')
    const spacer = el('div', 'v2-fx-footer__spacer')
    serverAnchor = el('div', 'v2-fx-footer__server')
    run = el('button', 'v2-run', RUN_BUTTON_HTML) as HTMLButtonElement
    if (config.linkKind) {
      wfAnchor = el('div', 'v2-fx-footer__wf')
      footer.append(wfAnchor, spacer, serverAnchor, run)
    } else {
      const label = el('div', '', t('stage.run'))
      footer.append(label, spacer, serverAnchor, run)
    }
    card.appendChild(footer)
  }

  node.addDOMWidget('v2_shell', 'v2', card, {
    getMinHeight: () => 360,
    hideOnZoom: false,
    serialize: false,
  })

  ensureMinSize(node, config.minW ?? 340, config.minH ?? 460)

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
    if (promptAnchor) {
      specs.push([MainPromptInput, { node }, promptAnchor])
    }
    if (wfAnchor) {
      specs.push([FooterSelectsV2, {
        getNode: () => node, linkKind: config.linkKind ?? null, extra: [],
      }, wfAnchor])
    }
    if (serverAnchor) {
      specs.push([ServerSelectV2, { getNode: () => node, state: stageState }, serverAnchor])
    }
    if (outputMediaAnchor) {
      specs.push([{
        render: () => h(MediaPreviewV2, {
          kind: config.outputKind ?? 'video',
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
      const mediaType = config.outputKind === 'image' ? 'image'
        : config.outputKind === 'audio' ? 'audio' : 'video'
      const label = decodeURIComponent(url.split('filename=')[1]?.split('&')[0] || mediaType)
      onAction('load-asset', { imageUrl: url, label, mediaType } as any)
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

  if (promptAnchor) bindPromptResize(node, promptAnchor, scope)

  const prevRemoved = anyNode.onRemoved
  anyNode.onRemoved = function (...args: unknown[]) {
    islands.unmountAll()
    prevRemoved?.apply(this, args)
  }

  return stageApi
}
