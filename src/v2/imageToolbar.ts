import { t } from '@/i18n'
import { app } from '@/lib/comfyApp'
import { I, el } from '@/v2/shellCommon'
import type { StageKind, StageState } from '@/stores/stageStore'

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

export function isImageOutputKind(kind: StageKind): boolean {
  return kind === 'image' || kind === 'image-batch' || kind === 'image-picker'
}

export function outputImageUrl(state: StageState): string {
  const raw = String(state.output ?? '')
  if (!raw.trim().startsWith('{')) return raw
  let images: any[] = []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.images)) images = parsed.images
  } catch { }
  if (images.length === 0) return ''
  const idx = Number(state.pickedIndex)
  const i = Number.isFinite(idx) && idx >= 1 ? Math.min(idx, images.length) : 1
  return String(images[i - 1]?.image_url ?? '')
}

export function downloadUrl(url: string) {
  if (!url) return
  const a = document.createElement('a')
  a.href = (app as any).api.apiURL(url.replace(/^\/api/, ''))
  a.download = decodeURIComponent(url.split('filename=')[1]?.split('&')[0] || url.split('/').pop() || 'output')
  a.click()
}

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

export function attachImageToolbar(
  card: HTMLElement,
  kind: StageKind,
  state: StageState,
  onAction: (actionId: string) => void,
) {
  if (!isImageOutputKind(kind)) return null
  const bar = buildToolbar((actionId) => {
    if (actionId === 'download') downloadUrl(outputImageUrl(state))
    else onAction(actionId)
  })
  card.appendChild(bar)
  return bar
}
