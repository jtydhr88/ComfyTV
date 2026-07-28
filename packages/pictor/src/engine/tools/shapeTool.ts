import { AddNodeCommand } from '../commands/structure'
import { PropCommand } from '../commands/prop'
import { findNode } from '../document'
import { Dirty, type Command } from '../history'
import { deriveVectorTransform, vectorKind } from '../kinds/vector'
import type { SceneNode, Transform, Vec2, VectorData } from '../node'
import { defaultControl, type Overlay, type Tool, type ToolContext, type ToolControl, type ToolDef } from '../tool'
import {
  arcPath,
  clonePath,
  ellipsePath,
  flattenStroke,
  linePath,
  polygonPath,
  rectPath,
  spiralPath,
  starPath,
  type FillStyle,
  type PathData,
  type StrokeStyle,
} from '../vector'

export type ShapeKind = 'rect' | 'ellipse' | 'line' | 'polygon' | 'star' | 'arc' | 'spiral'

export const STROKE_ONLY_SHAPES: ReadonlySet<ShapeKind> = new Set(['line', 'arc', 'spiral'])

export interface ShapeToolOptions {
  shape: ShapeKind
  fill: FillStyle | null
  stroke: StrokeStyle | null
  combine?: boolean
  sides?: number
  starRatio?: number
  turns?: number
}

export const DEFAULT_SHAPE_OPTIONS: ShapeToolOptions = {
  shape: 'rect',
  fill: { color: '#3b82f6' },
  stroke: null,
  combine: false,
  sides: 6,
  starRatio: 0.5,
  turns: 3,
}

export function appendShapeToVector(node: VectorData, path: PathData): Command {
  const snapshot = () => ({ path: clonePath(node.path), transform: { ...node.transform } })
  const restore = (s: { path: PathData; transform: Transform }) => {
    node.path = clonePath(s.path)
    node.transform = { ...s.transform }
  }
  const before = snapshot()
  node.path = { strokes: [...node.path.strokes, ...clonePath(path).strokes] }
  node.transform = deriveVectorTransform(node.path, node.stroke ? Math.max(0, node.stroke.width) : 0)
  return new PropCommand('Add Shape', Dirty.DRAWABLE, snapshot, restore, before, snapshot())
}

const SHAPE_NAMES: Record<ShapeKind, string> = {
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  line: 'Line',
  polygon: 'Polygon',
  star: 'Star',
  arc: 'Arc',
  spiral: 'Spiral',
}

function constrainCorner(start: Vec2, cur: Vec2): Vec2 {
  const dx = cur.x - start.x
  const dy = cur.y - start.y
  const m = Math.max(Math.abs(dx), Math.abs(dy))
  return { x: start.x + Math.sign(dx || 1) * m, y: start.y + Math.sign(dy || 1) * m }
}

function constrainAngle(start: Vec2, cur: Vec2): Vec2 {
  const dx = cur.x - start.x
  const dy = cur.y - start.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return cur
  const step = Math.PI / 4
  const angle = Math.round(Math.atan2(dy, dx) / step) * step
  return { x: start.x + Math.cos(angle) * len, y: start.y + Math.sin(angle) * len }
}

export function buildShapePath(
  shape: ShapeKind,
  start: Vec2,
  end: Vec2,
  constrain: boolean,
  options?: Pick<ShapeToolOptions, 'sides' | 'starRatio' | 'turns'>
): PathData | null {
  if (shape === 'line' || shape === 'arc') {
    const to = constrain ? constrainAngle(start, end) : end
    if (Math.hypot(to.x - start.x, to.y - start.y) < 2) return null
    if (shape === 'arc') return arcPath(start.x, start.y, to.x, to.y)
    return linePath(start.x, start.y, to.x, to.y)
  }
  if (shape === 'polygon' || shape === 'star' || shape === 'spiral') {
    const to = constrain ? constrainAngle(start, end) : end
    const r = Math.hypot(to.x - start.x, to.y - start.y)
    if (r < 2) return null
    const rotation = Math.atan2(to.y - start.y, to.x - start.x)
    const sides = options?.sides ?? DEFAULT_SHAPE_OPTIONS.sides!
    if (shape === 'polygon') return polygonPath(start.x, start.y, r, sides, rotation)
    if (shape === 'star') {
      const ratio = options?.starRatio ?? DEFAULT_SHAPE_OPTIONS.starRatio!
      return starPath(start.x, start.y, r, r * ratio, sides, rotation)
    }
    return spiralPath(start.x, start.y, r, options?.turns ?? DEFAULT_SHAPE_OPTIONS.turns!, rotation)
  }
  const to = constrain ? constrainCorner(start, end) : end
  const x = Math.min(start.x, to.x)
  const y = Math.min(start.y, to.y)
  const w = Math.abs(to.x - start.x)
  const h = Math.abs(to.y - start.y)
  if (w < 2 || h < 2) return null
  if (shape === 'rect') return rectPath(x, y, w, h)
  return ellipsePath(x + w / 2, y + h / 2, w / 2, h / 2)
}

export function resolveShapeStyles(options: ShapeToolOptions): { fill: FillStyle | null; stroke: StrokeStyle | null } {
  if (STROKE_ONLY_SHAPES.has(options.shape)) {
    const stroke: StrokeStyle = options.stroke
      ? { ...options.stroke }
      : { color: options.fill?.color ?? '#3b82f6', width: 2, cap: 'butt', join: 'miter' }
    return { fill: null, stroke }
  }
  if (!options.fill && !options.stroke) {
    return { fill: { ...DEFAULT_SHAPE_OPTIONS.fill! }, stroke: null }
  }
  return {
    fill: options.fill ? { ...options.fill } : null,
    stroke: options.stroke ? { ...options.stroke } : null,
  }
}

class ShapeTool implements Tool {
  readonly control: ToolControl
  private start: Vec2 | null = null
  private cur: Vec2 | null = null
  private constrain = false

  constructor(
    readonly id: string,
    private readonly ctx: ToolContext
  ) {
    this.control = { ...defaultControl(), cursor: 'crosshair', abortMask: Dirty.STRUCTURE }
  }

  private options(): ShapeToolOptions {
    return { ...DEFAULT_SHAPE_OPTIONS, ...this.ctx.options<Partial<ShapeToolOptions>>() }
  }

  onButtonPress(e: PointerEvent, pt: Vec2): void {
    this.start = pt
    this.cur = pt
    this.constrain = e.shiftKey
    this.ctx.requestRender()
  }

  onMotion(e: PointerEvent, pt: Vec2): void {
    if (!this.start) return
    this.cur = pt
    this.constrain = e.shiftKey
    this.ctx.requestRender()
  }

  onButtonRelease(e: PointerEvent, pt: Vec2): void {
    const start = this.start
    this.start = null
    this.cur = null
    if (!start) return
    const options = this.options()
    const path = buildShapePath(options.shape, start, pt, e.shiftKey || this.constrain, options)
    this.ctx.requestRender()
    if (!path) return
    if (options.combine) {
      const activeId = this.ctx.activeNodeId()
      const loc = activeId ? findNode(this.ctx.document().root, activeId) : null
      if (loc && loc.node.kind === 'vector' && !loc.node.locks.content) {
        this.ctx.history.push(appendShapeToVector(loc.node as VectorData, path))
        this.ctx.requestRender()
        return
      }
    }
    const styles = resolveShapeStyles(options)
    const node = vectorKind.create({
      name: SHAPE_NAMES[options.shape],
      path,
      fill: styles.fill ?? undefined,
      stroke: styles.stroke ?? undefined,
    })
    const root = this.ctx.document().root
    const index = root.children.length
    root.children.push(node as SceneNode)
    this.ctx.history.push(new AddNodeCommand(`Add ${node.name}`, root, node as SceneNode, index))
    this.ctx.setActiveNode(node.id)
    this.ctx.requestRender()
  }

  onHover(): void {}

  cursorFor(): string {
    return 'crosshair'
  }

  drawOverlay(overlay: Overlay): void {
    if (!this.start || !this.cur) return
    const options = this.options()
    const path = buildShapePath(options.shape, this.start, this.cur, this.constrain, options)
    if (!path) return
    if (options.shape === 'line') {
      const seg = path.strokes[0]
      overlay.add({
        type: 'line',
        a: { ...seg.anchors[1].pos },
        b: { ...seg.anchors[4].pos },
      })
      return
    }
    if (options.shape === 'rect') {
      const xs = path.strokes[0].anchors.filter((x) => x.type === 'anchor').map((x) => x.pos)
      const minX = Math.min(...xs.map((p) => p.x))
      const minY = Math.min(...xs.map((p) => p.y))
      const maxX = Math.max(...xs.map((p) => p.x))
      const maxY = Math.max(...xs.map((p) => p.y))
      overlay.add({ type: 'rect', rect: { x: minX, y: minY, w: maxX - minX, h: maxY - minY } })
      return
    }
    for (const stroke of path.strokes) {
      overlay.add({ type: 'polyline', points: flattenStroke(stroke), closed: stroke.closed })
    }
  }
}

export function makeShapeToolDef(): ToolDef {
  return { id: 'shape', create: (ctx) => new ShapeTool('shape', ctx) }
}
