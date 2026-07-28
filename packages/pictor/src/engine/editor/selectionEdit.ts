import { SetContentCommand } from '../commands/setContent'
import type { ContentStore } from '../content'
import type { Command } from '../history'
import type { RasterData, Rect, Transform } from '../node'
import { rasterizeSelectionToLocal } from '../tools/paintTarget'

export interface SelectionClipboard {
  canvas: HTMLCanvasElement
  bounds: Rect
}

export interface SelectionEditDeps {
  content: ContentStore
  push(cmd: Command): void
}

function localCoverage(
  node: RasterData,
  content: ContentStore,
  selCanvas: HTMLCanvasElement
): { cov: Float32Array; entry: { canvas: HTMLCanvasElement }; tf: Transform } | null {
  const entry = content.get(node.contentId)
  if (!entry) return null
  const nw = node.naturalWidth
  const nh = node.naturalHeight
  const tf = node.transform.w > 0 && node.transform.h > 0
    ? node.transform
    : { x: 0, y: 0, w: nw, h: nh, rotation: 0 }
  const cov = rasterizeSelectionToLocal(selCanvas, tf, nw, nh)
  if (!cov) return null
  return { cov, entry, tf }
}

function cloneContent(node: RasterData, entry: { canvas: HTMLCanvasElement }): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } | null {
  const c = document.createElement('canvas')
  c.width = node.naturalWidth
  c.height = node.naturalHeight
  const g = c.getContext('2d')
  if (!g) return null
  g.drawImage(entry.canvas, 0, 0, c.width, c.height)
  return { canvas: c, g }
}

function commitContent(deps: SelectionEditDeps, node: RasterData, label: string, canvas: HTMLCanvasElement): void {
  const beforeId = node.contentId
  const beforeUrl = node.url
  const afterId = deps.content.register(canvas)
  node.contentId = afterId
  node.url = undefined
  deps.push(new SetContentCommand(label, node, beforeId, afterId, deps.content, beforeUrl))
}

export function clearSelectedPixels(deps: SelectionEditDeps, node: RasterData, selCanvas: HTMLCanvasElement): boolean {
  if (node.locks.content) return false
  const loc = localCoverage(node, deps.content, selCanvas)
  if (!loc) return false
  const copy = cloneContent(node, loc.entry)
  if (!copy) return false
  const img = copy.g.getImageData(0, 0, copy.canvas.width, copy.canvas.height)
  let touched = false
  for (let p = 0; p < loc.cov.length; p++) {
    const c = loc.cov[p]
    if (c <= 0) continue
    const i = p * 4 + 3
    if (img.data[i] === 0) continue
    touched = true
    img.data[i] = Math.round(img.data[i] * (1 - c))
  }
  if (!touched) return false
  copy.g.putImageData(img, 0, 0)
  commitContent(deps, node, 'Clear Selection', copy.canvas)
  return true
}

export function fillSelectedPixels(
  deps: SelectionEditDeps,
  node: RasterData,
  selCanvas: HTMLCanvasElement,
  color: [number, number, number]
): boolean {
  if (node.locks.content) return false
  const loc = localCoverage(node, deps.content, selCanvas)
  if (!loc) return false
  const copy = cloneContent(node, loc.entry)
  if (!copy) return false
  const img = copy.g.getImageData(0, 0, copy.canvas.width, copy.canvas.height)
  const lockAlpha = node.lockAlpha === true
  let touched = false
  for (let p = 0; p < loc.cov.length; p++) {
    let c = loc.cov[p]
    if (c <= 0) continue
    const i = p * 4
    const sa = img.data[i + 3] / 255
    if (lockAlpha) c *= sa
    if (c <= 0) continue
    touched = true
    const outA = c + sa * (1 - c)
    if (outA <= 0) continue
    for (let ch = 0; ch < 3; ch++) {
      img.data[i + ch] = Math.round((color[ch] * c + img.data[i + ch] * sa * (1 - c)) / outA)
    }
    img.data[i + 3] = Math.round(outA * 255)
  }
  if (!touched) return false
  copy.g.putImageData(img, 0, 0)
  commitContent(deps, node, 'Fill Selection', copy.canvas)
  return true
}

export function strokeSelectedPixels(
  deps: SelectionEditDeps,
  node: RasterData,
  selCanvas: HTMLCanvasElement,
  color: [number, number, number],
  width: number,
  outlines: Array<Array<{ x: number; y: number }>>
): boolean {
  if (node.locks.content || !outlines.length) return false
  const entry = deps.content.get(node.contentId)
  if (!entry) return false
  const copy = cloneContent(node, entry)
  if (!copy) return false
  const nw = node.naturalWidth
  const nh = node.naturalHeight
  const tf = node.transform.w > 0 && node.transform.h > 0
    ? node.transform
    : { x: 0, y: 0, w: nw, h: nh, rotation: 0 }
  const g = copy.g
  g.save()
  g.scale(nw / (tf.w || 1), nh / (tf.h || 1))
  g.translate(tf.w / 2, tf.h / 2)
  g.rotate(-tf.rotation)
  g.translate(-(tf.x + tf.w / 2), -(tf.y + tf.h / 2))
  g.strokeStyle = `rgb(${color[0]},${color[1]},${color[2]})`
  g.lineWidth = width
  g.lineJoin = 'round'
  for (const loop of outlines) {
    g.beginPath()
    loop.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)))
    g.closePath()
    g.stroke()
  }
  g.restore()
  commitContent(deps, node, 'Stroke Selection', copy.canvas)
  return true
}

export function extractSelectedPixels(
  node: RasterData,
  content: ContentStore,
  selCanvas: HTMLCanvasElement,
  selBounds: Rect
): SelectionClipboard | null {
  const loc = localCoverage(node, content, selCanvas)
  if (!loc) return null
  const nw = node.naturalWidth
  const nh = node.naturalHeight
  const local = document.createElement('canvas')
  local.width = nw
  local.height = nh
  const lg = local.getContext('2d')
  if (!lg) return null
  lg.drawImage(loc.entry.canvas, 0, 0, nw, nh)
  const img = lg.getImageData(0, 0, nw, nh)
  let any = false
  for (let p = 0; p < loc.cov.length; p++) {
    const c = loc.cov[p]
    const i = p * 4 + 3
    const a = Math.round(img.data[i] * c)
    if (a > 0) any = true
    img.data[i] = a
  }
  if (!any) return null
  lg.putImageData(img, 0, 0)

  const w = Math.max(1, Math.round(selBounds.w))
  const h = Math.max(1, Math.round(selBounds.h))
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const og = out.getContext('2d')
  if (!og) return null
  og.imageSmoothingEnabled = true
  og.imageSmoothingQuality = 'high'
  const tf = loc.tf
  og.translate(-selBounds.x, -selBounds.y)
  og.translate(tf.x + tf.w / 2, tf.y + tf.h / 2)
  og.rotate(tf.rotation)
  og.drawImage(local, -tf.w / 2, -tf.h / 2, tf.w, tf.h)
  return { canvas: out, bounds: { x: Math.round(selBounds.x), y: Math.round(selBounds.y), w, h } }
}
