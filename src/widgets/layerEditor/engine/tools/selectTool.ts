import { SetTransformCommand } from '../commands/setTransform'
import { findNode } from '../document'
import { Dirty } from '../history'
import type { SceneNode, Transform, Vec2 } from '../node'
import { defaultControl, type Overlay, type Tool, type ToolContext, type ToolControl, type ToolDef } from '../tool'
import {
  angleTo,
  applyMove,
  applyResize,
  applyRotate,
  handlePos,
  hitHandle,
  insideBox,
  type HandleId,
} from './transformMath'

type Session =
  | { mode: 'idle' }
  | { mode: 'move'; start: Vec2; before: Transform }
  | { mode: 'resize'; handle: HandleId; before: Transform }
  | { mode: 'rotate'; before: Transform; grab: number }

const HANDLES: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

class SelectTool implements Tool {
  readonly control: ToolControl
  private session: Session = { mode: 'idle' }
  private active: SceneNode | null = null

  constructor(
    readonly id: string,
    private readonly ctx: ToolContext
  ) {
    this.control = { ...defaultControl(), cursor: 'default', abortMask: Dirty.STRUCTURE }
  }

  private activeNode(): SceneNode | null {
    const id = this.ctx.activeNodeId()
    if (!id) return null
    return findNode(this.ctx.document().root, id)?.node ?? null
  }

  private tol(): number {
    return 8 / Math.max(1e-3, this.ctx.zoom())
  }

  onButtonPress(_e: PointerEvent, pt: Vec2): void {
    const node = this.activeNode()
    if (node) {
      const h = hitHandle(node.transform, pt, this.tol())
      if (h === 'rotate') {
        this.active = node
        this.session = { mode: 'rotate', before: { ...node.transform }, grab: angleTo(node.transform, pt) }
        return
      }
      if (h) {
        this.active = node
        this.session = { mode: 'resize', handle: h, before: { ...node.transform } }
        return
      }
      if (insideBox(node.transform, pt)) {
        this.active = node
        this.session = { mode: 'move', start: pt, before: { ...node.transform } }
        return
      }
    }
    const picked = this.pick(pt)
    if (picked) {
      this.ctx.setActiveNode(picked.id)
      this.active = picked
      this.session = { mode: 'move', start: pt, before: { ...picked.transform } }
    } else {
      this.ctx.setActiveNode(null)
      this.active = null
      this.session = { mode: 'idle' }
    }
  }

  onMotion(e: PointerEvent, pt: Vec2): void {
    if (!this.active || this.session.mode === 'idle') return
    const s = this.session
    if (s.mode === 'move') {
      this.active.transform = applyMove(s.before, pt.x - s.start.x, pt.y - s.start.y)
    } else if (s.mode === 'resize') {
      this.active.transform = applyResize(s.before, s.handle, pt)
    } else {
      this.active.transform = applyRotate(s.before, s.before.rotation, s.grab, pt, e.shiftKey ? Math.PI / 12 : 0)
    }
    this.ctx.requestRender()
  }

  onButtonRelease(): void {
    if (this.active && this.session.mode !== 'idle') {
      const before = this.session.before
      const after = { ...this.active.transform }
      const changed =
        before.x !== after.x ||
        before.y !== after.y ||
        before.w !== after.w ||
        before.h !== after.h ||
        before.rotation !== after.rotation
      if (changed) this.ctx.history.push(new SetTransformCommand(this.session.mode, this.active, before, after))
    }
    this.session = { mode: 'idle' }
  }

  onHover(): void {}

  cursorFor(pt: Vec2): string {
    const node = this.activeNode()
    if (node && hitHandle(node.transform, pt, this.tol())) return 'pointer'
    return 'default'
  }

  drawOverlay(overlay: Overlay): void {
    const node = this.activeNode()
    if (!node) return
    const t = node.transform
    const corners: HandleId[] = ['nw', 'ne', 'se', 'sw']
    overlay.add({ type: 'polyline', points: corners.map((h) => handlePos(t, h)), closed: true })
    overlay.add({ type: 'line', a: handlePos(t, 'n'), b: handlePos(t, 'rotate') })
    for (const h of HANDLES) overlay.add({ type: 'handle', pos: handlePos(t, h), shape: 'square', id: h })
    overlay.add({ type: 'handle', pos: handlePos(t, 'rotate'), shape: 'circle', id: 'rotate' })
  }

  private pick(pt: Vec2): SceneNode | null {
    const children = this.ctx.document().root.children
    for (let i = children.length - 1; i >= 0; i--) {
      if (insideBox(children[i].transform, pt)) return children[i]
    }
    return null
  }
}

export function makeSelectToolDef(): ToolDef {
  return { id: 'select', create: (ctx) => new SelectTool('select', ctx) }
}
