import { watch } from 'vue'

import MainPromptInput from '@/components/stages/MainPromptInput.vue'
import StagePresetBar from '@/components/stages/StagePresetBar.vue'
import { useStageNode } from '@/composables/stages/useStageNode'
import { t } from '@/i18n'
import { app, type ComfyNode } from '@/lib/comfyApp'
import { V2_SHELLS } from '@/v2/registry'
import { createIslandGroup } from '@/v2/islands'
import CustomParamsV2 from '@/v2/CustomParamsV2.vue'
import FooterSelectsV2, { type FooterExtra } from '@/v2/FooterSelectsV2.vue'
import MediaCornerV2 from '@/v2/MediaCornerV2.vue'
import ParamsPanelV2 from '@/v2/ParamsPanelV2.vue'
import RefChipsV2 from '@/v2/RefChipsV2.vue'
import ServerSelectV2 from '@/v2/ServerSelectV2.vue'
import { bindNodeDrag } from '@/v2/nodeDrag'
import { bindShellChrome } from '@/v2/shellChrome'
import { installV2ShellCss } from '@/v2/shellCss'
import {
  I,
  ICON_GRIP,
  RUN_BUTTON_HTML,
  bindProgressRing,
  bindPromptResize,
  createNodeScope,
  el,
  ensureMinSize,
} from '@/v2/shellCommon'
import { type StageKind, type StageVariant } from '@/stores/stageStore'

const REF_RE = /^(images\.image|texts\.text|videos\.video)\d+$/

const ICON_IMAGE = I(`<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5.2-5.2 3.4 3.4 3.2-3.2L21 18"/>`, 1.8)
const ICON_HD = I(`<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M7 9v6M7 12h3.4M10.4 9v6M14 9v6h1.8a3 3 0 000-6z"/>`)
const ICON_EXPAND = I(`<path d="M9 4H5.5A1.5 1.5 0 004 5.5V9M15 4h3.5A1.5 1.5 0 0120 5.5V9M9 20H5.5A1.5 1.5 0 014 18.5V15M15 20h3.5a1.5 1.5 0 001.5-1.5V15"/><rect x="9" y="9" width="6" height="6" rx="1"/>`)
const ICON_ANGLES = I(`<path d="M12 3a9 9 0 109 9"/><path d="M21 3l-4.5.5L21 8z" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="3.4"/>`)
const ICON_LIGHT = I(`<path d="M12 2.5v3M4.9 4.9l2.1 2.1M2.5 12h3M19.1 4.9L17 7M21.5 12h-3"/><path d="M8.5 18a4.8 4.8 0 117 0v1.6a1 1 0 01-1 1h-5a1 1 0 01-1-1z"/>`)
const ICON_REDRAW = I(`<path d="M4 20h4.5L20 8.5a2.1 2.1 0 00-3-3L5.5 17z"/><path d="M13.5 6.5l3 3"/>`)
const ICON_ERASE = I(`<path d="M7.5 20l-4-4a1.5 1.5 0 010-2.1l8.6-8.6a1.5 1.5 0 012.1 0l5.3 5.3a1.5 1.5 0 010 2.1L12.4 20z"/><path d="M7.5 20H20M6.2 10.6l7.2 7.2"/>`)
const ICON_CUTOUT = I(`<circle cx="6.5" cy="6.5" r="2.5"/><circle cx="6.5" cy="17.5" r="2.5"/><path d="M8.6 8.3L20 19M8.6 15.7L20 5M13.3 12.1l2.2 2"/>`)
const ICON_GRID = I(`<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16"/>`)
const ICON_PANORAMA = I(`<circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3a13.5 13.5 0 000 18M12 3a13.5 13.5 0 010 18"/>`)
const ICON_CROP = I(`<path d="M6 2.5V16a2 2 0 002 2h13.5M2.5 6H16a2 2 0 012 2v13.5"/>`)
const ICON_DOWNLOAD = I(`<path d="M12 3.5V15M7 10.5l5 5 5-5M4 19.5h16"/>`)

export function buildToolbar(dispatch: (actionId: string) => void) {
  const bar = el('div', 'v2-toolbar')
  const items: Array<[string, string, string] | null> = [
    [ICON_HD, t('v2.toolbar.hd'), 'edit:hd'],
    [ICON_EXPAND, t('v2.toolbar.expand'), 'edit:outpaint'],
    [ICON_ANGLES, t('v2.toolbar.angles'), 'multiangle'],
    [ICON_LIGHT, t('v2.toolbar.relight'), 'relight'],
    [ICON_REDRAW, t('v2.toolbar.redraw'), 'edit:inpaint'],
    [ICON_ERASE, t('v2.toolbar.erase'), 'edit:erase'],
    [ICON_CUTOUT, t('v2.toolbar.cutout'), 'edit:cutout'],
    null,
    [ICON_GRID, '', 'edit:grid'],
    [ICON_PANORAMA, '', 'panorama'],
    [ICON_CROP, '', 'edit:crop'],
    [ICON_DOWNLOAD, '', 'download'],
  ]
  const titleKeyOf: Record<string, string> = {
    'edit:grid': 'v2.toolbar.grid',
    'panorama': 'v2.toolbar.panorama',
    'edit:crop': 'v2.toolbar.crop',
    'download': 'v2.toolbar.download',
  }
  for (const item of items) {
    if (!item) {
      bar.appendChild(el('div', 'v2-toolbar__sep'))
      continue
    }
    const [icon, text, actionId] = item
    const btn = el('div', text ? 'v2-toolbar__btn' : 'v2-toolbar__btn v2-toolbar__btn--icononly',
      text ? `${icon}<span>${text}</span>` : icon)
    if (!text && titleKeyOf[actionId]) btn.title = t(titleKeyOf[actionId])
    btn.addEventListener('pointerdown', (e) => e.stopPropagation())
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      dispatch(actionId)
    })
    bar.appendChild(btn)
  }
  return bar
}

function refCount(node: ComfyNode): number {
  return (node.inputs ?? []).filter(
    (i: any) => typeof i?.name === 'string' && REF_RE.test(i.name) && i.link != null,
  ).length
}

interface ImageBatchShellConfig {
  title?: string | null
  linkKind?: string
  footerExtra?: FooterExtra[]
}

function makeImageBatchShell(shellCfg: ImageBatchShellConfig = {}) {
  return function attach(node: ComfyNode, kind: StageKind, variant: StageVariant) {
  installV2ShellCss()
  const anyNode = node as any
  const title = shellCfg.title !== undefined
    ? (shellCfg.title ?? String((node.constructor as any)?.title ?? node.comfyClass ?? ''))
    : t('v2.imageStageTitle')

  const card = el('div', 'v2-card')
  card.appendChild(buildToolbar((actionId) => {
    if (actionId === 'download') {
      const url = batchList[pickedIdx - 1]?.url
      if (!url) return
      const a = document.createElement('a')
      a.href = (app as any).api.apiURL(url.replace(/^\/api/, ''))
      a.download = url.split('filename=')[1]?.split('&')[0] || 'image.png'
      a.click()
      return
    }
    onAction(actionId)
  }))
  const handle = el('div', 'v2-label v2-handle', `${ICON_GRIP}${ICON_IMAGE}<span>${title}</span>`)
  card.appendChild(handle)
  bindNodeDrag(node, handle)

  const preview = el('div', 'v2-preview')
  const media = el('div', 'v2-preview__media')
  const img = el('img', 'v2-preview__img') as HTMLImageElement
  const hint = el('div', 'v2-preview__hint', `${ICON_IMAGE}<span>${t('v2.stageHint')}</span>`)
  media.append(img, hint)
  const busy = el('div', 'v2-preview__busy',
    `<div class="v2-preview__spinner"></div><div class="v2-preview__busytext"><span></span><small></small></div>`)
  const chip = el('div', 'v2-chip', `<span>↗</span><span class="v2-chip__n"></span>`)
  const navPrev = el('button', 'v2-nav v2-nav--prev',
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 5l-7 7 7 7"/></svg>`) as HTMLButtonElement
  const navNext = el('button', 'v2-nav v2-nav--next',
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 5l7 7-7 7"/></svg>`) as HTMLButtonElement
  const strip = el('div', 'v2-strip')
  const cornerAnchor = el('div', 'v2-corner-host')
  preview.append(media, busy, chip, navPrev, navNext, strip, cornerAnchor)

  const panel = el('div', 'v2-panel')
  const refsAnchor = el('div', 'v2-panel__refs')
  const promptAnchor = el('div', 'v2-panel__prompthost')
  const presetAnchor = el('div', 'v2-panel__presets')
  const customAnchor = el('div', 'v2-panel__custom')
  const paramsAnchor = el('div', 'v2-panel__params')
  const footer = el('div', 'v2-panel__footer')
  const selectsAnchor = el('div', 'v2-panel__selects')
  const serverAnchor = el('div', 'v2-panel__server')
  const count = el('div', 'v2-panel__count', t('v2.refsCount', { n: 0 }))
  const run = el('button', 'v2-run', RUN_BUTTON_HTML) as HTMLButtonElement
  footer.append(selectsAnchor, serverAnchor, count, run)
  panel.append(refsAnchor, promptAnchor, presetAnchor, customAnchor, paramsAnchor, footer)
  card.append(preview, panel)

  const stageApi = useStageNode(node as any, kind, variant)
  const { state: stageState, onRunRequest, onCancelRequest, onAction } = stageApi
  const scope = createNodeScope(node)

  const islands = createIslandGroup()
  const mountApps = () => {
    islands.unmountAll()
    const specs: Array<[unknown, Record<string, unknown>, HTMLElement]> = [
      [RefChipsV2, { getNode: () => node, types: ['image'] }, refsAnchor],
      [MainPromptInput, { node }, promptAnchor],
      [StagePresetBar, { node }, presetAnchor],
      [FooterSelectsV2, {
        getNode: () => node,
        linkKind: shellCfg.linkKind ?? 'image',
        extra: shellCfg.footerExtra ?? [],
      }, selectsAnchor],
      [CustomParamsV2, { node, state: stageState }, customAnchor],
      [ParamsPanelV2, {
        getNode: () => node,
        exclude: ['aspect_ratio', 'resolution', 'batch_size', ...(shellCfg.footerExtra ?? []).map(x => x.name)],
      }, paramsAnchor],
      [ServerSelectV2, { getNode: () => node, state: stageState }, serverAnchor],
      [MediaCornerV2, { state: stageState, source: 'batch', onAction }, cornerAnchor],
    ]
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

  node.addDOMWidget('v2_shell', 'v2', card, {
    getMinHeight: () => 470,
    hideOnZoom: false,
    serialize: false,
  })

  ensureMinSize(node, 340, 500)

  const LGGlobal = (window as any).LiteGraph
  const isValid = (a: unknown, b: unknown) => !!LGGlobal?.isValidConnection?.(a, b)
  const prevCanConnectTo = anyNode.canConnectTo
  anyNode.canConnectTo = function (target: any, toSlot: any, fromSlot: any) {
    if (prevCanConnectTo?.call(this, target, toSlot, fromSlot)) return true
    if (!target || this.id === target.id) return false
    return (this.outputs ?? []).some((o: any) => isValid(o.type, toSlot?.type))
  }
  const prevConnectSlots = anyNode.connectSlots
  anyNode.connectSlots = function (fromSlot: any, targetNode: any, input: any, afterReroute: any) {
    let slot = fromSlot
    if (input && !isValid(fromSlot?.type, input.type)) {
      const alt = (this.outputs ?? []).find((o: any) => isValid(o.type, input.type))
      if (alt) slot = alt
    }
    return prevConnectSlots.call(this, slot, targetNode, input, afterReroute)
  }

  const refreshCount = () => {
    count.textContent = t('v2.refsCount', { n: refCount(node) })
  }
  refreshCount()

  const prevConn = anyNode.onConnectionsChange
  anyNode.onConnectionsChange = function (...args: unknown[]) {
    prevConn?.apply(this, args)
    refreshCount()
  }

  let batchList: Array<{ index: string; url: string }> = []
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

  const refreshBatchUi = () => {
    const n = batchList.length
    const label = chip.querySelector('.v2-chip__n')
    if (label) {
      label.textContent = n > 1
        ? t('v2.batchPos', { i: pickedIdx, n })
        : t('v2.batchCount', { n: Math.max(n, 1) })
    }
    chip.dataset.multi = n > 1 ? '1' : ''
    preview.dataset.multi = n > 1 ? '1' : ''
    renderStrip()
  }

  const applyPick = (idx: number) => {
    if (batchList.length === 0) return
    onAction('pick-item', { index: String(Math.min(Math.max(idx, 1), batchList.length)) })
  }

  const projectBatch = () => {
    const raw = String(stageState.output ?? '')
    let batch: any = null
    try {
      batch = JSON.parse(raw)
    } catch { }
    const images: any[] = Array.isArray(batch?.images) ? batch.images : []
    batchList = images
      .map((im) => ({ index: String(im?.index ?? ''), url: String(im?.image_url ?? '') }))
      .filter((c) => c.url)
    if (batchList.length === 0 && raw && !raw.trim().startsWith('{')) {
      batchList = [{ index: '1', url: raw }]
    }
    const sIdx = Number(stageState.pickedIndex)
    pickedIdx = Math.min(
      Math.max(Number.isFinite(sIdx) && sIdx >= 1 ? sIdx : 1, 1),
      Math.max(batchList.length, 1),
    )
    const url = batchList[pickedIdx - 1]?.url
    if (url) {
      img.src = (app as any).api.apiURL(url.replace(/^\/api/, ''))
      img.dataset.live = '1'
      chip.dataset.show = '1'
    } else {
      img.dataset.live = ''
      img.removeAttribute('src')
      chip.dataset.show = ''
    }
    refreshBatchUi()
  }
  const busyPct = busy.querySelector('.v2-preview__busytext span') as HTMLElement
  const busyLabel = busy.querySelector('.v2-preview__busytext small') as HTMLElement
  scope.run(() => {
    watch(() => [stageState.output, stageState.pickedIndex], projectBatch, { immediate: true })
    bindProgressRing(card, stageState)
    watch(
      () => [stageState.running, stageState.progress?.value, stageState.progress?.max, stageState.progress?.text] as const,
      ([running, v, m, text]) => {
        run.dataset.busy = running ? '1' : ''
        busy.dataset.show = running ? '1' : ''
        const max = Number(m) || 0
        const p = running && max > 0 ? Math.min(1, Math.max(0, (Number(v) || 0) / max)) : 0
        busyPct.textContent = p > 0 ? `${Math.round(p * 100)}%` : ''
        busyLabel.textContent = running && text ? String(text) : ''
      },
      { immediate: true },
    )
  })

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

  run.addEventListener('pointerdown', (e) => e.stopPropagation())
  run.addEventListener('click', (ev) => {
    ev.stopPropagation()
    if (stageState.running) void onCancelRequest()
    else void onRunRequest()
  })

  bindNodeDrag(node, preview)

  bindShellChrome(node, { scope, card, socketAnchor: preview, state: stageState })
  bindPromptResize(node, promptAnchor, scope)

  const prevRemoved = anyNode.onRemoved
  anyNode.onRemoved = function (...args: unknown[]) {
    document.body.removeAttribute('data-v2-toolbar')
    islands.unmountAll()
    prevRemoved?.apply(this, args)
  }

  return stageApi
  }
}

V2_SHELLS['ComfyTV.ImageStage'] = makeImageBatchShell()
V2_SHELLS['ComfyTV.ShotImagesStage'] = makeImageBatchShell({ title: null, linkKind: 'shot-images' })
V2_SHELLS['ComfyTV.ImageVariationsStage'] = makeImageBatchShell({
  title: null,
  linkKind: 'multiview',
  footerExtra: [{ name: 'variant_count', type: 'number', titleKey: 'v2.ctl.variantCount' }],
})
