import { h, watch } from 'vue'

import { ensureStageUid } from '@/composables/stages/stageIdentity'
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
} from '@/v2/imageStageV2'
import MediaCornerV2 from '@/v2/MediaCornerV2.vue'
import MediaPreviewV2 from '@/v2/MediaPreviewV2.vue'
import { createIslandGroup } from '@/v2/islands'
import { V2_SHELLS } from '@/v2/registry'
import { usePinnedBatchStore } from '@/stores/pinnedBatchStore'
import { useProjectStore } from '@/stores/projectStore'
import { toImagePoolJson, useStageStore, type StageKind, type StageVariant } from '@/stores/stageStore'

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
.v2-picker-footer__clear--danger { background: rgba(239,68,68,.2); color: #fca5a5; }
.v2-picker-footer__clear--danger:hover { background: rgba(239,68,68,.35); color: #fecaca; }
.v2-picker-footer__confirm {
  color: #fca5a5;
  font: 600 11px/1.2 system-ui, sans-serif;
}
.v2-picker-footer__pin {
  border: none;
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 8px;
  background: rgba(255,255,255,.06);
  color: #b9b9c0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.v2-picker-footer__pin:hover { background: rgba(255,255,255,.12); color: #ececf1; }
.v2-picker-footer__pin svg { width: 13px; height: 13px; }
`

const ICON_PICK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="13" height="13" rx="2.5"/><path d="M19 8.5v9a2.5 2.5 0 01-2.5 2.5H8"/><path d="M6.5 10.5l2.4 2.4 4.6-4.6"/></svg>`
const ICON_PIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M9 3.5h6l-.7 6.2 2.7 2.8v1.5H7v-1.5l2.7-2.8z"/><path d="M12 14v6.5"/></svg>`

let cssInstalled = false
function installCss() {
  installV2ShellCss()
  if (cssInstalled) return
  cssInstalled = true
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

export function poolCells(poolJson: string | null | undefined): Array<{ url: string }> {
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

function makePoolPicker(previewKind: 'image' | 'video' | 'audio') {
  return function attach(node: ComfyNode, kind: StageKind, variant: StageVariant) {
    installCss()
    const anyNode = node as any
    const getW = (name: string) => node.widgets?.find((w: any) => w.name === name) as any
    const title = previewKind === 'image'
      ? t('v2.pickerTitle')
      : String((node.constructor as any)?.title ?? node.comfyClass ?? '')

    const card = el('div', 'v2-card')
    const handle = el('div', 'v2-label v2-handle', `${ICON_GRIP}${ICON_PICK}<span>${title}</span>`)
    card.appendChild(handle)
    bindNodeDrag(node, handle)

    const preview = el('div', 'v2-preview')
    const media = el('div', 'v2-preview__media')
    const img = el('img', 'v2-preview__img') as HTMLImageElement
    const hint = el('div', 'v2-preview__hint', `${ICON_PICK}<span>${t('v2.pickerHint')}</span>`)
    const mediaAnchor = el('div', 'v2-mp-host')
    mediaAnchor.style.cssText = 'position:absolute;inset:0;'
    if (previewKind === 'image') media.append(img, hint)
    const chip = el('div', 'v2-chip', `<span>↗</span><span class="v2-chip__n"></span>`)
    const navPrev = el('button', 'v2-nav v2-nav--prev',
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 5l-7 7 7 7"/></svg>`) as HTMLButtonElement
    const navNext = el('button', 'v2-nav v2-nav--next',
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 5l7 7-7 7"/></svg>`) as HTMLButtonElement
    const strip = el('div', 'v2-strip')
    const cornerAnchor = el('div', 'v2-corner-host')
    if (previewKind === 'image') preview.append(media, chip, navPrev, navNext, strip, cornerAnchor)
    else preview.append(mediaAnchor, chip, navPrev, navNext, strip, cornerAnchor)

    const footer = el('div', 'v2-picker-footer')
    const count = el('div', '', t('v2.poolCount', { n: 0 }))
    const spacer = el('div', 'v2-picker-footer__spacer')
    const confirmMsg = el('span', 'v2-picker-footer__confirm', t('stage.pool.confirmClear'))
    confirmMsg.style.display = 'none'
    const pinBtn = el('button', 'v2-picker-footer__pin', ICON_PIN) as HTMLButtonElement
    pinBtn.title = t('imageRefs.pinBatch')
    if (previewKind !== 'image') pinBtn.style.display = 'none'
    const clearBtn = el('button', 'v2-picker-footer__clear', t('v2.clear')) as HTMLButtonElement
    clearBtn.title = t('stage.pool.clearHint')
    const confirmBtn = el('button', 'v2-picker-footer__clear v2-picker-footer__clear--danger', t('stage.pool.confirm')) as HTMLButtonElement
    const cancelBtn = el('button', 'v2-picker-footer__clear', t('stage.pool.cancel')) as HTMLButtonElement
    confirmBtn.style.display = 'none'
    cancelBtn.style.display = 'none'
    footer.append(count, spacer, confirmMsg, pinBtn, clearBtn, confirmBtn, cancelBtn)

    card.append(preview, footer)

    node.addDOMWidget('v2_shell', 'v2', card, {
      getMinHeight: () => 320,
      hideOnZoom: false,
      serialize: false,
    })

    ensureMinSize(node, 300, 360)

    const stageStore = useStageStore()
    const stageApi = useStageNode(node as any, kind, variant)
    const { state: stageState, onAction } = stageApi
    const scope = createNodeScope(node)
    scope.run(() => bindProgressRing(card, stageState))

    let batchList: Array<{ url: string }> = []
    let pickedIdx = 1

    const islands = createIslandGroup()

    if (previewKind !== 'image') {
      islands.mount(mediaAnchor, {
        render: () => h(MediaPreviewV2, {
          kind: previewKind,
          url: (() => {
            const cells = poolCells(stageState.pool)
            const i = Number(stageState.pickedIndex)
            const idx = Number.isFinite(i) && i >= 1 ? i : 1
            return cells[Math.min(idx, Math.max(cells.length, 1)) - 1]?.url ?? null
          })(),
          hint: t('v2.pickerHint'),
        }),
      })
    }
    islands.mount(cornerAnchor, MediaCornerV2, {
      state: stageState, source: 'pool', mediaType: previewKind, onAction,
    })

    const renderStrip = () => {
      strip.replaceChildren()
      for (let i = 0; i < batchList.length; i++) {
        const cell = el('button', 'v2-strip__cell') as HTMLButtonElement
        if (i + 1 === pickedIdx) cell.dataset.current = '1'
        if (previewKind === 'image') {
          const im = document.createElement('img')
          im.src = (app as any).api.apiURL(batchList[i].url.replace(/^\/api/, ''))
          im.loading = 'lazy'
          cell.appendChild(im)
        } else if (previewKind === 'video') {
          const v = document.createElement('video')
          v.src = (app as any).api.apiURL(batchList[i].url.replace(/^\/api/, ''))
          v.muted = true
          v.preload = 'metadata'
          v.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;pointer-events:none;'
          cell.appendChild(v)
        } else {
          cell.textContent = `#${i + 1}`
          cell.style.cssText = 'display:flex;align-items:center;justify-content:center;color:#b9b9c0;font:600 11px system-ui,sans-serif;'
        }
        const rm = el('div', 'v2-strip__x', '×')
        rm.title = t('v2.removeItem')
        rm.addEventListener('pointerdown', (e) => e.stopPropagation())
        rm.addEventListener('click', (e) => {
          e.stopPropagation()
          onAction('remove-pool-item', { index: String(i + 1), imageUrl: batchList[i].url })
        })
        cell.appendChild(rm)
        cell.addEventListener('pointerdown', (e) => e.stopPropagation())
        cell.addEventListener('click', (e) => {
          e.stopPropagation()
          applyPick(i + 1)
          strip.dataset.open = ''
        })
        strip.appendChild(cell)
      }
    }

    let confirming = false
    const setConfirming = (on: boolean) => {
      confirming = on && batchList.length > 0
      confirmMsg.style.display = confirming ? '' : 'none'
      confirmBtn.style.display = confirming ? '' : 'none'
      cancelBtn.style.display = confirming ? '' : 'none'
      clearBtn.style.display = confirming ? 'none' : ''
      pinBtn.style.display = !confirming && previewKind === 'image' && batchList.length > 0 ? '' : 'none'
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
      setConfirming(confirming)
      if (previewKind === 'image' && n === 0) {
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
      if (previewKind === 'image') {
        const url = batchList[pickedIdx - 1].url
        img.src = (app as any).api.apiURL(url.replace(/^\/api/, ''))
        img.dataset.live = '1'
      }
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

    for (const b of [clearBtn, confirmBtn, cancelBtn, pinBtn]) {
      b.addEventListener('pointerdown', (e) => e.stopPropagation())
    }
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (!batchList.length) return
      setConfirming(true)
    })
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      setConfirming(false)
    })
    confirmBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      stageStore.clearPickerPool(node as any, stageState)
      batchList = []
      pickedIdx = 1
      setConfirming(false)
      refreshUi()
    })
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      const json = toImagePoolJson(stageState.pool)
      const label = String(anyNode?.title || node.comfyClass || 'Stage').replace(/^ComfyTV\./, '')
      const entry = usePinnedBatchStore().pin(useProjectStore().currentProjectId || '', {
        label: `${label} #${node.id ?? '?'}`,
        sourceUid: ensureStageUid(node as any),
        batchJson: json,
      })
      ;(app as any)?.extensionManager?.toast?.add?.({
        severity: entry ? 'success' : 'warn',
        summary: entry
          ? t('imageRefs.pinnedToast', { n: entry.urls.length })
          : t('imageRefs.pinEmpty'),
        life: 3000,
      })
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
    bindShellChrome(node, { scope, card, socketAnchor: preview, state: stageState })

    const prevRemoved = anyNode.onRemoved
    anyNode.onRemoved = function (...args: unknown[]) {
      islands.unmountAll()
      prevRemoved?.apply(this, args)
    }

    return stageApi
  }
}

V2_SHELLS['ComfyTV.ImagePickerStage'] = makePoolPicker('image')
V2_SHELLS['ComfyTV.VideoPickerStage'] = makePoolPicker('video')
V2_SHELLS['ComfyTV.AudioPickerStage'] = makePoolPicker('audio')
