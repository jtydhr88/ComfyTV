import { getActivePinia } from 'pinia'
import { createApp, watch } from 'vue'

import { useStageNode } from '@/composables/stages/useStageNode'
import { uploadLoaderFiles } from '@/composables/stages/useStageLoaderDrop'
import { i18n, t } from '@/i18n'
import { app, type ComfyNode } from '@/lib/comfyApp'
import {
  bindNodeDrag,
  bindShellChrome,
  createNodeScope,
  ICON_GRIP,
  installV2ShellCss,
} from '@/v2/imageStageV2'
import { V2_SHELLS } from '@/v2/registry'
import AssetLoaderV2 from '@/v2/AssetLoaderV2.vue'
import type { StageKind, StageVariant } from '@/stores/stageStore'

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
`

const ICON_LOAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M12 15V8M8.5 11.5L12 8l3.5 3.5"/></svg>`
const ICON_ASSET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3.5 7.5l8.5-4 8.5 4-8.5 4z"/><path d="M3.5 7.5v9l8.5 4 8.5-4v-9"/><path d="M12 11.5v9"/></svg>`
const ICON_UPLOAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M7.5 8.5L12 4l4.5 4.5M4 19.5h16"/></svg>`

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

function attachImageLoader(node: ComfyNode, kind: StageKind, variant: StageVariant) {
  installCss()

  const card = el('div', 'v2-card')
  const handle = el('div', 'v2-label v2-handle',
    `${ICON_GRIP}${ICON_LOAD}<span>${t('v2.imageLoaderTitle')}</span>`)
  card.appendChild(handle)
  bindNodeDrag(node, handle)

  const preview = el('div', 'v2-preview v2-loader-preview')
  const media = el('div', 'v2-preview__media')
  const img = el('img', 'v2-preview__img') as HTMLImageElement
  const hint = el('div', 'v2-preview__hint', `${ICON_LOAD}<span>${t('v2.imageLoaderHint')}</span>`)
  media.append(img, hint)
  preview.appendChild(media)

  const footer = el('div', 'v2-loader-footer')
  const name = el('div', 'v2-loader-footer__name', t('v2.imageLoaderEmpty'))
  const spacer = el('div', 'v2-loader-footer__spacer')
  const uploadBtn = el('button', 'v2-loader-footer__btn', ICON_UPLOAD) as HTMLButtonElement
  uploadBtn.title = t('v2.upload')
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = 'image/*'
  fileInput.multiple = true
  fileInput.style.display = 'none'
  footer.append(name, spacer, uploadBtn, fileInput)

  card.append(preview, footer)

  node.addDOMWidget('v2_shell', 'v2', card, {
    getMinHeight: () => 300,
    hideOnZoom: false,
    serialize: false,
  })

  const [w0, h0] = node.size
  node.setSize([Math.max(w0, 280), Math.max(h0, 340)])

  const stageApi = useStageNode(node as any, kind, variant)
  const { state: stageState } = stageApi
  const scope = createNodeScope(node)

  scope.run(() => watch(
    () => stageState.output,
    (out) => {
      const url = String(out ?? '')
      if (url) {
        img.src = (app as any).api.apiURL(url.replace(/^\/api/, ''))
        img.dataset.live = '1'
        const w = node.widgets?.find((wi: any) => wi.name === 'image') as any
        name.textContent = String(w?.value ?? '').split('/').pop() || t('v2.imageLoaderEmpty')
      } else {
        img.dataset.live = ''
        img.removeAttribute('src')
        name.textContent = t('v2.imageLoaderEmpty')
      }
    },
    { immediate: true },
  ))

  const pickFiles = async (files: File[]) => {
    if (!files.length) return
    try {
      await uploadLoaderFiles(node as any, 'image', files)
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
      .filter(f => f.type.startsWith('image/'))
    void pickFiles(files)
  })

  bindShellChrome(node, { scope, card, socketAnchor: preview })
  return stageApi
}

function attachAssetImageLoader(node: ComfyNode, kind: StageKind, variant: StageVariant) {
  installCss()
  const anyNode = node as any

  const card = el('div', 'v2-card')
  const handle = el('div', 'v2-label v2-handle',
    `${ICON_GRIP}${ICON_ASSET}<span>${t('v2.assetLoaderTitle')}</span>`)
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

  const [w0, h0] = node.size
  node.setSize([Math.max(w0, 280), Math.max(h0, 340)])

  const stageApi = useStageNode(node as any, kind, variant)
  const { state: stageState } = stageApi
  const scope = createNodeScope(node)

  const pinia = getActivePinia()
  let embedApp: ReturnType<typeof createApp> | null = null
  const mountApps = () => {
    embedApp?.unmount()
    embedApp = createApp(AssetLoaderV2, { node, state: stageState })
    if (pinia) embedApp.use(pinia)
    embedApp.use(i18n)
    embedApp.mount(embedAnchor)
  }
  mountApps()

  const prevConfigure = anyNode.onConfigure
  anyNode.onConfigure = function (...args: unknown[]) {
    prevConfigure?.apply(this, args)
    queueMicrotask(mountApps)
  }

  const prevRemoved = anyNode.onRemoved
  anyNode.onRemoved = function (...args: unknown[]) {
    embedApp?.unmount()
    prevRemoved?.apply(this, args)
  }

  bindShellChrome(node, { scope, card, socketAnchor: embedAnchor })
  return stageApi
}

V2_SHELLS['ComfyTV.ImageLoaderStage'] = attachImageLoader
V2_SHELLS['ComfyTV.AssetImageLoaderStage'] = attachAssetImageLoader
