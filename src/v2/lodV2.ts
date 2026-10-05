import { useRafFn } from '@vueuse/core'
import { effectScope, watch, type EffectScope } from 'vue'

import { app } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import { THUMB_CELL, thumbUrl } from '@/utils/thumbUrl'
import { lightboxKind, openLightbox } from '@/composables/useLightbox'
import { pickedMediaItem, type MediaSource } from '@/v2/mediaItems'

export const LOD_ATTR = 'data-v2-lod'
const FAR_HYSTERESIS = 0.08
const FILL_ATTR = 'data-v2-lod-fill'
const CULL_MARGIN = 0.25
const TITLE_H = 30
let farEnter = 0.42
let farExit = farEnter + FAR_HYSTERESIS
const POSTER_MAX = THUMB_CELL
const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>`
const ICON_EXPAND = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>`
const ICON_WAVE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 10v4M8 6v12M12 9v6M16 4v16M20 8v8"/></svg>`
const ICON_MESH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><path d="M12 12.2l8-4.6M12 12.2v9M12 12.2L4 7.6"/></svg>`
// Only images and videos have a raster thumbnail; an <img> pointed at an mp3 or a glb
// renders the browser's broken-image icon, so those get a glyph instead. Read off the url
// rather than the stage kind, so custom and timeline stages follow whatever they produced.
const GLYPH: Record<string, string> = { audio: ICON_WAVE, model: ICON_MESH }

const CSS = `
.v2-card {
  content-visibility: auto;
  contain-intrinsic-size: auto 320px auto 460px;
}
.v2-card[data-v2-running],
.lg-node[data-v2-selected] .v2-card { content-visibility: visible; }
.v2-lod-poster,
.v2-lod-poster-bg {
  display: none;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 12px;
  box-sizing: border-box;
  pointer-events: none;
}
.v2-lod-poster {
  object-fit: contain;
  background: var(--v2-checker);
  background-size: 18px 18px;
  border: 1px solid var(--v2-media-border);
}
html[${FILL_ATTR}="image"] .v2-lod-poster { background: transparent; border-color: transparent; }
html:not([${FILL_ATTR}="image"]) .v2-lod-poster-bg { display: none !important; }
html[${FILL_ATTR}="image"] .v2-lod-poster-bg {
  object-fit: cover;
  opacity: .32;
  background: var(--v2-media-bg);
  border: 1px solid var(--v2-media-border);
}
.v2-lod-glyph {
  display: none;
  position: absolute;
  inset: 0;
  border-radius: 12px;
  box-sizing: border-box;
  pointer-events: none;
  align-items: center;
  justify-content: center;
  background: var(--v2-media-bg);
  border: 1px solid var(--v2-media-border);
  color: var(--v2-text-faint);
}
.v2-lod-glyph svg { width: 34%; max-width: 92px; height: auto; }
.v2-lod-poster[data-off],
.v2-lod-poster-bg[data-off],
.v2-lod-glyph[data-off] { display: none !important; }
.v2-lod-open {
  display: none;
  position: absolute;
  left: 50%;
  top: 50%;
  width: 38%;
  max-width: 160px;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  align-items: center;
  justify-content: center;
  border: 3px solid rgba(255,255,255,.55);
  border-radius: 999px;
  background: rgba(20,20,24,.82);
  color: #fff;
  cursor: pointer;
  pointer-events: auto;
  z-index: 5;
}
.v2-lod-open svg { width: 55%; height: 55%; }
.v2-lod-open:hover { background: rgba(20,20,24,.95); border-color: #fff; }
html[${LOD_ATTR}="far"] .v2-card[data-v2-lod-media]:hover .v2-lod-open[data-ready] { display: flex; }
html[${LOD_ATTR}="far"] .v2-card[data-v2-lod-media] .v2-preview > :not(.v2-lod-poster):not(.v2-lod-poster-bg):not(.v2-lod-glyph):not(.v2-lod-open),
html[${LOD_ATTR}="far"] .v2-card[data-v2-lod-media] > :not(.v2-label):not(.v2-preview):not(.v2-ring) {
  display: none !important;
}
html[${LOD_ATTR}="far"] .v2-card[data-v2-lod-media] .v2-lod-poster,
html[${LOD_ATTR}="far"] .v2-card[data-v2-lod-media] .v2-lod-poster-bg { display: block; }
html[${LOD_ATTR}="far"] .v2-card[data-v2-lod-media] .v2-lod-glyph { display: flex; }
html[${LOD_ATTR}="far"] .v2-card, html[${LOD_ATTR}="far"] .v2-card *:not(.v2-ring) {
  box-shadow: none !important;
  filter: none !important;
  transition: none !important;
}
`

let scope: EffectScope | null = null
let styleEl: HTMLStyleElement | null = null
let far = false
interface CullEntry { node: any; root: HTMLElement; hidden: boolean }
const cullEntries = new Map<object, CullEntry>()

export function registerCull(node: object, root: HTMLElement): () => void {
  cullEntries.set(node, { node, root, hidden: false })
  return () => {
    const e = cullEntries.get(node)
    if (e?.hidden) e.root.style.visibility = ''
    cullEntries.delete(node)
  }
}

function cullOffscreen(canvas: any): void {
  const area = canvas?.visible_area
  if (!area || !(area[2] > 0)) return
  const mx = area[2] * CULL_MARGIN, my = area[3] * CULL_MARGIN
  const x0 = area[0] - mx, y0 = area[1] - my, x1 = area[0] + area[2] + mx, y1 = area[1] + area[3] + my
  for (const e of cullEntries.values()) {
    const n = e.node
    const pos = n.pos, size = n.size
    if (!pos || !size) continue
    const off = pos[0] + size[0] < x0 || pos[0] > x1 || pos[1] + size[1] < y0 || pos[1] - TITLE_H > y1
    if (off === e.hidden) continue
    e.hidden = off
    e.root.style.visibility = off ? 'hidden' : ''
    if (off) pauseVideos(e.root, 'video')
  }
}

function pauseVideos(root: ParentNode, selector: string): void {
  for (const v of root.querySelectorAll<HTMLVideoElement>(selector)) v.pause()
}
const lodListeners = new Set<(far: boolean) => void>()

function setFar(next: boolean): void {
  if (next === far) return
  far = next
  const root = document.documentElement
  if (far) {
    root.setAttribute(LOD_ATTR, 'far')
    pauseVideos(document, '.v2-card[data-v2-lod-media] video')
  } else root.removeAttribute(LOD_ATTR)
  for (const fn of [...lodListeners]) fn(far)
}

export function isLodFar(): boolean {
  return far
}

export function applyLodSettings(rows: Array<{ key: string; value: unknown }>): void {
  for (const r of rows) {
    if (r.key === 'v2-lod-scale') {
      const v = Number(r.value) / 100
      if (Number.isFinite(v) && v > 0 && v < 1) { farEnter = v; farExit = v + FAR_HYSTERESIS }
    } else if (r.key === 'v2-lod-fill') {
      document.documentElement.setAttribute(FILL_ATTR, String(r.value) === 'image' ? 'image' : 'checker')
    }
  }
}

export function onLodChange(fn: (far: boolean) => void): () => void {
  lodListeners.add(fn)
  return () => { lodListeners.delete(fn) }
}

export function installV2Lod(): () => void {
  if (scope) return uninstallV2Lod
  styleEl = document.createElement('style')
  styleEl.textContent = CSS
  document.head.appendChild(styleEl)
  scope = effectScope(true)
  scope.run(() => {
    useRafFn(() => {
      const canvas = (app as any).canvas
      const scale = canvas?.ds?.scale ?? 1
      if (!far && scale <= farEnter) setFar(true)
      else if (far && scale >= farExit) setFar(false)
      cullOffscreen(canvas)
    })
  })
  return uninstallV2Lod
}

export function uninstallV2Lod(): void {
  scope?.stop()
  scope = null
  styleEl?.remove()
  styleEl = null
  setFar(false)
}

export function bindLodPoster(
  card: HTMLElement,
  preview: HTMLElement,
  state: StageState,
  source: MediaSource,
  nodeScope: EffectScope,
): void {
  card.setAttribute('data-v2-lod-media', '')
  const mk = (cls: string) => {
    const img = document.createElement('img')
    img.className = cls
    img.loading = 'lazy'
    img.decoding = 'async'
    img.draggable = false
    preview.appendChild(img)
    return img
  }
  const imgs = [mk('v2-lod-poster-bg'), mk('v2-lod-poster')]
  const glyph = document.createElement('div')
  glyph.className = 'v2-lod-glyph'
  preview.appendChild(glyph)
  const open = document.createElement('button')
  open.className = 'v2-lod-open'
  open.innerHTML = ICON_EXPAND
  open.addEventListener('pointerdown', (e) => e.stopPropagation())
  open.addEventListener('click', (e) => {
    e.stopPropagation()
    const url = pickedMediaItem(state, source)?.url
    if (url) openLightbox([{ url }])
  })
  preview.appendChild(open)
  nodeScope.run(() => {
    watch(
      () => pickedMediaItem(state, source)?.url ?? '',
      (url) => {
        const kind = url ? lightboxKind({ url }) : 'image'
        const raster = kind === 'image' || kind === 'video'
        const src = url && raster ? thumbUrl(url, POSTER_MAX) : ''
        for (const img of imgs) {
          if (src) img.src = src
          else img.removeAttribute('src')
          img.toggleAttribute('data-off', !raster)
        }
        glyph.innerHTML = GLYPH[kind] ?? ''
        glyph.toggleAttribute('data-off', raster)
        open.innerHTML = kind === 'video' || kind === 'audio' ? ICON_PLAY : ICON_EXPAND
        open.toggleAttribute('data-ready', !!url)
      },
      { immediate: true },
    )
  })
}
