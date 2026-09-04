import { ADJUST_CODE, lutDataFor, packParams, type AdjustmentOp } from '../adjust'
import { ATLAS_CAPACITY } from '../compositor/tileAtlas'
import type { CompositeInput, NodeTexture, TileLayerInput } from '../compositor'
import type { Document } from '../document'
import { defaultMode, resolveMode } from '../mode'
import type { AdjustmentData, GroupData, RasterData, Rect, SceneNode, Transform } from '../node'
import { getNodeKind, type RenderNodeCtx } from '../nodeKind'
import { fxStamp, getFxProcessed, type LayerFxData } from './layerFx'
import type { Bitmap } from './place'
import type { BuiltInputs, PreviewOverride, RenderDeps } from './renderStack'
import type { TileRegion } from '../tile/tileBuffer'

export function docRectToSourceRect(r: Rect, q: Transform, srcW: number, srcH: number): Rect {
  const cx = q.x + q.w / 2
  const cy = q.y + q.h / 2
  const cos = Math.cos(q.rotation)
  const sin = Math.sin(q.rotation)
  const sx = srcW / Math.max(1e-6, q.w)
  const sy = srcH / Math.max(1e-6, q.h)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [px, py] of [
    [r.x, r.y],
    [r.x + r.w, r.y],
    [r.x, r.y + r.h],
    [r.x + r.w, r.y + r.h],
  ] as const) {
    const dx = px - cx
    const dy = py - cy
    const lx = (cos * dx + sin * dy + q.w / 2) * sx
    const ly = (-sin * dx + cos * dy + q.h / 2) * sy
    minX = Math.min(minX, lx)
    minY = Math.min(minY, ly)
    maxX = Math.max(maxX, lx)
    maxY = Math.max(maxY, ly)
  }
  const x = Math.max(0, Math.floor(minX) - 1)
  const y = Math.max(0, Math.floor(minY) - 1)
  return {
    x,
    y,
    w: Math.min(srcW, Math.ceil(maxX) + 1) - x,
    h: Math.min(srcH, Math.ceil(maxY) + 1) - y,
  }
}

function makePlaced(deps: RenderDeps, region: Rect, fxRef: { current: LayerFxData[] | null }) {
  return (
    cacheKey: string,
    contentStamp: string,
    bitmap: Bitmap,
    transform: Transform,
    linear = false,
    version?: number,
    dirtyRects?: Rect[] | null
  ): NodeTexture | null => {
    let fxTag = ''
    const fx = fxRef.current
    if (fx && fx.length && cacheKey.startsWith('content:')) {
      const processed = getFxProcessed(cacheKey, contentStamp, bitmap, fx)
      if (processed) {
        const sx = transform.w / Math.max(1, bitmap.width)
        const sy = transform.h / Math.max(1, bitmap.height)
        bitmap = processed.canvas
        transform = {
          x: transform.x - processed.pad * sx,
          y: transform.y - processed.pad * sy,
          w: transform.w + 2 * processed.pad * sx,
          h: transform.h + 2 * processed.pad * sy,
          rotation: transform.rotation,
        }
        fxTag = `|${fxStamp(fx)}`
      }
    }
    const stamp = `tex:${contentStamp}|${bitmap.width}x${bitmap.height}${fxTag}`
    return {
      source: bitmap,
      rect: region,
      linear,
      quad: transform,
      key: stamp,
      stamp,
      version: fxTag ? undefined : version,
      dirtyRects: fxTag ? undefined : (dirtyRects ?? undefined),
    }
  }
}

type PlacedFn = ReturnType<typeof makePlaced>

function renderMaskTexture(
  node: SceneNode,
  region: Rect,
  deps: RenderDeps,
  placed: PlacedFn
): NodeTexture | undefined {
  const m = node.mask
  if (!m || !m.enabled) return undefined
  const tf =
    node.transform.w > 0 && node.transform.h > 0
      ? node.transform
      : { x: 0, y: 0, w: region.w, h: region.h, rotation: 0 }
  const override = deps.overrides?.get(`mask:${node.id}`)
  if (override) {
    return renderPreviewTexture(`preview:mask:${node.id}`, override, tf, region, true) ?? undefined
  }
  const entry = deps.content.get(m.contentId)
  if (!entry) return undefined
  const scale = Math.min(tf.w / Math.max(1, entry.width), tf.h / Math.max(1, entry.height))
  const src = deps.content.renderSource?.(m.contentId, scale)
  const bitmap = src?.bitmap ?? entry.canvas
  if (!bitmap) return undefined
  return placed(`mask:${node.id}`, m.contentId, bitmap, tf, true, src?.version, src?.dirtyRects) ?? undefined
}

function tryTileInput(
  node: SceneNode,
  region: Rect,
  deps: RenderDeps,
  placed: PlacedFn
): TileLayerInput | null {
  if (node.kind !== 'raster' || node.fx?.length) return null
  if (deps.overrides?.get(`content:${node.id}`)) return null
  const raster = node as RasterData
  const entry = deps.content.get(raster.contentId)
  if (!entry || entry.isBlank) return null
  const t = node.transform
  const scale = Math.min(t.w / Math.max(1, entry.width), t.h / Math.max(1, entry.height))
  if (scale < 0.5) return null
  let wanted: TileRegion | null = null
  const v = deps.viewport
  if (v && Math.abs(t.rotation) < 1e-6 && t.w > 0 && t.h > 0) {
    const sx = entry.width / t.w
    const sy = entry.height / t.h
    wanted = { x: (v.x - t.x) * sx, y: (v.y - t.y) * sy, w: v.w * sx, h: v.h * sy }
  }
  const grid = deps.content.tileGridOf?.(raster.contentId, wanted)
  if (!grid) return null
  let byteTiles = 0
  for (const gt of grid.tiles) if (!gt.uniform) byteTiles++
  if (byteTiles > ATLAS_CAPACITY) return null
  const mode = resolveMode(node.mode)
  return {
    tiles: {
      grid, quad: t, linear: false, drawZero: mode.composite !== 'union',
      proxy: deps.content.proxyTile ? (i: number) => deps.content.proxyTile!(raster.contentId, i) : undefined,
    },
    mode,
    opacity: node.opacity,
    mask: renderMaskTexture(node, region, deps, placed),
  }
}

function renderLeafTexture(node: SceneNode, ctx: RenderNodeCtx, deps: RenderDeps): NodeTexture | null {
  const override = deps.overrides?.get(`content:${node.id}`)
  if (override) {
    const texture = renderPreviewTexture(`preview:content:${node.id}`, override, node.transform, ctx.region, false)
    if (texture) return texture
  }
  return getNodeKind(node.kind).renderNode(node, ctx)
}

function renderPreviewTexture(
  cacheKey: string,
  override: PreviewOverride,
  transform: Transform,
  region: Rect,
  linear: boolean
): NodeTexture | null {
  const src = override.canvas
  const dirty = override.rects
    ? override.rects.map((r) => docRectToSourceRect(r, transform, src.width, src.height))
    : undefined
  return {
    source: src,
    rect: region,
    linear,
    quad: transform,
    key: cacheKey,
    version: override.version,
    dirtyRects: dirty,
  }
}

function isClip(node: SceneNode): boolean {
  return node.clip === true
}

export function buildInputs(group: GroupData, doc: Document, deps: RenderDeps): BuiltInputs {
  const region: Rect = { x: 0, y: 0, w: doc.width, h: doc.height }
  const inputs: CompositeInput[] = []
  const cleanups: Array<() => void> = []
  const fxRef: { current: LayerFxData[] | null } = { current: null }
  const placed = makePlaced(deps, region, fxRef)
  const ctx: RenderNodeCtx = {
    compositor: deps.compositor,
    content: deps.content,
    renderChild: () => null,
    placed,
    region,
    devicePixelRatio: deps.devicePixelRatio ?? 1,
  }

  const children = group.children
  const emitNode = (node: SceneNode, out: CompositeInput[]): void => {
    if (node.kind === 'adjustment') { emitAdjustment(node, out, region, deps, placed); return }
    if (node.kind === 'group') { emitGroup(node as GroupData, doc, deps, out, cleanups, region, placed); return }
    const tileInput = tryTileInput(node, region, deps, placed)
    if (tileInput) { out.push(tileInput); return }
    fxRef.current = node.fx?.length ? node.fx : null
    const texture = renderLeafTexture(node, ctx, deps)
    fxRef.current = null
    if (!texture) return
    out.push({ texture, opacity: node.opacity, mode: resolveMode(node.mode), mask: renderMaskTexture(node, region, deps, placed) })
  }

  for (let i = 0; i < children.length; i++) {
    const node = children[i]
    if (!node.visible || node.opacity <= 0) continue
    if (isClip(node)) { emitNode(node, inputs); continue }

    let j = i + 1
    while (j < children.length && isClip(children[j])) j++
    const clipMembers = children.slice(i + 1, j).filter((n) => n.visible && n.opacity > 0)
    if (!clipMembers.length) { emitNode(node, inputs); continue }

    const handle = deps.compositor.allocTarget(doc.width, doc.height)
    const sub: CompositeInput[] = []
    emitNode({ ...node, mode: defaultMode('normal'), opacity: 1 } as SceneNode, sub)
    const baseCount = sub.length
    for (const member of clipMembers) emitNode(member, sub)
    for (let k = baseCount; k < sub.length; k++) {
      const inp = sub[k]
      if ('texture' in inp || 'tiles' in inp) (inp as { clipToBackdrop?: boolean }).clipToBackdrop = true
    }
    deps.compositor.composite(sub, handle)
    cleanups.push(() => deps.compositor.freeTarget(handle))
    inputs.push({
      texture: { source: deps.compositor.targetTexture(handle), rect: region, linear: true },
      opacity: node.opacity,
      mode: resolveMode(node.mode),
      mask: renderMaskTexture(node, region, deps, placed),
    })
    i = j - 1
  }

  return { inputs, cleanup: () => cleanups.forEach((fn) => fn()) }
}

function emitAdjustment(node: SceneNode, inputs: CompositeInput[], region: Rect, deps: RenderDeps, placed: PlacedFn): void {
  const adj = node as AdjustmentData
  const docSpace = { ...node, transform: { x: 0, y: 0, w: region.w, h: region.h, rotation: 0 } } as SceneNode
  inputs.push({
    adjust: {
      op: ADJUST_CODE[adj.op as AdjustmentOp] ?? 0,
      params: packParams(adj.op as AdjustmentOp, adj.params),
      lut: lutDataFor(adj.op as AdjustmentOp, adj.params, adj.curves),
    },
    opacity: node.opacity,
    mask: renderMaskTexture(docSpace, region, deps, placed),
  })
}

function emitGroup(
  g: GroupData,
  doc: Document,
  deps: RenderDeps,
  inputs: CompositeInput[],
  cleanups: Array<() => void>,
  region: Rect,
  placed: PlacedFn
): void {
  const sub = buildInputs(g, doc, deps)
  if (g.passThrough) {
    inputs.push(...sub.inputs)
    cleanups.push(sub.cleanup)
    return
  }
  const handle = deps.compositor.allocTarget(doc.width, doc.height)
  deps.compositor.composite(sub.inputs, handle)
  sub.cleanup()
  cleanups.push(() => deps.compositor.freeTarget(handle))
  inputs.push({
    texture: { source: deps.compositor.targetTexture(handle), rect: region, linear: true },
    opacity: g.opacity,
    mode: resolveMode(g.mode),
    mask: renderMaskTexture(g, region, deps, placed),
  })
}

export function buildDocumentInputs(doc: Document, deps: RenderDeps): BuiltInputs {
  return buildInputs(doc.root, doc, deps)
}

export function renderDocument(doc: Document, deps: RenderDeps, extra?: CompositeInput[], region?: Rect | null): void {
  deps.compositor.beginFrame?.()
  const { inputs, cleanup } = buildInputs(doc.root, doc, deps)
  deps.compositor.composite(extra?.length ? [...inputs, ...extra] : inputs, null, region ?? undefined)
  cleanup()
}
