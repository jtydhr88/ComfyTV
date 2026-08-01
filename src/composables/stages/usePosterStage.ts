import { computed, reactive, ref, watch, type Ref } from 'vue'

import { app } from '@/lib/comfyApp'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import { getWidget, readWidgetNum, readWidgetStr, writeWidget } from '@/utils/widget'
import {
  clamp, eff, handlePts, hitTest, rectPx,
  type DragMode, type Rect,
} from '@/widgets/poster/geometry'
import { applySnap, buildSnapTargets, type Guide, type SnapExtras } from '@/lib/shared2d/snapping'
import { arrange, unionRect, type ArrangeOp } from '@/lib/shared2d/arrange'
import { connectedImageCount, curSlot } from '@/widgets/poster/slots'

export interface PosterElement {
  id: string
  type: string
  label?: string
  bind?: string
  slot?: number
  text?: string
  data?: string
  shape?: string
  fill?: string
  stroke?: string
  font?: string
  font_size?: number
  align?: string
  color?: string
  x?: number; y?: number; w?: number; h?: number
  [key: string]: unknown
}

export type PosterLayout = Record<string, any>

export const DEFAULT_COLORS: Record<string, string> = {
  primary_color: '#1f1b16',
  accent_color: '#9c2b2b',
  bg_color: '#f4ece0',
}

export const SIZE_PRESETS = [
  { label: 'A4 竖 1240×1754', w: 1240, h: 1754 },
  { label: 'A3 竖 1754×2480', w: 1754, h: 2480 },
  { label: '方形 1240×1240', w: 1240, h: 1240 },
  { label: '竖屏 9:16 1080×1920', w: 1080, h: 1920 },
  { label: '宽屏 16:9 1920×1080', w: 1920, h: 1080 },
  { label: '海报 2:3 1240×1860', w: 1240, h: 1860 },
]

export const HANDLE = 7
export const MIN_WH = 0.02
export const SNAP_PX = 6

export function parseLayout(raw: string): PosterLayout {
  try {
    const v = JSON.parse(raw || '{}')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

export function mergedElements(
  templateDefs: PosterElement[], layout: PosterLayout,
): PosterElement[] {
  const added = Array.isArray(layout.__added__) ? layout.__added__ : []
  const removed = Array.isArray(layout.__removed__) ? layout.__removed__ : []
  const tdefs = templateDefs.filter(d => !removed.includes(d.id))
  return [...tdefs, ...added]
}

export function layoutColor(layout: PosterLayout, key: string): string {
  const c = layout.__colors__ || {}
  const v = c[key]
  return (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) ? v : DEFAULT_COLORS[key]!
}

export function elementProp<T>(
  el: PosterElement, layout: PosterLayout, key: string, dflt: T,
): T {
  const ov = layout[el.id] || {}
  if (ov[key] != null) return ov[key] as T
  if ((el as any)[key] != null) return (el as any)[key] as T
  return dflt
}

export function newElementDef(type: string, id: string): PosterElement {
  const base = { id, x: 0.32, y: 0.32, w: 0.36, h: 0.18 }
  if (type === 'image') return { ...base, type: 'image', slot: 0 }
  if (type === 'shape') {
    return { ...base, type: 'shape', shape: 'rect', h: 0.1, stroke: 'accent', stroke_width: 3 }
  }
  return { ...base, type: 'text', text: '新文本', font: 'body', font_size: 36, align: 'left' }
}

export function applyDrag(
  mode: DragMode, start: Rect, dx: number, dy: number,
): Rect {
  let { x, y, w, h } = start
  if (mode === 'move') {
    x = clamp(x + dx, 0, 1 - w)
    y = clamp(y + dy, 0, 1 - h)
  } else {
    if (mode.includes('e')) w = clamp(w + dx, MIN_WH, 1 - x)
    if (mode.includes('s')) h = clamp(h + dy, MIN_WH, 1 - y)
    if (mode.includes('w')) { const nw = clamp(w - dx, MIN_WH, x + w); x = x + w - nw; w = nw }
    if (mode.includes('n')) { const nh = clamp(h - dy, MIN_WH, y + h); y = y + h - nh; h = nh }
  }
  return { x, y, w, h }
}

export function cursorFor(hit: { mode: DragMode } | null): string {
  if (!hit) return 'default'
  if (hit.mode === 'move') return 'move'
  const map: Record<string, string> = {
    n: 'ns', s: 'ns', e: 'ew', w: 'ew', ne: 'nesw', sw: 'nesw', nw: 'nwse', se: 'nwse',
  }
  return `${map[hit.mode]}-resize`
}

let _uidCounter = 0
export function nextElementId(): string {
  _uidCounter += 1
  return `u${Date.now().toString(36)}${_uidCounter.toString(36)}`
}

async function fetchText(path: string, body: unknown): Promise<string> {
  const r = await (app as any).api.fetchApi(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.text()
}

async function fetchJson(path: string, body?: unknown): Promise<any> {
  const r = await (app as any).api.fetchApi(path, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

export function usePosterStage(node: LGraphNode, state: () => StageState) {
  const layout = ref<PosterLayout>(parseLayout(readWidgetStr(node, 'layout', '{}')))
  const templateDefs = ref<PosterElement[]>([])
  const templates = ref<Array<{ name: string; label: string; description: string }>>([])
  const editMode = ref(false)
  const snap = ref(true)
  const activeIdx = ref(-1)
  const selectedIds = ref<string[]>([])
  const imgEditId = ref<string | null>(null)
  const snapGuides = ref<Guide[]>([])
  const previewHtml = ref('')
  const previewError = ref('')
  const refreshTick = ref(0)

  const drag = reactive<{
    mode: DragMode | null
    id: string
    startN: { x: number; y: number }
    startRect: Rect
    groupBases: Array<{ id: string; rect: Rect }> | null
    targets: ReturnType<typeof buildSnapTargets> | null
    eqRects: Rect[] | null
    rotated: boolean
    moved: boolean
  }>({ mode: null, id: '', startN: { x: 0, y: 0 }, startRect: { x: 0, y: 0, w: 0, h: 0 }, groupBases: null, targets: null, eqRects: null, rotated: false, moved: false })

  const imgDrag = reactive<{
    id: string | null
    boxW: number
    boxH: number
    startPx: { x: number; y: number }
    start: { scale: number; x: number; y: number }
  }>({ id: null, boxW: 1, boxH: 1, startPx: { x: 0, y: 0 }, start: { scale: 1, x: 0, y: 0 } })

  const elements = computed(() => mergedElements(templateDefs.value, layout.value))
  const hasElements = computed(() => elements.value.length > 0)
  const activeElement = computed(() =>
    activeIdx.value >= 0 ? elements.value[activeIdx.value] ?? null : null)
  const selectedElements = computed(() =>
    selectedIds.value
      .map(id => elements.value.find(e => e.id === id) ?? null)
      .filter((e): e is PosterElement => e !== null))

  function syncActiveFromSelection() {
    const last = selectedIds.value[selectedIds.value.length - 1]
    activeIdx.value = last == null ? -1 : elements.value.findIndex(e => e.id === last)
  }

  function selectOnly(idx: number) {
    const el = elements.value[idx]
    selectedIds.value = el ? [el.id] : []
    syncActiveFromSelection()
  }

  function toggleSelect(idx: number) {
    const el = elements.value[idx]
    if (!el) return
    const cur = selectedIds.value
    selectedIds.value = cur.includes(el.id)
      ? cur.filter(id => id !== el.id)
      : [...cur, el.id]
    syncActiveFromSelection()
  }

  function clearSelection() {
    selectedIds.value = []
    activeIdx.value = -1
  }

  function selectRegion(region: Rect) {
    const hit = elements.value.filter(el => {
      const r = eff(el, layout.value[el.id])
      return r.x < region.x + region.w && r.x + r.w > region.x
        && r.y < region.y + region.h && r.y + r.h > region.y
    })
    selectedIds.value = hit.map(e => e.id)
    syncActiveFromSelection()
  }

  const template = () => readWidgetStr(node, 'template', templates.value[0]?.name || 'hero')
  const posterWidth = () => Math.max(64, readWidgetNum(node, 'width', 1240) | 0)
  const posterHeight = () => Math.max(64, readWidgetNum(node, 'height', 1754) | 0)

  function upstreamImageUrls(): string[] {
    const rows = state().inputs
      .filter(i => /^images\.image(\d+)$/.test(i.slot) && i.source === 'upstream' && i.content)
      .map(i => ({
        idx: Number(/^images\.image(\d+)$/.exec(i.slot)![1]),
        url: String(i.content),
      }))
      .sort((a, b) => a.idx - b.idx)
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return rows.map(r => {
      try { return new URL(r.url, origin).href } catch { return r.url }
    })
  }

  function commitLayout() {
    writeWidget(node, 'layout', JSON.stringify(layout.value), { fireCallback: false })
    ;(node as any).graph?.change?.()
  }

  function setRect(id: string, patch: Record<string, unknown>) {
    layout.value[id] = { ...(layout.value[id] || {}), ...patch }
  }

  function effRect(el: PosterElement): Rect {
    return eff(el, layout.value[el.id])
  }

  function setColor(key: string, val: string) {
    layout.value.__colors__ = { ...(layout.value.__colors__ || {}), [key]: val }
    commitLayout()
    scheduleRefresh(0)
  }

  function getColor(key: string): string {
    return layoutColor(layout.value, key)
  }

  function elementRot(el: PosterElement): number {
    return Number(elementProp(el, layout.value, 'rot', 0)) || 0
  }

  const guides = computed<Array<{ axis: 'x' | 'y'; pos: number }>>(() => {
    const raw = layout.value.__guides__
    if (!Array.isArray(raw)) return []
    return raw.filter((g: any) =>
      g && (g.axis === 'x' || g.axis === 'y')
      && typeof g.pos === 'number' && g.pos >= 0 && g.pos <= 1)
  })

  function addGuide(axis: 'x' | 'y') {
    layout.value.__guides__ = [...(layout.value.__guides__ || []), { axis, pos: 0.5 }]
    commitLayout()
  }

  function setGuidePos(index: number, pos: number) {
    const list = layout.value.__guides__
    if (!Array.isArray(list) || !list[index]) return
    list[index] = { ...list[index], pos: clamp(pos, 0, 1) }
  }

  function removeGuide(index: number) {
    const list = layout.value.__guides__
    if (!Array.isArray(list)) return
    list.splice(index, 1)
    commitLayout()
  }

  const gridOn = computed(() => !!layout.value.__grid__)

  function toggleGrid() {
    layout.value.__grid__ = !layout.value.__grid__
    commitLayout()
  }

  function snapExtras(): SnapExtras {
    const gs = guides.value
    return {
      guideXs: gs.filter(g => g.axis === 'x').map(g => g.pos),
      guideYs: gs.filter(g => g.axis === 'y').map(g => g.pos),
      gridX: gridOn.value ? 1 / 12 : undefined,
      gridY: gridOn.value ? 1 / 12 : undefined,
    }
  }

  function getFont(key: 'font_title' | 'font_body'): string {
    const f = layout.value.__fonts__ || {}
    return typeof f[key] === 'string' ? f[key] : ''
  }

  function setFont(key: 'font_title' | 'font_body', val: string) {
    layout.value.__fonts__ = { ...(layout.value.__fonts__ || {}), [key]: val }
    commitLayout()
    scheduleRefresh(0)
  }

  function collectParams(): Record<string, unknown> {
    return {
      template: template(),
      width: posterWidth(),
      height: posterHeight(),
      layout: JSON.stringify(layout.value),
      images: upstreamImageUrls(),
    }
  }

  let timer: ReturnType<typeof setTimeout> | null = null
  let inflight = false
  let pending = false

  async function doRefresh() {
    if (inflight) { pending = true; return }
    inflight = true
    try {
      previewHtml.value = await fetchText('/comfytv/poster/html', collectParams())
      previewError.value = ''
      refreshTick.value++
    } catch (e) {
      previewError.value = String((e as Error)?.message || e)
    } finally {
      inflight = false
      if (pending) { pending = false; scheduleRefresh(40) }
    }
  }

  function scheduleRefresh(delay = 260) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { void doRefresh() }, delay)
  }

  async function fetchElements() {
    try {
      templateDefs.value = (await fetchJson('/comfytv/poster/elements', collectParams())) || []
    } catch {
      templateDefs.value = []
    }
    clearSelection()
  }

  async function fetchTemplates() {
    try {
      templates.value = (await fetchJson('/comfytv/poster/templates')) || []
    } catch {
      templates.value = []
    }
  }

  function setTemplate(name: string) {
    writeWidget(node, 'template', name, { fireCallback: false })
    ;(node as any).graph?.change?.()
    void fetchElements()
    scheduleRefresh(0)
  }

  function applySizePreset(label: string) {
    const p = SIZE_PRESETS.find(x => x.label === label)
    if (!p) return
    writeWidget(node, 'width', p.w, { fireCallback: false })
    writeWidget(node, 'height', p.h, { fireCallback: false })
    ;(node as any).graph?.change?.()
    scheduleRefresh(0)
  }

  function setPosterSize(w: number, h: number) {
    writeWidget(node, 'width', clamp(Math.round(w) || 1240, 256, 4096), { fireCallback: false })
    writeWidget(node, 'height', clamp(Math.round(h) || 1754, 256, 4096), { fireCallback: false })
    ;(node as any).graph?.change?.()
    scheduleRefresh(0)
  }

  function addElement(type: string) {
    const def = newElementDef(type, nextElementId())
    layout.value.__added__ = [...(layout.value.__added__ || []), def]
    commitLayout()
    editMode.value = true
    selectOnly(elements.value.length - 1)
    scheduleRefresh(0)
  }

  function deleteActive() {
    const els = selectedElements.value.length
      ? selectedElements.value
      : (activeElement.value ? [activeElement.value] : [])
    if (!els.length) return
    for (const el of els) {
      if (imgEditId.value === el.id) imgEditId.value = null
      delete layout.value[el.id]
      const added = layout.value.__added__ || []
      const idx = added.findIndex((a: PosterElement) => a.id === el.id)
      if (idx >= 0) {
        added.splice(idx, 1)
      } else {
        layout.value.__removed__ = layout.value.__removed__ || []
        if (!layout.value.__removed__.includes(el.id)) layout.value.__removed__.push(el.id)
      }
    }
    clearSelection()
    commitLayout()
    scheduleRefresh(0)
  }

  function elementImageProps(el: PosterElement) {
    return {
      scale: Number(elementProp(el, layout.value, 'img_scale', 1)) || 1,
      x: Number(elementProp(el, layout.value, 'img_x', 0)) || 0,
      y: Number(elementProp(el, layout.value, 'img_y', 0)) || 0,
    }
  }

  function startDrag(hit: { idx: number; mode: DragMode }, nx: number, ny: number) {
    const el = elements.value[hit.idx]
    if (!el) return
    const group = hit.mode === 'move'
      && selectedIds.value.length > 1
      && selectedIds.value.includes(el.id)
    if (!group) selectOnly(hit.idx)
    else activeIdx.value = hit.idx
    if (imgEditId.value !== el.id) imgEditId.value = null
    drag.mode = hit.mode
    drag.id = el.id
    drag.startN = { x: nx, y: ny }
    if (group) {
      drag.groupBases = selectedElements.value.map(e => ({ id: e.id, rect: effRect(e) }))
      drag.startRect = unionRect(drag.groupBases.map(b => b.rect))
    } else {
      drag.groupBases = null
      drag.startRect = effRect(el)
    }
    const excluded = new Set(group ? selectedIds.value : [el.id])
    const otherRects = elements.value.filter(e => !excluded.has(e.id)).map(e => effRect(e))
    drag.targets = buildSnapTargets(otherRects, undefined, snapExtras())
    drag.eqRects = otherRects
    drag.rotated = !group && elementRot(el) !== 0
    drag.moved = false
  }

  function moveDrag(
    nx: number, ny: number, altKey: boolean, thrX: number, thrY: number,
  ): Array<{ id: string; rect: Rect }> {
    if (!drag.mode) return []
    let rect = applyDrag(drag.mode, drag.startRect, nx - drag.startN.x, ny - drag.startN.y)
    let dragGuides: Guide[] = []
    if (snap.value && !altKey && !drag.rotated && drag.targets) {
      const res = applySnap(drag.mode, rect, drag.targets, {
        thrX, thrY, minWH: MIN_WH,
        eqRects: drag.mode === 'move' ? drag.eqRects ?? undefined : undefined,
      })
      rect = res.rect
      dragGuides = res.guides
    }
    snapGuides.value = dragGuides
    if (rect.x !== drag.startRect.x || rect.y !== drag.startRect.y
        || rect.w !== drag.startRect.w || rect.h !== drag.startRect.h) {
      drag.moved = true
    }
    if (drag.groupBases) {
      const dx = rect.x - drag.startRect.x
      const dy = rect.y - drag.startRect.y
      const out = drag.groupBases.map(b => ({
        id: b.id,
        rect: { x: b.rect.x + dx, y: b.rect.y + dy, w: b.rect.w, h: b.rect.h },
      }))
      for (const o of out) setRect(o.id, { ...o.rect })
      return out
    }
    setRect(drag.id, { ...rect })
    return [{ id: drag.id, rect }]
  }

  function endDrag(): boolean {
    const moved = drag.moved
    drag.mode = null
    drag.targets = null
    drag.eqRects = null
    drag.groupBases = null
    snapGuides.value = []
    if (moved) {
      commitLayout()
      scheduleRefresh(0)
    }
    return moved
  }

  function applyArrange(op: ArrangeOp) {
    const els = selectedElements.value
    if (els.length < 2) return
    const rects = els.map(e => effRect(e))
    const deltas = arrange(rects, op)
    let changed = false
    for (let i = 0; i < els.length; i++) {
      const d = deltas[i]!
      if (d.dx === 0 && d.dy === 0) continue
      const r = rects[i]!
      setRect(els[i]!.id, {
        x: clamp(r.x + d.dx, 0, 1 - r.w),
        y: clamp(r.y + d.dy, 0, 1 - r.h),
      })
      changed = true
    }
    if (changed) {
      commitLayout()
      scheduleRefresh(0)
    }
  }

  function startImgDrag(el: PosterElement, boxW: number, boxH: number, px: number, py: number) {
    imgDrag.id = el.id
    imgDrag.boxW = boxW
    imgDrag.boxH = boxH
    imgDrag.startPx = { x: px, y: py }
    imgDrag.start = elementImageProps(el)
  }

  function moveImgDrag(px: number, py: number) {
    if (!imgDrag.id) return
    const dx = (px - imgDrag.startPx.x) / imgDrag.boxW
    const dy = (py - imgDrag.startPx.y) / imgDrag.boxH
    const max = Math.max(0, (imgDrag.start.scale - 1) / 2)
    setRect(imgDrag.id, {
      img_x: clamp(imgDrag.start.x + dx, -max, max),
      img_y: clamp(imgDrag.start.y + dy, -max, max),
    })
  }

  function endImgDrag() {
    if (!imgDrag.id) return
    imgDrag.id = null
    commitLayout()
    scheduleRefresh(0)
  }

  function setImgScale(el: PosterElement, scale: number) {
    const s = clamp(scale || 1, 1, 4)
    const max = Math.max(0, (s - 1) / 2)
    const p = elementImageProps(el)
    setRect(el.id, {
      img_scale: s,
      img_x: clamp(p.x, -max, max),
      img_y: clamp(p.y, -max, max),
    })
  }

  function setElementProp(key: string, val: unknown) {
    const el = activeElement.value
    if (!el) return
    const patch: Record<string, unknown> = { [key]: val }
    if (key === 'font_size' || key === 'align') patch.fit = false
    if (key === 'align') patch.columns = 1
    setRect(el.id, patch)
    commitLayout()
    scheduleRefresh(0)
  }

  function connectedImages(): number {
    return connectedImageCount(((node as any).inputs || []))
  }

  function slotOf(el: PosterElement): number {
    return curSlot(el, layout.value[el.id])
  }

  function setSlot(el: PosterElement, slot: number) {
    setRect(el.id, { slot })
    commitLayout()
    scheduleRefresh(0)
  }

  function gridLabels(): string {
    const v = layout.value.__grid_labels__
    return typeof v === 'string' ? v : ''
  }

  function setGridLabelLine(index: number, text: string) {
    const lines = gridLabels().replace(/\r\n/g, '\n').split('\n')
    while (lines.length <= index) lines.push('')
    lines[index] = text.replace(/\n/g, ' ')
    layout.value.__grid_labels__ = lines.join('\n')
    commitLayout()
    void fetchElements()
    scheduleRefresh(0)
  }

  function reloadFromWidget() {
    layout.value = parseLayout(readWidgetStr(node, 'layout', '{}'))
  }

  watch(() => state().inputs.map(i => `${i.slot}:${i.content ?? ''}`).join('|'), () => {
    scheduleRefresh(120)
  })

  return {
    layout, templateDefs, templates, editMode, snap, activeIdx, imgEditId,
    snapGuides, previewHtml, previewError, refreshTick,
    elements, hasElements, activeElement,
    selectedIds, selectedElements, selectOnly, toggleSelect, clearSelection,
    selectRegion, applyArrange, elementRot,
    guides, addGuide, setGuidePos, removeGuide, gridOn, toggleGrid,
    template, posterWidth, posterHeight, upstreamImageUrls,
    commitLayout, setRect, effRect, getColor, setColor, getFont, setFont,
    collectParams, doRefresh, scheduleRefresh, fetchElements, fetchTemplates,
    setTemplate, applySizePreset, setPosterSize,
    addElement, deleteActive, elementImageProps,
    startDrag, moveDrag, endDrag, drag,
    startImgDrag, moveImgDrag, endImgDrag, imgDrag, setImgScale,
    setElementProp, connectedImages, slotOf, setSlot,
    gridLabels, setGridLabelLine, reloadFromWidget,
  }
}

export { eff, rectPx, handlePts, hitTest, clamp }
export type { Rect, DragMode, Guide }
export { getWidget }
