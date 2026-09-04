import { ref, watch } from 'vue'

import { applyImageFilter, defaultFilterParams, type FilterOp } from '../../filters'
import { rasterizeSelectionToLocal, SetContentCommand, type RasterData } from '../../engine'
import { newCanvas, type StageCtx } from './stageContext'

export function createStageFilters(ctx: StageCtx) {
  const { editor, content, engineNode, activeId } = ctx
  const filterSession = ref<{ nodeId: string; op: FilterOp; params: Record<string, number> } | null>(null)
  const lastFilter = ref<{ op: FilterOp; params: Record<string, number> } | null>(null)
  let filterRaf: number | null = null

  function renderFilterPreview(): void {
    const s = filterSession.value
    if (!s) return
    const n = engineNode(s.nodeId)
    if (!n || n.kind !== 'raster') return
    const entry = content.get((n as RasterData).contentId)
    if (!entry) return
    editor.setPaintPreview(`content:${s.nodeId}`, applyImageFilter(s.op, entry.canvas, s.params))
    ctx.requestRender()
  }
  function scheduleFilterPreview(): void {
    if (filterRaf != null) return
    filterRaf = requestAnimationFrame(() => {
      filterRaf = null
      renderFilterPreview()
    })
  }
  function startFilter(op: FilterOp): void {
    if (!activeId.value) return
    const n = engineNode(activeId.value)
    if (!n || n.kind !== 'raster' || n.locks.content) return
    editor.warpCancel()
    cancelFilter()
    filterSession.value = { nodeId: n.id, op, params: defaultFilterParams(op) }
    renderFilterPreview()
  }
  function repeatLastFilter(): void {
    const last = lastFilter.value
    if (!last || !activeId.value) return
    const n = engineNode(activeId.value)
    if (!n || n.kind !== 'raster' || n.locks.content) return
    cancelFilter()
    filterSession.value = { nodeId: n.id, op: last.op, params: { ...last.params } }
    applyFilter()
  }
  function updateFilterParam(key: string, value: number): void {
    const s = filterSession.value
    if (!s) return
    s.params = { ...s.params, [key]: value }
    scheduleFilterPreview()
  }
  function applyFilter(): void {
    const s = filterSession.value
    if (!s) return
    const n = engineNode(s.nodeId)
    if (!n || n.kind !== 'raster') {
      cancelFilter()
      return
    }
    const r = n as RasterData
    const entry = content.get(r.contentId)
    if (!entry) {
      cancelFilter()
      return
    }
    let out = applyImageFilter(s.op, entry.canvas, s.params)
    const doc = editor.document()
    if (doc.selectionId) {
      const ch = doc.channels.find((c) => c.id === doc.selectionId && c.enabled)
      const selCanvas = ch ? content.get(ch.contentId)?.canvas : null
      if (selCanvas) {
        const w = out.width
        const h = out.height
        const tf = r.transform.w > 0 && r.transform.h > 0 ? r.transform : { x: 0, y: 0, w, h, rotation: 0 }
        const cov = rasterizeSelectionToLocal(selCanvas, tf, w, h)
        if (cov) {
          const mixed = newCanvas(w, h)
          const mg = mixed.getContext('2d')!
          mg.drawImage(entry.canvas, 0, 0, w, h)
          const base = mg.getImageData(0, 0, w, h)
          const fg = out.getContext('2d')!.getImageData(0, 0, w, h)
          for (let p = 0; p < cov.length; p++) {
            const c = cov[p]
            if (c <= 0) continue
            const i = p * 4
            for (let k = 0; k < 4; k++) {
              base.data[i + k] = Math.round(base.data[i + k] * (1 - c) + fg.data[i + k] * c)
            }
          }
          mg.putImageData(base, 0, 0)
          out = mixed
        }
      }
    }
    const beforeId = r.contentId
    const beforeUrl = r.url
    const afterId = content.register(out)
    r.contentId = afterId
    r.url = undefined
    editor.history.push(new SetContentCommand('Filter', r, beforeId, afterId, content, beforeUrl))
    lastFilter.value = { op: s.op, params: { ...s.params } }
    editor.setPaintPreview(`content:${s.nodeId}`, null)
    filterSession.value = null
    editor.invalidate()
  }
  function cancelFilter(): void {
    const s = filterSession.value
    if (!s) return
    editor.setPaintPreview(`content:${s.nodeId}`, null)
    filterSession.value = null
    ctx.requestRender()
  }
  watch(activeId, () => cancelFilter())
  return { filterSession, lastFilter, startFilter, repeatLastFilter, updateFilterParam, applyFilter, cancelFilter }
}
