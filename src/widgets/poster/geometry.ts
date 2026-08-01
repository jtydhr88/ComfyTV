export interface Rect { x: number; y: number; w: number; h: number }
export interface ElementDef { id?: string; x?: number; y?: number; w?: number; h?: number }
export interface LayoutOverride {
  x?: number; y?: number; w?: number; h?: number; z?: number; slot?: number
}

export const HANDLE_MODES = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'] as const
export type DragMode = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
export interface Hit { idx: number; mode: DragMode }

function num(v: unknown, d: number): number {
  return typeof v === 'number' && isFinite(v) ? v : d
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function eff(def: ElementDef, override?: LayoutOverride | null): Rect {
  const o = override || {}
  return {
    x: num(o.x, num(def.x, 0)),
    y: num(o.y, num(def.y, 0)),
    w: num(o.w, num(def.w, 0.2)),
    h: num(o.h, num(def.h, 0.2)),
  }
}

export function rectPx(r: Rect, cw: number, ch: number): Rect {
  return { x: r.x * cw, y: r.y * ch, w: r.w * cw, h: r.h * ch }
}

export function handlePts(r: Rect): [number, number][] {
  const mx = r.x + r.w / 2
  const my = r.y + r.h / 2
  return [
    [r.x, r.y], [mx, r.y], [r.x + r.w, r.y],
    [r.x, my], [r.x + r.w, my],
    [r.x, r.y + r.h], [mx, r.y + r.h], [r.x + r.w, r.y + r.h],
  ]
}

export function hitTest(
  px: number, py: number, rects: Rect[], activeIdx: number, handle: number,
): Hit | null {
  if (activeIdx >= 0 && activeIdx < rects.length) {
    const pts = handlePts(rects[activeIdx]!)
    for (let h = 0; h < pts.length; h++) {
      if (Math.abs(px - pts[h]![0]) <= handle && Math.abs(py - pts[h]![1]) <= handle) {
        return { idx: activeIdx, mode: HANDLE_MODES[h] as DragMode }
      }
    }
  }
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i]!
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
      return { idx: i, mode: 'move' }
    }
  }
  return null
}
