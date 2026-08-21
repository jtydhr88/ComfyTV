
import { getActivePinia } from 'pinia'
import { createApp, watch } from 'vue'

import { useStageNode } from '@/composables/stages/useStageNode'
import { i18n, t } from '@/i18n'
import { app, type ComfyNode } from '@/lib/comfyApp'
import { bindNodeDrag, bindProgressRing, bindShellChrome, createNodeScope, ICON_GRIP, installV2ShellCss } from '@/v2/imageStageV2'
import { V2_SHELLS } from '@/v2/registry'
import MediaCornerV2 from '@/v2/MediaCornerV2.vue'
import { useStageStore, type StageKind, type StageVariant } from '@/stores/stageStore'

const PICKER_CSS = `
.v2-picker-footer {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 14px;
  background: #232327;
  border: 1px solid rgba(255,255,255,.05);
  color: #8f8f98;
  font: 500 11px/1 system-ui, sans-serif;
}
.v2-picker-footer__spacer { flex: 1; }
.v2-picker-footer__clear {
  border: none;
  padding: 5px 10px;
  border-radius: 8px;
  background: rgba(255,255,255,.06);
  color: #b9b9c0;
  font: 500 11px/1 system-ui, sans-serif;
  cursor: pointer;
}
.v2-picker-footer__clear:hover { background: rgba(255,255,255,.12); color: #ececf1; }
`

const ICON_PICK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="13" height="13" rx="2.5"/><path d="M19 8.5v9a2.5 2.5 0 01-2.5 2.5H8"/><path d="M6.5 10.5l2.4 2.4 4.6-4.6"/></svg>`

let extraCssInstalled = false
function installCss() {
  installV2ShellCss()
  if (extraCssInstalled) return
  extraCssInstalled = true
  const style = document.createElement('style')
  style.textContent = PICKER_CSS
  document.head.appendChild(style)
}

function el(tag: string, cls: string, html?: string) {
  const e = document.createElement(tag)
  e.className = cls
  if (html != null) e.innerHTML = html
  return e
}

function poolCells(poolJson: string | null | undefined): Array<{ url: string }> {
  if (!poolJson) return []
  try {
    const data = JSON.parse(poolJson)
    const images = Array.isArray(data?.images) ? data.images : []
    return images
      .map((im: any) => ({ url: String(im?.image_url ?? '') }))
      .filter((c: any) => c.url)
  } catch {
    return []
  }
}

function attach(node: ComfyNode, kind: StageKind, variant: StageVariant) {
  installCss()
  const anyNode = node as any
  const getW = (name: string) => node.widgets?.find((w: any) => w.name === name) as any

  const card = el('div', 'v2-card')
  const handle = el('div', 'v2-label v2-handle', `${ICON_GRIP}${ICON_PICK}<span>${t('v2.pickerTitle')}</span>`)
  card.appendChild(handle)
  bindNodeDrag(node, handle)

  const preview = el('div', 'v2-preview')
  const media = el('div', 'v2-preview__media')
  const img = el('img', 'v2-preview__img') as HTMLImageElement
  const hint = el('div', 'v2-preview__hint', `${ICON_PICK}<span>${t('v2.pickerHint')}</span>`)
  media.append(img, hint)
  const chip = el('div', 'v2-chip', `<span>↗</span><span class="v2-chip__n"></span>`)
  const navPrev = el('button', 'v2-nav v2-nav--prev',
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 5l-7 7 7 7"/></svg>`) as HTMLButtonElement
  const navNext = el('button', 'v2-nav v2-nav--next',
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 5l7 7-7 7"/></svg>`) as HTMLButtonElement
  const strip = el('div', 'v2-strip')
  const cornerAnchor = el('div', 'v2-corner-host')
  preview.append(media, chip, navPrev, navNext, strip, cornerAnchor)

  const footer = el('div', 'v2-picker-footer')
  const count = el('div', '', t('v2.poolCount', { n: 0 }))
  const spacer = el('div', 'v2-picker-footer__spacer')
  const clearBtn = el('button', 'v2-picker-footer__clear', t('v2.clear')) as HTMLButtonElement
  footer.append(count, spacer, clearBtn)

  card.append(preview, footer)

  node.addDOMWidget('v2_shell', 'v2', card, {
    getMinHeight: () => 320,
    hideOnZoom: false,
    serialize: false,
  })

  const [w0, h0] = node.size
  node.setSize([Math.max(w0, 300), Math.max(h0, 360)])

  const stageStore = useStageStore()
  const stageApi = useStageNode(node as any, kind, variant)
  const { state: stageState, onAction } = stageApi
  const scope = createNodeScope(node)
  scope.run(() => bindProgressRing(card, stageState))

  const pinia = getActivePinia()
  const cornerApp = createApp(MediaCornerV2, { state: stageState, source: 'pool', onAction })
  if (pinia) cornerApp.use(pinia)
  cornerApp.use(i18n)
  cornerApp.mount(cornerAnchor)

  let batchList: Array<{ url: string }> = []
  let pickedIdx = 1

  const renderStrip = () => {
    strip.replaceChildren()
    for (let i = 0; i < batchList.length; i++) {
      const cell = el('button', 'v2-strip__cell') as HTMLButtonElement
      if (i + 1 === pickedIdx) cell.dataset.current = '1'
      const im = document.createElement('img')
      im.src = (app as any).api.apiURL(batchList[i].url.replace(/^\/api/, ''))
      im.loading = 'lazy'
      cell.appendChild(im)
      cell.addEventListener('pointerdown', (e) => e.stopPropagation())
      cell.addEventListener('click', (e) => {
        e.stopPropagation()
        applyPick(i + 1)
        strip.dataset.open = ''
      })
      strip.appendChild(cell)
    }
  }

  const refreshUi = () => {
    const n = batchList.length
    const label = chip.querySelector('.v2-chip__n')
    if (label) {
      label.textContent = n > 1
        ? t('v2.batchPos', { i: pickedIdx, n })
        : t('v2.batchCount', { n })
    }
    chip.dataset.show = n > 0 ? '1' : ''
    chip.dataset.multi = n > 1 ? '1' : ''
    preview.dataset.multi = n > 1 ? '1' : ''
    count.textContent = t('v2.poolCount', { n })
    if (n === 0) {
      img.dataset.live = ''
      img.removeAttribute('src')
    }
    renderStrip()
  }

  const applyPick = (i: number) => {
    if (batchList.length === 0) {
      refreshUi()
      return
    }
    pickedIdx = Math.min(Math.max(i, 1), batchList.length)
    const url = batchList[pickedIdx - 1].url
    img.src = (app as any).api.apiURL(url.replace(/^\/api/, ''))
    img.dataset.live = '1'
    const w = getW('selected_index')
    if (w) w.value = pickedIdx
    stageState.pickedIndex = pickedIdx
    refreshUi()
  }

  navPrev.addEventListener('pointerdown', (e) => e.stopPropagation())
  navNext.addEventListener('pointerdown', (e) => e.stopPropagation())
  navPrev.addEventListener('click', (e) => {
    e.stopPropagation()
    applyPick(pickedIdx <= 1 ? batchList.length : pickedIdx - 1)
  })
  navNext.addEventListener('click', (e) => {
    e.stopPropagation()
    applyPick(pickedIdx >= batchList.length ? 1 : pickedIdx + 1)
  })
  chip.addEventListener('pointerdown', (e) => e.stopPropagation())
  chip.addEventListener('click', (e) => {
    if (batchList.length < 2) return
    e.stopPropagation()
    strip.dataset.open = strip.dataset.open === '1' ? '' : '1'
  })
  clearBtn.addEventListener('pointerdown', (e) => e.stopPropagation())
  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    stageStore.clearPickerPool(node as any, stageState)
    batchList = []
    pickedIdx = 1
    refreshUi()
  })

  const syncFromPool = () => {
    const cells = poolCells(stageState.pool)
    const changed = cells.length !== batchList.length
      || cells.some((c, i) => c.url !== batchList[i]?.url)
    const stateIdx = Number(stageState.pickedIndex)
    const wantIdx = Number.isFinite(stateIdx) && stateIdx >= 1 ? stateIdx : pickedIdx
    if (!changed && wantIdx === pickedIdx) return
    batchList = cells
    applyPick(wantIdx)
  }
  scope.run(() => {
    watch(() => [stageState.pool, stageState.pickedIndex], syncFromPool, { immediate: true })
  })

  bindNodeDrag(node, preview)

  bindShellChrome(node, { scope, card, socketAnchor: preview })

  const prevRemoved = anyNode.onRemoved
  anyNode.onRemoved = function (...args: unknown[]) {
    cornerApp.unmount()
    prevRemoved?.apply(this, args)
  }

  return stageApi
}

V2_SHELLS['ComfyTV.ImagePickerStage'] = attach
