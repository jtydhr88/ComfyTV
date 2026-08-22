import { h, watch } from 'vue'

import MainPromptInput from '@/components/stages/MainPromptInput.vue'
import { useStageNode } from '@/composables/stages/useStageNode'
import { uploadLoaderFiles } from '@/composables/stages/useStageLoaderDrop'
import { t } from '@/i18n'
import { app, type ComfyNode } from '@/lib/comfyApp'
import {
  bindNodeDrag,
  bindShellChrome,
  buildToolbar,
  createNodeScope,
  ensureMinSize,
  ICON_GRIP,
  installV2ShellCss,
} from '@/v2/imageStageV2'
import { V2_SHELLS } from '@/v2/registry'
import AssetLoaderV2 from '@/v2/AssetLoaderV2.vue'
import LoaderActionsV2 from '@/v2/LoaderActionsV2.vue'
import MediaCornerV2 from '@/v2/MediaCornerV2.vue'
import MediaPreviewV2 from '@/v2/MediaPreviewV2.vue'
import { createIslandGroup } from '@/v2/islands'
import type { StageKind, StageState, StageVariant } from '@/stores/stageStore'

const LOADER_CSS = `
.v2-loader-preview { cursor: pointer; }
.v2-loader-preview[data-drag="1"] {
  outline: 2px dashed rgba(167,139,250,.75);
  outline-offset: -2px;
}
.v2-loader-footer {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 9px 14px;
  border-radius: 14px;
  background: #232327;
  border: 1px solid rgba(255,255,255,.05);
  color: #8f8f98;
  font: 500 11px/1 system-ui, sans-serif;
}
.v2-loader-footer__name {
  color: #b9b9c0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.v2-loader-footer__spacer { flex: 1; }
.v2-loader-footer__btn {
  flex: none;
  display: flex;
  align-items: center;
  border: none;
  padding: 5px 10px;
  border-radius: 8px;
  background: rgba(255,255,255,.06);
  color: #b9b9c0;
  font: 500 11px/1 system-ui, sans-serif;
  cursor: pointer;
}
.v2-loader-footer__btn:hover { background: rgba(255,255,255,.12); color: #ececf1; }
.v2-loader-footer__btn svg { width: 12px; height: 12px; }
.v2-text-loader-host {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.v2-text-loader-host > div {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 !important;
}
.v2-text-loader-host .comfytv-prompt-editor {
  flex: 1;
  min-height: 170px;
  overflow-y: auto;
  overscroll-behavior: contain;
  border-radius: 12px;
  background: linear-gradient(160deg, #23232a 0%, #1a1a20 100%);
  border: 1px solid rgba(255,255,255,.07);
  padding: 14px 16px;
  box-sizing: border-box;
  cursor: text;
}
.v2-text-loader-host .comfytv-prompt-editor > div {
  min-height: 100%;
  outline: none;
}
.v2-text-loader-host .comfytv-prompt-editor p {
  font-size: 14px;
  line-height: 1.7;
}
.v2-text-loader-host .comfytv-prompt-editor + div {
  flex: none;
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 14px;
  background: #232327;
  border: 1px solid rgba(255,255,255,.05);
}
`

const ICON_LOAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M12 15V8M8.5 11.5L12 8l3.5 3.5"/></svg>`
const ICON_ASSET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3.5 7.5l8.5-4 8.5 4-8.5 4z"/><path d="M3.5 7.5v9l8.5 4 8.5-4v-9"/><path d="M12 11.5v9"/></svg>`
const ICON_UPLOAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M7.5 8.5L12 4l4.5 4.5M4 19.5h16"/></svg>`
const ICON_TEXT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h10"/></svg>`

let extraCssInstalled = false
function installCss() {
  installV2ShellCss()
  if (extraCssInstalled) return
  extraCssInstalled = true
  const style = document.createElement('style')
  style.textContent = LOADER_CSS
  document.head.appendChild(style)
}

function el(tag: string, cls: string, html?: string) {
  const e = document.createElement(tag)
  e.className = cls
  if (html != null) e.innerHTML = html
  return e
}

function nodeTitle(node: ComfyNode): string {
  return String((node.constructor as any)?.title ?? node.comfyClass ?? '')
}

function downloadOutput(state: StageState) {
  const url = String(state.output ?? '')
  if (!url) return
  const a = document.createElement('a')
  a.href = (app as any).api.apiURL(url.replace(/^\/api/, ''))
  a.download = decodeURIComponent(url.split('filename=')[1]?.split('&')[0] || url.split('/').pop() || 'media')
  a.click()
}

function attachLoaderToolbar(opts: {
  card: HTMLElement
  mediaKind: 'image' | 'video' | 'audio' | 'model'
  state: StageState
  onAction: (id: string, context?: any) => void
  islands: ReturnType<typeof createIslandGroup>
}) {
  const { card, mediaKind, state, onAction, islands } = opts
  if (mediaKind === 'image') {
    const bar = buildToolbar((actionId) => {
      if (actionId === 'download') {
        downloadOutput(state)
        return
      }
      onAction(actionId)
    })
    card.appendChild(bar)
    return
  }
  const bar = document.createElement('div')
  bar.className = 'v2-toolbar'
  card.appendChild(bar)
  islands.mount(bar, LoaderActionsV2, { state, kind: mediaKind, onAction })
}

interface PlainLoaderCfg {
  kind: 'image' | 'video' | 'audio'
  widget: string
  accept: string
}

function makePlainLoader(cfg: PlainLoaderCfg) {
  return function attach(node: ComfyNode, kind: StageKind, variant: StageVariant) {
    installCss()
    const anyNode = node as any

    const card = el('div', 'v2-card')
    const handle = el('div', 'v2-label v2-handle',
      `${ICON_GRIP}${ICON_LOAD}<span>${nodeTitle(node)}</span>`)
    card.appendChild(handle)
    bindNodeDrag(node, handle)

    const preview = el('div', 'v2-preview v2-preview--single v2-loader-preview')
    const mediaAnchor = el('div', 'v2-mp-host')
    mediaAnchor.style.cssText = 'position:absolute;inset:0;pointer-events:none;'
    const cornerAnchor = el('div', 'v2-corner-host')
    preview.append(mediaAnchor, cornerAnchor)

    const footer = el('div', 'v2-loader-footer')
    const name = el('div', 'v2-loader-footer__name', t('v2.loaderEmpty'))
    const spacer = el('div', 'v2-loader-footer__spacer')
    const uploadBtn = el('button', 'v2-loader-footer__btn', ICON_UPLOAD) as HTMLButtonElement
    uploadBtn.title = t('v2.upload')
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = cfg.accept
    fileInput.multiple = true
    fileInput.style.display = 'none'
    footer.append(name, spacer, uploadBtn, fileInput)

    card.append(preview, footer)

    node.addDOMWidget('v2_shell', 'v2', card, {
      getMinHeight: () => 300,
      hideOnZoom: false,
      serialize: false,
    })

    ensureMinSize(node, 280, 340)

    const stageApi = useStageNode(node as any, kind, variant)
    const { state: stageState, onAction } = stageApi
    const scope = createNodeScope(node)

    const islands = createIslandGroup()
    islands.mount(mediaAnchor, {
      render: () => h(MediaPreviewV2, {
        kind: cfg.kind,
        url: stageState.output,
        hint: t('v2.loaderHint'),
      }),
    })
    islands.mount(cornerAnchor, MediaCornerV2, {
      state: stageState, source: 'batch', mediaType: cfg.kind, onAction,
    })
    attachLoaderToolbar({ card, mediaKind: cfg.kind, state: stageState, onAction, islands })

    if (cfg.kind !== 'image') mediaAnchor.style.pointerEvents = 'auto'

    scope.run(() => watch(
      () => stageState.output,
      (out) => {
        const url = String(out ?? '')
        if (url) {
          const w = node.widgets?.find((wi: any) => wi.name === cfg.widget) as any
          name.textContent = String(w?.value ?? '').split('/').pop() || t('v2.loaderEmpty')
        } else {
          name.textContent = t('v2.loaderEmpty')
        }
      },
      { immediate: true },
    ))

    const pickFiles = async (files: File[]) => {
      if (!files.length) return
      try {
        await uploadLoaderFiles(node as any, cfg.widget, files)
      } catch (e) {
        console.warn('[ComfyTV/v2-loader] upload failed', e)
      }
    }
    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files ?? [])
      fileInput.value = ''
      void pickFiles(files)
    })
    uploadBtn.addEventListener('pointerdown', (e) => e.stopPropagation())
    uploadBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      fileInput.click()
    })
    preview.addEventListener('pointerdown', (e) => e.stopPropagation())
    preview.addEventListener('click', (e) => {
      if (cfg.kind !== 'image' && stageState.output) return
      e.stopPropagation()
      fileInput.click()
    })

    let dragDepth = 0
    card.addEventListener('dragenter', (e) => {
      e.preventDefault()
      dragDepth++
      preview.dataset.drag = '1'
    })
    card.addEventListener('dragover', (e) => e.preventDefault())
    card.addEventListener('dragleave', () => {
      dragDepth = Math.max(0, dragDepth - 1)
      if (dragDepth === 0) preview.dataset.drag = ''
    })
    card.addEventListener('drop', (e) => {
      e.preventDefault()
      e.stopPropagation()
      dragDepth = 0
      preview.dataset.drag = ''
      const files = Array.from(e.dataTransfer?.files ?? [])
        .filter(f => f.type.startsWith(`${cfg.kind}/`))
      void pickFiles(files)
    })

    const prevRemoved = anyNode.onRemoved
    anyNode.onRemoved = function (...args: unknown[]) {
      islands.unmountAll()
      prevRemoved?.apply(this, args)
    }

    bindShellChrome(node, { scope, card, socketAnchor: preview, state: stageState })
    return stageApi
  }
}

const ASSET_LOADER_MEDIA: Record<string, 'image' | 'video' | 'audio' | 'model'> = {
  'ComfyTV.AssetImageLoaderStage': 'image',
  'ComfyTV.AssetVideoLoaderStage': 'video',
  'ComfyTV.AssetAudioLoaderStage': 'audio',
  'ComfyTV.AssetModelLoaderStage': 'model',
}

function attachAssetLoader(node: ComfyNode, kind: StageKind, variant: StageVariant) {
  installCss()
  const anyNode = node as any

  const card = el('div', 'v2-card')
  const handle = el('div', 'v2-label v2-handle',
    `${ICON_GRIP}${ICON_ASSET}<span>${nodeTitle(node)}</span>`)
  card.appendChild(handle)
  bindNodeDrag(node, handle)

  const embedAnchor = el('div', 'v2-al-host')
  embedAnchor.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;'
  card.appendChild(embedAnchor)

  node.addDOMWidget('v2_shell', 'v2', card, {
    getMinHeight: () => 300,
    hideOnZoom: false,
    serialize: false,
  })

  ensureMinSize(node, 280, 340)

  const stageApi = useStageNode(node as any, kind, variant)
  const { state: stageState, onAction } = stageApi
  const scope = createNodeScope(node)

  const embedIslands = createIslandGroup()
  const toolbarIslands = createIslandGroup()
  const mountApps = () => {
    embedIslands.unmountAll()
    embedIslands.mount(embedAnchor, AssetLoaderV2, { node, state: stageState, onAction })
  }
  mountApps()

  const mediaKind = ASSET_LOADER_MEDIA[node.comfyClass ?? ''] ?? 'image'
  attachLoaderToolbar({
    card, mediaKind, state: stageState, onAction, islands: toolbarIslands,
  })

  const prevConfigure = anyNode.onConfigure
  anyNode.onConfigure = function (...args: unknown[]) {
    prevConfigure?.apply(this, args)
    queueMicrotask(mountApps)
  }

  const prevRemoved = anyNode.onRemoved
  anyNode.onRemoved = function (...args: unknown[]) {
    embedIslands.unmountAll()
    toolbarIslands.unmountAll()
    prevRemoved?.apply(this, args)
  }

  bindShellChrome(node, { scope, card, socketAnchor: embedAnchor, state: stageState })
  return stageApi
}

function attachTextLoader(node: ComfyNode, kind: StageKind, variant: StageVariant) {
  installCss()
  const anyNode = node as any

  const card = el('div', 'v2-card')
  const handle = el('div', 'v2-label v2-handle',
    `${ICON_GRIP}${ICON_TEXT}<span>${nodeTitle(node)}</span>`)
  card.appendChild(handle)
  bindNodeDrag(node, handle)

  const promptHost = el('div', 'v2-text-loader-host')
  card.appendChild(promptHost)

  node.addDOMWidget('v2_shell', 'v2', card, {
    getMinHeight: () => 220,
    hideOnZoom: false,
    serialize: false,
  })

  ensureMinSize(node, 300, 240)

  const stageApi = useStageNode(node as any, kind, variant)
  const { state: stageState } = stageApi
  const scope = createNodeScope(node)

  const islands = createIslandGroup()
  const mountApps = () => {
    islands.unmountAll()
    islands.mount(promptHost, MainPromptInput, { node })
  }
  mountApps()

  const prevConfigure = anyNode.onConfigure
  anyNode.onConfigure = function (...args: unknown[]) {
    prevConfigure?.apply(this, args)
    queueMicrotask(mountApps)
  }

  const prevRemoved = anyNode.onRemoved
  anyNode.onRemoved = function (...args: unknown[]) {
    islands.unmountAll()
    prevRemoved?.apply(this, args)
  }

  bindShellChrome(node, { scope, card, socketAnchor: promptHost, state: stageState })
  return stageApi
}

V2_SHELLS['ComfyTV.ImageLoaderStage'] = makePlainLoader({ kind: 'image', widget: 'image', accept: 'image/*' })
V2_SHELLS['ComfyTV.VideoLoaderStage'] = makePlainLoader({ kind: 'video', widget: 'video', accept: 'video/*' })
V2_SHELLS['ComfyTV.AudioLoaderStage'] = makePlainLoader({ kind: 'audio', widget: 'audio', accept: 'audio/*' })
V2_SHELLS['ComfyTV.TextLoaderStage'] = attachTextLoader
V2_SHELLS['ComfyTV.AssetImageLoaderStage'] = attachAssetLoader
V2_SHELLS['ComfyTV.AssetVideoLoaderStage'] = attachAssetLoader
V2_SHELLS['ComfyTV.AssetAudioLoaderStage'] = attachAssetLoader
V2_SHELLS['ComfyTV.AssetModelLoaderStage'] = attachAssetLoader
