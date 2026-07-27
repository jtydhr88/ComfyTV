import type { Layer, LayerMaskData, LinkedFile, Psd } from 'ag-psd'

import { defaultMode, walk } from './engine'
import type {
  AdjustmentData,
  ContentEntry,
  Document,
  FillData,
  GroupData,
  RasterData,
  SceneNode,
  TextData,
  Transform,
  VectorData,
} from './engine'
import {
  adjustmentToPsd,
  alignToPsd,
  fillToVectorContent,
  hexToPsdColor,
  pathToBezierPaths,
  PSD_BLEND_MODES,
} from './psdMapping'

export { PSD_BLEND_MODES }

export interface PsdGuides {
  horizontal: number[]
  vertical: number[]
}

export interface PsdExportDeps {
  rasterizeLeaf: (node: SceneNode) => HTMLCanvasElement | null
  maskCanvas: (node: SceneNode) => HTMLCanvasElement | null
  composite: () => HTMLCanvasElement
  contentCanvas?: (id: string) => HTMLCanvasElement | null
  fontName?: (node: TextData) => string | undefined
  canvasPng?: (canvas: HTMLCanvasElement) => Promise<Uint8Array>
  guides?: PsdGuides
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

export function makeGuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  let out = ''
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-'
    else out += Math.floor(Math.random() * 16).toString(16)
  }
  return out
}

export function transformCorners(t: Transform): number[] {
  const cx = t.x + t.w / 2
  const cy = t.y + t.h / 2
  const cos = Math.cos(t.rotation)
  const sin = Math.sin(t.rotation)
  const pt = (dx: number, dy: number) => [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]
  const hw = t.w / 2
  const hh = t.h / 2
  return [...pt(-hw, -hh), ...pt(hw, -hh), ...pt(hw, hh), ...pt(-hw, hh)]
}

function maskData(node: SceneNode, doc: Document, deps: PsdExportDeps): LayerMaskData | undefined {
  if (!node.mask) return undefined
  const canvas = deps.maskCanvas(node)
  if (!canvas) return undefined
  return {
    canvas,
    left: 0,
    top: 0,
    right: doc.width,
    bottom: doc.height,
    defaultColor: 0,
    disabled: !node.mask.enabled,
  }
}

function rotatedPointMapper(t: Transform) {
  if (!t.rotation) return undefined
  const cx = t.x + t.w / 2
  const cy = t.y + t.h / 2
  const cos = Math.cos(t.rotation)
  const sin = Math.sin(t.rotation)
  return (pt: { x: number; y: number }) => {
    const dx = pt.x - cx
    const dy = pt.y - cy
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
  }
}

function applyTextData(layer: Layer, node: TextData, deps: PsdExportDeps): void {
  const t = node.transform
  const cos = Math.cos(t.rotation)
  const sin = Math.sin(t.rotation)
  layer.text = {
    text: node.text,
    transform: [cos, sin, -sin, cos, t.x, t.y + node.fontSize],
    shapeType: 'point',
    style: {
      font: { name: deps.fontName?.(node) ?? 'Inter' },
      fontSize: node.fontSize,
      fillColor: hexToPsdColor(node.color),
      autoLeading: false,
      leading: node.lineHeight * node.fontSize,
      tracking: node.fontSize > 0 ? Math.round((node.letterSpacing / node.fontSize) * 1000) : 0,
    },
    paragraphStyle: { justification: alignToPsd(node.align) },
  }
}

function applyVectorData(layer: Layer, node: VectorData): void {
  const map = rotatedPointMapper(node.transform)
  const fillRule = node.fill?.rule === 'evenodd' ? 'even-odd' : 'non-zero'
  layer.vectorMask = { paths: pathToBezierPaths(node.path, fillRule, map) }
  if (node.fill) {
    layer.vectorFill = { type: 'color', color: hexToPsdColor(node.fill.color) }
  }
  if (node.stroke) {
    layer.vectorStroke = {
      strokeEnabled: true,
      fillEnabled: !!node.fill,
      lineWidth: { units: 'Pixels', value: node.stroke.width },
      lineCapType: node.stroke.cap,
      lineJoinType: node.stroke.join,
      opacity: node.stroke.opacity ?? 1,
      content: { type: 'color', color: hexToPsdColor(node.stroke.color) },
    }
    if (!layer.vectorFill && node.fill === undefined) {
      layer.vectorFill = { type: 'color', color: hexToPsdColor(node.stroke.color) }
    }
  }
}

async function applyPlacedLayer(
  layer: Layer,
  node: RasterData,
  deps: PsdExportDeps,
  linkedFiles: LinkedFile[]
): Promise<void> {
  if (!deps.contentCanvas || !deps.canvasPng) return
  const source = deps.contentCanvas(node.contentId)
  if (!source) return
  let data: Uint8Array
  try {
    data = await deps.canvasPng(source)
  } catch {
    return
  }
  const id = makeGuid()
  const corners = transformCorners(node.transform)
  linkedFiles.push({ id, name: `${node.name || 'layer'}.png`, type: 'png ', data })
  layer.placedLayer = {
    id,
    placed: makeGuid(),
    type: 'raster',
    transform: corners,
    nonAffineTransform: corners,
    width: source.width,
    height: source.height,
  }
}

async function buildLayer(
  node: SceneNode,
  doc: Document,
  deps: PsdExportDeps,
  linkedFiles: LinkedFile[]
): Promise<Layer> {
  const layer: Layer = {
    name: node.name,
    hidden: !node.visible,
    opacity: clamp01(node.opacity),
    blendMode: PSD_BLEND_MODES[node.mode.blend] ?? 'normal',
    mask: maskData(node, doc, deps),
  }
  if (node.kind === 'group') {
    const g = node as GroupData
    if (g.passThrough) layer.blendMode = 'pass through'
    layer.opened = true
    layer.children = []
    for (const child of g.children) {
      layer.children.push(await buildLayer(child, doc, deps, linkedFiles))
    }
    return layer
  }
  if (node.kind === 'adjustment') {
    const adj = adjustmentToPsd(node as AdjustmentData)
    if (adj) layer.adjustment = adj
    return layer
  }
  const canvas = deps.rasterizeLeaf(node)
  if (canvas) {
    layer.canvas = canvas
    layer.left = 0
    layer.top = 0
    layer.right = doc.width
    layer.bottom = doc.height
  }
  if (node.kind === 'text') applyTextData(layer, node as TextData, deps)
  else if (node.kind === 'vector') applyVectorData(layer, node as VectorData)
  else if (node.kind === 'fill') layer.vectorFill = fillToVectorContent((node as FillData).fill)
  else if (node.kind === 'raster') await applyPlacedLayer(layer, node as RasterData, deps, linkedFiles)
  return layer
}

export interface PsdRenderHost {
  document(): Document
  render(): void
  readbackCanvas(): HTMLCanvasElement
}

export interface PsdContentSource {
  get(id: string): ContentEntry | undefined
}

export function rasterizeLeavesSolo(host: PsdRenderHost): Map<string, HTMLCanvasElement> {
  const doc = host.document()
  const parents = new Map<string, GroupData>()
  const all: SceneNode[] = []
  walk(doc.root, (n, parent) => {
    all.push(n)
    parents.set(n.id, parent)
  })
  const saved = all.map((n) => ({
    n,
    visible: n.visible,
    opacity: n.opacity,
    mode: n.mode,
    maskEnabled: n.mask?.enabled,
  }))
  const out = new Map<string, HTMLCanvasElement>()
  try {
    for (const leaf of all) {
      if (leaf.kind === 'group' || leaf.kind === 'adjustment') continue
      for (const s of saved) s.n.visible = false
      let cur: SceneNode | undefined = leaf
      while (cur) {
        cur.visible = true
        cur.opacity = 1
        cur.mode = defaultMode('normal')
        if (cur.mask) cur.mask.enabled = false
        const parent = parents.get(cur.id)
        cur = parent && parent !== doc.root ? parent : undefined
      }
      host.render()
      out.set(leaf.id, host.readbackCanvas())
    }
  } finally {
    for (const s of saved) {
      s.n.visible = s.visible
      s.n.opacity = s.opacity
      s.n.mode = s.mode
      if (s.n.mask && s.maskEnabled != null) s.n.mask.enabled = s.maskEnabled
    }
  }
  host.render()
  return out
}

export function maskToDocCanvas(node: SceneNode, doc: Document, content: PsdContentSource): HTMLCanvasElement | null {
  const m = node.mask
  if (!m) return null
  const entry = content.get(m.contentId)
  if (!entry) return null
  const c = document.createElement('canvas')
  c.width = doc.width
  c.height = doc.height
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, doc.width, doc.height)
  const tf = node.transform.w > 0 && node.transform.h > 0
    ? node.transform
    : { x: 0, y: 0, w: doc.width, h: doc.height, rotation: 0 }
  ctx.translate(tf.x + tf.w / 2, tf.y + tf.h / 2)
  ctx.rotate(tf.rotation)
  ctx.drawImage(entry.canvas, -tf.w / 2, -tf.h / 2, tf.w, tf.h)
  return c
}

export async function canvasPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob null'))), 'image/png')
  )
  return new Uint8Array(await blob.arrayBuffer())
}

export async function buildPsdFromEditor(
  host: PsdRenderHost,
  content: PsdContentSource,
  opts?: { fontName?: (node: TextData) => string | undefined; guides?: PsdGuides }
): Promise<Psd> {
  const doc = host.document()
  const rasterized = rasterizeLeavesSolo(host)
  return buildPsd(doc, {
    rasterizeLeaf: (n) => rasterized.get(n.id) ?? null,
    maskCanvas: (n) => maskToDocCanvas(n, doc, content),
    composite: () => host.readbackCanvas(),
    contentCanvas: (id) => content.get(id)?.canvas ?? null,
    fontName: opts?.fontName,
    canvasPng: canvasPngBytes,
    guides: opts?.guides,
  })
}

export async function buildPsd(doc: Document, deps: PsdExportDeps): Promise<Psd> {
  const linkedFiles: LinkedFile[] = []
  const children: Layer[] = []
  for (const node of doc.root.children) {
    children.push(await buildLayer(node, doc, deps, linkedFiles))
  }
  const psd: Psd = {
    width: doc.width,
    height: doc.height,
    canvas: deps.composite(),
    children,
  }
  if (linkedFiles.length) psd.linkedFiles = linkedFiles
  if (deps.guides && (deps.guides.horizontal.length || deps.guides.vertical.length)) {
    psd.imageResources = {
      gridAndGuidesInformation: {
        guides: [
          ...deps.guides.horizontal.map((location) => ({ location, direction: 'horizontal' as const })),
          ...deps.guides.vertical.map((location) => ({ location, direction: 'vertical' as const })),
        ],
      },
    }
  }
  return psd
}
