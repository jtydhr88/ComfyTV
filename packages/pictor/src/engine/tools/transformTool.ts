import { SetTransformCommand } from '../commands/setTransform'
import { findNode } from '../document'
import { CommandGroup, Dirty } from '../history'
import type { SceneNode, Transform, Vec2 } from '../node'
import { getNodeKind } from '../nodeKind'
import { defaultControl, type Overlay, type Tool, type ToolContext, type ToolControl, type ToolDef } from '../tool'
import { addTransformBox } from './overlayBox'
import {
  angleTo,
  applyMove,
  applyResize,
  applyRotate,
  hitHandle,
  insideBox,
  type HandleId,
} from './transformMath'

const TRANSFORMABLE_KINDS = new Set(['raster', 'text', 'vector'])

interface TransformSession {
  nodeId: string
  before: Transform
}

type Drag =
  | { mode: 'idle' }
  | { mode: 'move'; start: Vec2; base: Transform }
  | { mode: 'resize'; handle: HandleId; base: Transform }
  | { mode: 'rotate'; base: Transform; grab: number }

export interface TransformToolApi {
  apply(): boolean
  cancel(): boolean
  isDirty(): boolean
}

function sameTransform(a: Transform, b: Transform): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h && a.rotation === b.rotation
}

export function canTransformNode(node: SceneNode | null): node is SceneNode {
  return !!node && TRANSFORMABLE_KINDS.has(node.kind) && !node.locks.position
}

class TransformTool implements Tool, TransformToolApi {
  readonly control: ToolControl
  private session: TransformSession | null = null
  private drag: Drag = { mode: 'idle' }

  constructor(
    readonly id: string,
    private readonly ctx: ToolContext
  ) {
    this.control = { ...defaultControl(), cursor: 'default', abortMask: Dirty.STRUCTURE }
  }

  private tol(): number {
    return 8 / Math.max(1e-3, this.ctx.zoom())
  }

  private eligibleActive(): SceneNode | null {
    const id = this.ctx.activeNodeId()
    const node = id ? findNode(this.ctx.document().root, id)?.node ?? null : null
    return canTransformNode(node) ? node : null
  }

  private sessionNode(): SceneNode | null {
    if (!this.session) return null
    return findNode(this.ctx.document().root, this.session.nodeId)?.node ?? null
  }

  private ensureSession(): SceneNode | null {
    const node = this.eligibleActive()
    if (!node) {
      if (this.session) this.apply()
      return null
    }
    if (this.session && this.session.nodeId !== node.id) this.apply()
    if (!this.session) this.session = { nodeId: node.id, before: { ...node.transform } }
    return node
  }

  onActivate(): void {
    this.ensureSession()
  }

  onDeactivate(): void {
    if (this.isDirty()) this.apply()
    else this.session = null
  }

  onButtonPress(_e: PointerEvent, pt: Vec2): void {
    const node = this.ensureSession()
    if (!node) return
    const h = hitHandle(node.transform, pt, this.tol())
    if (h === 'rotate') {
      this.drag = { mode: 'rotate', base: { ...node.transform }, grab: angleTo(node.transform, pt) }
      return
    }
    if (h) {
      this.drag = { mode: 'resize', handle: h, base: { ...node.transform } }
      return
    }
    if (insideBox(node.transform, pt)) {
      this.drag = { mode: 'move', start: pt, base: { ...node.transform } }
      return
    }
    this.apply()
  }

  onMotion(e: PointerEvent, pt: Vec2): void {
    const node = this.sessionNode()
    const d = this.drag
    if (!node || d.mode === 'idle') return
    if (d.mode === 'move') {
      node.transform = applyMove(d.base, pt.x - d.start.x, pt.y - d.start.y)
    } else if (d.mode === 'resize') {
      node.transform = applyResize(d.base, d.handle, pt, 1, e.shiftKey)
    } else {
      node.transform = applyRotate(d.base, d.base.rotation, d.grab, pt, e.shiftKey ? Math.PI / 12 : 0)
    }
    this.ctx.requestRender()
  }

  onButtonRelease(): void {
    this.drag = { mode: 'idle' }
  }

  onHover(): void {
    this.ensureSession()
  }

  cursorFor(pt: Vec2): string {
    const node = this.sessionNode() ?? this.eligibleActive()
    if (!node) return 'default'
    if (hitHandle(node.transform, pt, this.tol())) return 'pointer'
    if (insideBox(node.transform, pt)) return 'move'
    return 'default'
  }

  drawOverlay(overlay: Overlay): void {
    const node = this.sessionNode() ?? this.eligibleActive()
    if (!node) return
    addTransformBox(overlay, node.transform, true)
  }

  isDirty(): boolean {
    const node = this.sessionNode()
    return !!this.session && !!node && !sameTransform(this.session.before, node.transform)
  }

  apply(): boolean {
    const s = this.session
    this.session = null
    this.drag = { mode: 'idle' }
    if (!s) return false
    const node = findNode(this.ctx.document().root, s.nodeId)?.node
    if (!node || sameTransform(s.before, node.transform)) return false
    const cmd = new SetTransformCommand('transform', node, s.before, { ...node.transform })
    const extra = getNodeKind(node.kind).onTransformCommitted?.(node, s.before, { content: this.ctx.content }) ?? null
    if (extra) {
      const group = new CommandGroup('transform')
      group.children.push(cmd, extra)
      this.ctx.history.push(group)
    } else {
      this.ctx.history.push(cmd)
    }
    this.ctx.requestRender()
    return true
  }

  cancel(): boolean {
    const s = this.session
    this.session = null
    this.drag = { mode: 'idle' }
    if (!s) return false
    const node = findNode(this.ctx.document().root, s.nodeId)?.node
    if (node && !sameTransform(s.before, node.transform)) {
      node.transform = { ...s.before }
      this.ctx.requestRender()
      return true
    }
    return false
  }
}

export function isTransformTool(tool: Tool | null): tool is Tool & TransformToolApi {
  return !!tool && tool.id === 'transform'
}

export function makeTransformToolDef(): ToolDef {
  return { id: 'transform', create: (ctx) => new TransformTool('transform', ctx) }
}
