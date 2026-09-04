import { Dirty, generateId, rasterizeSelectionToLocal, SetContentCommand, type RasterData, type Transform } from '../../engine'
import { newCanvas, type StageCtx } from './stageContext'

export type MaskInit = 'white' | 'black' | 'selection' | 'alpha' | 'gray'

export function createStageMasks(ctx: StageCtx) {
  const { editor, content, engineNode, paintTarget } = ctx

  function solidMask(w: number, h: number, color: string): HTMLCanvasElement {
    const c = newCanvas(w, h)
    const g = c.getContext('2d')!
    g.fillStyle = color
    g.fillRect(0, 0, w, h)
    return c
  }
  function maskFromLayerPixels(n: RasterData, w: number, h: number, source: 'alpha' | 'gray'): HTMLCanvasElement | null {
    const entry = content.get(n.contentId)
    if (!entry) return null
    const src = newCanvas(w, h)
    const sg = src.getContext('2d')!
    sg.drawImage(entry.canvas, 0, 0, w, h)
    const img = sg.getImageData(0, 0, w, h)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const v = source === 'alpha'
        ? d[i + 3]
        : Math.round((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) * (d[i + 3] / 255))
      d[i] = d[i + 1] = d[i + 2] = v
      d[i + 3] = 255
    }
    sg.putImageData(img, 0, 0)
    return src
  }
  function maskFromSelection(tf: Transform, w: number, h: number): HTMLCanvasElement | null {
    const d = editor.document()
    if (!d.selectionId) return null
    const channel = d.channels.find((ch) => ch.id === d.selectionId)
    if (!channel) return null
    const entry = content.get(channel.contentId)
    if (!entry) return null
    const cov = rasterizeSelectionToLocal(entry.canvas, tf, w, h)
    if (!cov) return null
    const c = newCanvas(w, h)
    const g = c.getContext('2d')!
    const img = g.createImageData(w, h)
    for (let p = 0; p < cov.length; p++) {
      const v = Math.round(cov[p] * 255)
      img.data[p * 4] = img.data[p * 4 + 1] = img.data[p * 4 + 2] = v
      img.data[p * 4 + 3] = 255
    }
    g.putImageData(img, 0, 0)
    return c
  }
  function addMask(id: string, init: MaskInit = 'white'): void {
    if (editor.selectedNodeIds().length > 1) return
    const n = engineNode(id); if (!n || n.mask) return
    const d = editor.document()
    const docSized = n.kind === 'adjustment' || n.kind === 'fill' || n.kind === 'group'
    const w = n.kind === 'raster' ? (n as RasterData).naturalWidth : docSized ? d.width : Math.max(1, Math.round(n.transform.w))
    const h = n.kind === 'raster' ? (n as RasterData).naturalHeight : docSized ? d.height : Math.max(1, Math.round(n.transform.h))
    const tf = n.transform.w > 0 && n.transform.h > 0 ? n.transform : { x: 0, y: 0, w, h, rotation: 0 }
    let canvas: HTMLCanvasElement | null = null
    if (init === 'black') canvas = solidMask(w, h, '#000000')
    else if (init === 'selection') canvas = maskFromSelection(tf, w, h)
    else if (init === 'alpha' || init === 'gray') {
      if (n.kind === 'raster') canvas = maskFromLayerPixels(n as RasterData, w, h, init)
    }
    canvas ??= solidMask(w, h, '#ffffff')
    const cid = content.register(canvas)
    ctx.editProp('Add Mask', Dirty.CHANNEL, () => n.mask, (m) => (n.mask = m), { id: generateId('mask'), role: 'mask', contentId: cid, enabled: true })
    paintTarget.value = 'mask'
  }
  function removeMask(id: string): void {
    const n = engineNode(id); if (!n || !n.mask) return
    ctx.editProp('Delete Mask', Dirty.CHANNEL, () => n.mask, (m) => (n.mask = m), undefined)
    paintTarget.value = 'content'
  }
  function toggleMaskEnabled(id: string): void {
    const n = engineNode(id); if (!n || !n.mask) return
    const mask = n.mask
    ctx.editProp('Toggle Mask', Dirty.CHANNEL, () => mask.enabled, (x) => (mask.enabled = x), !mask.enabled)
  }
  function invertMask(id: string): void {
    const n = engineNode(id); if (!n || !n.mask) return
    const mask = n.mask
    const entry = content.get(mask.contentId)
    if (!entry) return
    const c = newCanvas(entry.width, entry.height)
    const g = c.getContext('2d')!
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, entry.width, entry.height)
    g.globalCompositeOperation = 'difference'
    g.drawImage(entry.canvas, 0, 0)
    const beforeId = mask.contentId
    const beforeUrl = mask.url
    const afterId = content.register(c)
    mask.contentId = afterId
    mask.url = undefined
    editor.history.push(new SetContentCommand('Invert Mask', mask, beforeId, afterId, content, beforeUrl))
    editor.invalidate()
  }
  function applyMask(id: string): void {
    const n = engineNode(id)
    if (!n || !n.mask || n.kind !== 'raster') return
    const r = n as RasterData
    const contentEntry = content.get(r.contentId)
    const maskEntry = content.get(n.mask.contentId)
    if (!contentEntry || !maskEntry) return
    const w = contentEntry.width
    const h = contentEntry.height
    const scaled = newCanvas(w, h)
    scaled.getContext('2d')!.drawImage(maskEntry.canvas, 0, 0, w, h)
    const maskData = scaled.getContext('2d')!.getImageData(0, 0, w, h).data
    const c = newCanvas(w, h)
    const g = c.getContext('2d')!
    g.drawImage(contentEntry.canvas, 0, 0)
    const img = g.getImageData(0, 0, w, h)
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i + 3] = (img.data[i + 3] * maskData[i]) / 255
    }
    g.putImageData(img, 0, 0)
    const beforeId = r.contentId
    const beforeUrl = r.url
    const afterId = content.register(c)
    editor.history.beginGroup('Apply Mask')
    r.contentId = afterId
    r.url = undefined
    editor.history.push(new SetContentCommand('Apply Mask', r, beforeId, afterId, content, beforeUrl))
    ctx.editProp('Delete Mask', Dirty.CHANNEL, () => n.mask, (m) => (n.mask = m), undefined)
    editor.history.endGroup()
    paintTarget.value = 'content'
    editor.invalidate()
  }
  function maskToSelection(id: string): void {
    if (editor.maskToSelection(id)) editor.invalidate()
  }
  return { addMask, removeMask, toggleMaskEnabled, invertMask, applyMask, maskToSelection }
}
