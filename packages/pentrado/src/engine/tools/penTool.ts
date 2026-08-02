import { AddNodeCommand } from '../commands/structure'
import { PropCommand } from '../commands/prop'
import { findNode } from '../document'
import { Dirty } from '../history'
import { deriveVectorTransform, vectorKind } from '../kinds/vector'
import type { SceneNode, Transform, Vec2, VectorData } from '../node'
import { generateId } from '../id'
import {
  hitAnchor,
  insertAnchorOnSegment,
  moveAnchorTriple,
  moveControl,
  nearestPointOnPath,
  removeAnchorTriple,
  type AnchorHit,
} from '../pathEdit'
import { defaultControl, type Overlay, type Tool, type ToolContext, type ToolControl, type ToolDef } from '../tool'
import { clonePath, type PathData, type Stroke } from '../vector'
import { resolveShapeStyles, DEFAULT_SHAPE_OPTIONS, type ShapeToolOptions } from './shapeTool'

interface EditSession {
  node: VectorData
  hit: AnchorHit
  start: Vec2
  beforePath: PathData
  beforeTransform: Transform
  mirror: boolean
  label: string
  insert?: { segIndex: number; t: number }
}

function mkAnchorTriple(pt: Vec2): Stroke['anchors'] {
  return [
    { pos: { ...pt }, type: 'control', selected: false },
    { pos: { ...pt }, type: 'anchor', selected: false },
    { pos: { ...pt }, type: 'control', selected: false },
  ]
}

export class PenTool implements Tool {
  readonly control: ToolControl
  private draft: Stroke | null = null
  private hover: Vec2 | null = null
  private placing = false
  private session: EditSession | null = null

  constructor(
    readonly id: string,
    private readonly ctx: ToolContext
  ) {
    this.control = { ...defaultControl(), cursor: 'crosshair', abortMask: Dirty.STRUCTURE }
  }

  private options(): ShapeToolOptions {
    return { ...DEFAULT_SHAPE_OPTIONS, ...this.ctx.options<Partial<ShapeToolOptions>>() }
  }

  private tolerance(): number {
    return 8 / Math.max(0.1, this.ctx.zoom())
  }

  private activeVector(): VectorData | null {
    const id = this.ctx.activeNodeId()
    const node = id ? findNode(this.ctx.document().root, id)?.node : null
    if (!node || node.kind !== 'vector' || node.locks.content) return null
    return node as VectorData
  }

  isDrafting(): boolean {
    return this.draft !== null
  }

  onButtonPress(e: PointerEvent, pt: Vec2): void {
    if (this.draft) {
      const first = this.draft.anchors[1]
      if (this.draft.anchors.length >= 6 && first && Math.hypot(first.pos.x - pt.x, first.pos.y - pt.y) <= this.tolerance()) {
        this.draft.closed = true
        this.commit()
        return
      }
      this.draft.anchors.push(...mkAnchorTriple(pt))
      this.placing = true
      this.ctx.requestRender()
      return
    }

    const v = this.activeVector()
    if (v) {
      const tol = this.tolerance()
      const hit = hitAnchor(v.path, pt, tol)
      if (hit && hit.slot === 'anchor' && e.altKey) {
        this.deleteAnchor(v, hit)
        return
      }
      if (hit) {
        this.session = {
          node: v,
          hit,
          start: pt,
          beforePath: clonePath(v.path),
          beforeTransform: { ...v.transform },
          mirror: !e.altKey,
          label: hit.slot === 'anchor' ? 'Move Anchor' : 'Edit Handle',
        }
        this.control.active = true
        return
      }
      const seg = nearestPointOnPath(v.path, pt)
      if (seg && seg.dist <= tol) {
        const beforePath = clonePath(v.path)
        const beforeTransform = { ...v.transform }
        const stroke = v.path.strokes[seg.strokeIndex]
        const next = insertAnchorOnSegment(stroke, seg.segIndex, seg.t)
        v.path = {
          strokes: v.path.strokes.map((s, i) => (i === seg.strokeIndex ? next : s)),
        }
        this.session = {
          node: v,
          hit: { strokeIndex: seg.strokeIndex, tripleIndex: seg.segIndex + 1, slot: 'anchor', dist: 0 },
          start: pt,
          beforePath,
          beforeTransform,
          mirror: true,
          label: 'Insert Anchor',
          insert: { segIndex: seg.segIndex, t: seg.t },
        }
        this.control.active = true
        this.applyTransform(v)
        this.ctx.requestRender()
        return
      }
    }

    this.draft = { id: 'draft', anchors: mkAnchorTriple(pt), closed: false }
    this.placing = true
    this.ctx.requestRender()
  }

  onMotion(_e: PointerEvent, pt: Vec2): void {
    this.hover = pt
    if (this.placing && this.draft) {
      const n = this.draft.anchors.length
      const anchor = this.draft.anchors[n - 2].pos
      this.draft.anchors[n - 1].pos = { ...pt }
      this.draft.anchors[n - 3].pos = { x: 2 * anchor.x - pt.x, y: 2 * anchor.y - pt.y }
      this.ctx.requestRender()
      return
    }
    const s = this.session
    if (s) {
      const strokeBefore = s.beforePath.strokes[s.hit.strokeIndex]
      let next: Stroke
      if (s.insert) {
        const inserted = insertAnchorOnSegment(strokeBefore, s.insert.segIndex, s.insert.t)
        next = moveAnchorTriple(inserted, s.hit.tripleIndex, pt.x - s.start.x, pt.y - s.start.y)
      } else if (s.hit.slot === 'anchor') {
        next = moveAnchorTriple(strokeBefore, s.hit.tripleIndex, pt.x - s.start.x, pt.y - s.start.y)
      } else {
        next = moveControl(strokeBefore, s.hit.tripleIndex, s.hit.slot, pt, s.mirror)
      }
      s.node.path = {
        strokes: s.beforePath.strokes.map((st, i) => (i === s.hit.strokeIndex ? next : st)),
      }
      this.applyTransform(s.node)
      this.ctx.requestRender()
      return
    }
    this.ctx.requestRender()
  }

  onButtonRelease(): void {
    this.placing = false
    const s = this.session
    if (s) {
      this.session = null
      this.control.active = false
      this.pushPathCommand(s.node, s.label, s.beforePath, s.beforeTransform)
      this.ctx.requestRender()
    }
  }

  private applyTransform(node: VectorData): void {
    node.transform = deriveVectorTransform(node.path, node.stroke ? Math.max(0, node.stroke.width) : 0)
  }

  private pushPathCommand(node: VectorData, label: string, beforePath: PathData, beforeTransform: Transform): void {
    const snapshot = () => ({ path: clonePath(node.path), transform: { ...node.transform } })
    const restore = (v: { path: PathData; transform: Transform }) => {
      node.path = clonePath(v.path)
      node.transform = { ...v.transform }
    }
    this.ctx.history.push(
      new PropCommand(label, Dirty.DRAWABLE, snapshot, restore, { path: beforePath, transform: beforeTransform }, snapshot())
    )
  }

  private deleteAnchor(v: VectorData, hit: AnchorHit): boolean {
    const stroke = v.path.strokes[hit.strokeIndex]
    if (stroke.anchors.length <= 6) return false
    const beforePath = clonePath(v.path)
    const beforeTransform = { ...v.transform }
    const next = removeAnchorTriple(stroke, hit.tripleIndex)
    v.path = { strokes: v.path.strokes.map((s, i) => (i === hit.strokeIndex ? next : s)) }
    this.applyTransform(v)
    this.pushPathCommand(v, 'Delete Anchor', beforePath, beforeTransform)
    this.ctx.requestRender()
    return true
  }

  commit(): boolean {
    const draft = this.draft
    if (!draft) return false
    this.draft = null
    this.placing = false
    if (draft.anchors.length < 6) {
      this.ctx.requestRender()
      return false
    }
    const options = this.options()
    const styles = resolveShapeStyles(options)
    const fill = draft.closed ? (styles.fill ?? undefined) : undefined
    const stroke = draft.closed
      ? (styles.stroke ?? undefined)
      : (styles.stroke ?? { color: options.fill?.color ?? '#3b82f6', width: 2, cap: 'butt' as const, join: 'miter' as const })
    const node = vectorKind.create({
      name: 'Path',
      path: { strokes: [{ id: generateId('stroke'), anchors: draft.anchors, closed: draft.closed }] },
      fill,
      stroke,
    })
    const root = this.ctx.document().root
    const index = root.children.length
    root.children.push(node as SceneNode)
    this.ctx.history.push(new AddNodeCommand('Add Path', root, node as SceneNode, index))
    this.ctx.setActiveNode(node.id)
    this.ctx.requestRender()
    return true
  }

  cancel(): boolean {
    if (this.draft) {
      this.draft = null
      this.placing = false
      this.ctx.requestRender()
      return true
    }
    const s = this.session
    if (s) {
      s.node.path = s.beforePath
      s.node.transform = s.beforeTransform
      this.session = null
      this.control.active = false
      this.ctx.requestRender()
      return true
    }
    return false
  }

  onHover(_e: PointerEvent, pt: Vec2): void {
    this.hover = pt
  }

  cursorFor(pt: Vec2): string {
    if (this.draft) return 'crosshair'
    const v = this.activeVector()
    if (v) {
      const tol = this.tolerance()
      if (hitAnchor(v.path, pt, tol)) return 'move'
      const seg = nearestPointOnPath(v.path, pt)
      if (seg && seg.dist <= tol) return 'copy'
    }
    return 'crosshair'
  }

  drawOverlay(overlay: Overlay): void {
    const draft = this.draft
    if (draft) {
      const pts = draft.anchors.filter((x) => x.type === 'anchor').map((x) => ({ ...x.pos }))
      if (pts.length >= 2) overlay.add({ type: 'polyline', points: pts, closed: false })
      if (this.hover && pts.length >= 1) {
        overlay.add({ type: 'line', a: pts[pts.length - 1], b: { ...this.hover } })
      }
      for (const p of pts) overlay.add({ type: 'handle', pos: p, shape: 'square' })
      this.drawHandles(overlay, draft)
      return
    }
    const v = this.activeVector()
    if (!v) return
    for (const stroke of v.path.strokes) {
      for (let i = 1; i < stroke.anchors.length; i += 3) {
        overlay.add({ type: 'handle', pos: { ...stroke.anchors[i].pos }, shape: 'square' })
      }
      this.drawHandles(overlay, stroke)
    }
  }

  private drawHandles(overlay: Overlay, stroke: Stroke): void {
    for (let t = 0; t < stroke.anchors.length / 3; t++) {
      const anchor = stroke.anchors[t * 3 + 1].pos
      for (const slot of [t * 3, t * 3 + 2]) {
        const c = stroke.anchors[slot].pos
        if (Math.abs(c.x - anchor.x) < 0.01 && Math.abs(c.y - anchor.y) < 0.01) continue
        overlay.add({ type: 'line', a: { ...anchor }, b: { ...c } })
        overlay.add({ type: 'handle', pos: { ...c }, shape: 'circle' })
      }
    }
  }
}

export function isPenTool(tool: Tool | null): tool is PenTool {
  return !!tool && tool.id === 'pen'
}

export function makePenToolDef(): ToolDef {
  return { id: 'pen', create: (ctx) => new PenTool('pen', ctx) }
}
