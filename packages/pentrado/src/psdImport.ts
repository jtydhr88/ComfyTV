import type { Layer, Psd } from 'ag-psd'

import { psdEffectsToFx } from './psdEffects'

import {
  adjustmentKind,
  defaultMode,
  deriveVectorTransform,
  fillKind,
  generateId,
  groupKind,
  rasterKind,
  textKind,
  vectorKind,
  type ChannelData,
  type FontRef,
  type SceneNode,
  type StrokeStyle,
  type Transform,
} from './engine'
import {
  adjustmentFromPsd,
  alignFromPsd,
  bezierPathsToPath,
  blendFromPsd,
  psdColorToHex,
  vectorContentToFill,
} from './psdMapping'

export interface PsdImportDeps {
  registerContent: (canvas: HTMLCanvasElement) => string
  matchFont: (name: string | undefined) => FontRef
  decodePng?: (data: Uint8Array) => Promise<HTMLCanvasElement | null>
  makeCanvas?: (w: number, h: number) => HTMLCanvasElement
}

export interface PsdImportResult {
  width: number
  height: number
  nodes: SceneNode[]
  warnings: string[]
  guides: Array<{ axis: 'x' | 'y'; pos: number }>
}

const num = (v: unknown, d: number): number => (typeof v === 'number' && isFinite(v) ? v : d)

export interface BufferedRegistry {
  registerContent: (canvas: HTMLCanvasElement) => string
  commit: (register: (canvas: HTMLCanvasElement, id: string) => void) => void
}

export function bufferedContentRegistry(): BufferedRegistry {
  const pending: Array<{ id: string; canvas: HTMLCanvasElement }> = []
  return {
    registerContent: (canvas) => {
      const id = generateId('content')
      pending.push({ id, canvas })
      return id
    },
    commit: (register) => {
      for (const p of pending) register(p.canvas, p.id)
      pending.length = 0
    },
  }
}

export async function decodePngBytes(data: Uint8Array): Promise<HTMLCanvasElement | null> {
  try {
    const blob = new Blob([data as unknown as BlobPart], { type: 'image/png' })
    const url = URL.createObjectURL(blob)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('png decode failed'))
        el.src = url
      })
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const g = c.getContext('2d')
      if (!g) return null
      g.drawImage(img, 0, 0)
      return c
    } finally {
      URL.revokeObjectURL(url)
    }
  } catch {
    return null
  }
}

function defaultMakeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

interface ImportCtx extends PsdImportDeps {
  psd: Psd
  warnings: string[]
  linkedData: Map<string, Uint8Array>
}

function baseProps(layer: Layer) {
  return {
    name: layer.name || 'Layer',
    visible: !layer.hidden,
    opacity: num(layer.opacity, 1),
    mode: defaultMode(blendFromPsd(layer.blendMode)),
    fx: psdEffectsToFx(layer.effects),
  }
}

function importMask(layer: Layer, target: Transform, ctx: ImportCtx): ChannelData | undefined {
  const m = layer.mask
  if (!m?.canvas) return undefined
  const makeCanvas = ctx.makeCanvas ?? defaultMakeCanvas
  const w = target.w > 0 ? target.w : ctx.psd.width
  const h = target.h > 0 ? target.h : ctx.psd.height
  const ox = target.w > 0 ? target.x : 0
  const oy = target.h > 0 ? target.y : 0
  const local = makeCanvas(w, h)
  const g = local.getContext('2d')
  if (!g) return undefined
  const fill = num(m.defaultColor, 0)
  g.fillStyle = `rgb(${fill},${fill},${fill})`
  g.fillRect(0, 0, local.width, local.height)
  g.drawImage(m.canvas, num(m.left, 0) - ox, num(m.top, 0) - oy)
  return {
    id: generateId('mask'),
    role: 'mask',
    contentId: ctx.registerContent(local),
    enabled: !m.disabled,
  }
}

function importText(layer: Layer, ctx: ImportCtx): SceneNode {
  const text = layer.text!
  const style = text.style ?? {}
  const fontSize = num(style.fontSize, 16)
  const tf = Array.isArray(text.transform) && text.transform.length >= 6 ? text.transform : [1, 0, 0, 1, 0, 0]
  const rotation = Math.atan2(num(tf[1], 0), num(tf[0], 1))
  const w = Math.max(1, num(layer.right, 0) - num(layer.left, 0)) || 200
  const h = Math.max(1, num(layer.bottom, 0) - num(layer.top, 0)) || Math.ceil(fontSize * 1.4)
  const leading = num(style.leading, 0)
  return textKind.create({
    ...baseProps(layer),
    text: text.text ?? '',
    fontRef: ctx.matchFont(style.font?.name),
    fontSize,
    color: psdColorToHex(style.fillColor),
    letterSpacing: (num(style.tracking, 0) / 1000) * fontSize,
    lineHeight: leading > 0 && fontSize > 0 ? leading / fontSize : 1.2,
    align: alignFromPsd(text.paragraphStyle?.justification),
    transform: { x: num(tf[4], 0), y: num(tf[5], 0) - fontSize, w, h, rotation },
  })
}

function importVector(layer: Layer, ctx: ImportCtx): SceneNode | null {
  const path = bezierPathsToPath(layer.vectorMask!.paths ?? [])
  if (!path.strokes.length) return null
  const fillSpec = vectorContentToFill(layer.vectorFill)
  const vs = layer.vectorStroke
  let stroke: StrokeStyle | undefined
  if (vs?.strokeEnabled && vs.content?.type === 'color') {
    stroke = {
      color: psdColorToHex(vs.content.color),
      width: Math.max(0, num(vs.lineWidth?.value, 2)),
      cap: vs.lineCapType ?? 'butt',
      join: vs.lineJoinType ?? 'miter',
      opacity: num(vs.opacity, 1),
    }
  }
  const fillEnabled = vs ? vs.fillEnabled !== false : true
  return vectorKind.create({
    ...baseProps(layer),
    path,
    fill: fillEnabled && fillSpec?.type === 'solid' ? { color: fillSpec.color, rule: 'nonzero', opacity: 1 } : undefined,
    stroke,
    transform: deriveVectorTransform(path, stroke?.width ?? 0),
  })
}

function importFill(layer: Layer): SceneNode | null {
  const spec = vectorContentToFill(layer.vectorFill)
  if (!spec) return null
  return fillKind.create({ ...baseProps(layer), fill: spec })
}

function transformFromCorners(corners: number[], fallback: Transform): Transform {
  if (!Array.isArray(corners) || corners.length < 8) return fallback
  const [x0, y0, x1, y1, , , x3, y3] = corners.map((v) => num(v, 0))
  const w = Math.hypot(x1 - x0, y1 - y0)
  const h = Math.hypot(x3 - x0, y3 - y0)
  if (w < 1e-3 || h < 1e-3) return fallback
  const rotation = Math.atan2(y1 - y0, x1 - x0)
  const cx = (x0 + x1) / 2 + (x3 - x0) / 2
  const cy = (y0 + y1) / 2 + (y3 - y0) / 2
  return { x: cx - w / 2, y: cy - h / 2, w, h, rotation }
}

async function importRaster(layer: Layer, ctx: ImportCtx): Promise<SceneNode | null> {
  const placed = layer.placedLayer
  if (placed && ctx.decodePng) {
    const data = ctx.linkedData.get(placed.id)
    if (data) {
      const source = await ctx.decodePng(data).catch(() => null)
      if (source) {
        const fallback: Transform = {
          x: num(layer.left, 0),
          y: num(layer.top, 0),
          w: layer.canvas?.width ?? source.width,
          h: layer.canvas?.height ?? source.height,
          rotation: 0,
        }
        return rasterKind.create({
          ...baseProps(layer),
          contentId: ctx.registerContent(source),
          naturalWidth: source.width,
          naturalHeight: source.height,
          transform: transformFromCorners(placed.transform, fallback),
        })
      }
    }
  }
  if (!layer.canvas) return null
  return rasterKind.create({
    ...baseProps(layer),
    contentId: ctx.registerContent(layer.canvas),
    naturalWidth: layer.canvas.width,
    naturalHeight: layer.canvas.height,
    transform: {
      x: num(layer.left, 0),
      y: num(layer.top, 0),
      w: layer.canvas.width,
      h: layer.canvas.height,
      rotation: 0,
    },
  })
}

async function importLayer(layer: Layer, ctx: ImportCtx): Promise<SceneNode | null> {
  if (layer.children !== undefined) {
    const children: SceneNode[] = []
    for (const child of layer.children) {
      const node = await importLayer(child, ctx)
      if (node) children.push(node)
    }
    const passThrough = layer.blendMode === 'pass through'
    const group = groupKind.create({
      ...baseProps(layer),
      mode: passThrough ? defaultMode('normal') : baseProps(layer).mode,
      children,
      passThrough,
    })
    group.mask = importMask(layer, group.transform, ctx)
    return group
  }

  let node: SceneNode | null = null
  if (layer.adjustment) {
    const mapped = adjustmentFromPsd(layer.adjustment)
    if (mapped) {
      node = adjustmentKind.create({
        ...baseProps(layer),
        op: mapped.op,
        params: mapped.params,
        curves: mapped.curves,
        transform: { x: 0, y: 0, w: ctx.psd.width, h: ctx.psd.height, rotation: 0 },
      })
    } else {
      ctx.warnings.push(`unsupported adjustment "${layer.adjustment.type}" on "${layer.name || 'layer'}"`)
      return null
    }
  } else if (layer.text) {
    node = importText(layer, ctx)
  } else if (layer.vectorMask?.paths?.length) {
    node = importVector(layer, ctx)
    if (!node) node = await importRaster(layer, ctx)
  } else if (layer.vectorFill) {
    node = importFill(layer)
    if (!node) node = await importRaster(layer, ctx)
  } else {
    node = await importRaster(layer, ctx)
  }
  if (!node) {
    if (!layer.adjustment) ctx.warnings.push(`skipped empty layer "${layer.name || 'layer'}"`)
    return null
  }
  node.mask = importMask(layer, node.transform, ctx)
  return node
}

export async function psdToNodes(psd: Psd, deps: PsdImportDeps): Promise<PsdImportResult> {
  const linkedData = new Map<string, Uint8Array>()
  for (const file of psd.linkedFiles ?? []) {
    if (file.data) linkedData.set(file.id, file.data)
  }
  const ctx: ImportCtx = { ...deps, psd, warnings: [], linkedData }
  const nodes: SceneNode[] = []
  for (const layer of psd.children ?? []) {
    const node = await importLayer(layer, ctx)
    if (node) nodes.push(node)
  }
  const guides: PsdImportResult['guides'] = []
  for (const g of psd.imageResources?.gridAndGuidesInformation?.guides ?? []) {
    const pos = num(g.location, NaN)
    if (!isFinite(pos)) continue
    guides.push({ axis: g.direction === 'vertical' ? 'x' : 'y', pos })
  }
  return {
    width: Math.max(1, num(psd.width, 1)),
    height: Math.max(1, num(psd.height, 1)),
    nodes,
    warnings: ctx.warnings,
    guides,
  }
}
