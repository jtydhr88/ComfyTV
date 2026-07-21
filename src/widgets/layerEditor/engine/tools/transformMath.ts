import type { Transform, Vec2 } from '../node'

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate'

export const ROTATE_OFFSET = 24

const SIGN: Record<HandleId, Vec2> = {
  nw: { x: -1, y: -1 },
  n: { x: 0, y: -1 },
  ne: { x: 1, y: -1 },
  e: { x: 1, y: 0 },
  se: { x: 1, y: 1 },
  s: { x: 0, y: 1 },
  sw: { x: -1, y: 1 },
  w: { x: -1, y: 0 },
  rotate: { x: 0, y: -1 },
}

const OPP: Record<HandleId, HandleId> = {
  nw: 'se', n: 's', ne: 'sw', e: 'w', se: 'nw', s: 'n', sw: 'ne', w: 'e', rotate: 'rotate',
}

function rot(p: Vec2, a: number): Vec2 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
}

export function center(t: Transform): Vec2 {
  return { x: t.x + t.w / 2, y: t.y + t.h / 2 }
}

function axes(t: Transform): { ex: Vec2; ey: Vec2 } {
  const c = Math.cos(t.rotation)
  const s = Math.sin(t.rotation)
  return { ex: { x: c, y: s }, ey: { x: -s, y: c } }
}

export function handlePos(t: Transform, h: HandleId): Vec2 {
  const cen = center(t)
  const local =
    h === 'rotate'
      ? { x: 0, y: -t.h / 2 - ROTATE_OFFSET }
      : { x: (SIGN[h].x * t.w) / 2, y: (SIGN[h].y * t.h) / 2 }
  const p = rot(local, t.rotation)
  return { x: cen.x + p.x, y: cen.y + p.y }
}

export function toLocalFrame(t: Transform, pt: Vec2): Vec2 {
  const cen = center(t)
  return rot({ x: pt.x - cen.x, y: pt.y - cen.y }, -t.rotation)
}

export function hitHandle(t: Transform, pt: Vec2, tol: number): HandleId | null {
  const order: HandleId[] = ['rotate', 'nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w']
  for (const h of order) {
    const hp = handlePos(t, h)
    if (Math.hypot(pt.x - hp.x, pt.y - hp.y) <= tol) return h
  }
  return null
}

export function insideBox(t: Transform, pt: Vec2): boolean {
  const l = toLocalFrame(t, pt)
  return Math.abs(l.x) <= t.w / 2 && Math.abs(l.y) <= t.h / 2
}

export function applyMove(t: Transform, dx: number, dy: number): Transform {
  return { ...t, x: t.x + dx, y: t.y + dy }
}

export function applyResize(t: Transform, h: HandleId, pt: Vec2, minSize = 1): Transform {
  if (h === 'rotate') return t
  const anchor = handlePos(t, OPP[h])
  const { ex, ey } = axes(t)
  const dir = SIGN[h]
  const controlsX = dir.x !== 0
  const controlsY = dir.y !== 0

  const d = { x: pt.x - anchor.x, y: pt.y - anchor.y }
  const projX = d.x * ex.x + d.y * ex.y
  const projY = d.x * ey.x + d.y * ey.y

  const newW = controlsX ? Math.max(minSize, Math.abs(projX)) : t.w
  const newH = controlsY ? Math.max(minSize, Math.abs(projY)) : t.h

  const oc = center(t)
  const ocRel = { x: (oc.x - anchor.x) * ex.x + (oc.y - anchor.y) * ex.y, y: (oc.x - anchor.x) * ey.x + (oc.y - anchor.y) * ey.y }
  const relX = controlsX ? (dir.x * newW) / 2 : ocRel.x
  const relY = controlsY ? (dir.y * newH) / 2 : ocRel.y

  const nc = {
    x: anchor.x + ex.x * relX + ey.x * relY,
    y: anchor.y + ex.y * relX + ey.y * relY,
  }
  return { x: nc.x - newW / 2, y: nc.y - newH / 2, w: newW, h: newH, rotation: t.rotation }
}

export function angleTo(t: Transform, pt: Vec2): number {
  const c = center(t)
  return Math.atan2(pt.y - c.y, pt.x - c.x)
}

export function applyRotate(t: Transform, baseRotation: number, grabAngle: number, pt: Vec2, snap = 0): Transform {
  let rotation = baseRotation + (angleTo(t, pt) - grabAngle)
  if (snap > 0) rotation = Math.round(rotation / snap) * snap
  return { ...t, rotation }
}
