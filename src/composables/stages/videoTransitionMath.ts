export const XFADE_TRANSITIONS = [
  'fade', 'dissolve', 'fadeblack', 'fadewhite', 'fadegrays', 'fadefast', 'fadeslow',
  'wipeleft', 'wiperight', 'wipeup', 'wipedown',
  'wipetl', 'wipetr', 'wipebl', 'wipebr',
  'slideleft', 'slideright', 'slideup', 'slidedown',
  'smoothleft', 'smoothright', 'smoothup', 'smoothdown',
  'circlecrop', 'rectcrop', 'circleopen', 'circleclose',
  'vertopen', 'vertclose', 'horzopen', 'horzclose',
  'diagtl', 'diagtr', 'diagbl', 'diagbr',
  'hlslice', 'hrslice', 'vuslice', 'vdslice',
  'hlwind', 'hrwind', 'vuwind', 'vdwind',
  'coverleft', 'coverright', 'coverup', 'coverdown',
  'revealleft', 'revealright', 'revealup', 'revealdown',
  'squeezeh', 'squeezev', 'zoomin', 'distance', 'pixelize', 'radial', 'hblur',
] as const

export type XfadeTransition = (typeof XFADE_TRANSITIONS)[number]

export function transitionModeIndex(name: string): number {
  const i = (XFADE_TRANSITIONS as readonly string[]).indexOf(name)
  return i >= 0 ? i : 0
}

export interface TransitionWindow {
  duration: number
  offset: number
}

export function effectiveTransitionWindow(
  durA: number,
  durB: number,
  duration: number,
  offset: number,
): TransitionWindow {
  const a = Math.max(0, durA)
  const b = Math.max(0, durB)
  let d = Math.max(
    0.1,
    Math.min(duration > 0 ? duration : 1.0, Math.max(0.1, a), Math.max(0.1, b)),
  )
  let off = offset
  if (!Number.isFinite(off) || off <= 0) off = Math.max(0, a - d)
  off = Math.max(0, Math.min(off, Math.max(0, a - d)))
  return { duration: d, offset: off }
}

export function clampProgress(p: number): number {
  if (!Number.isFinite(p)) return 0
  return Math.min(1, Math.max(0, p))
}

export interface SeekTargets {
  a: number
  b: number
}

export function seekTargets(p: number, window: TransitionWindow): SeekTargets {
  const cp = clampProgress(p)
  return {
    a: window.offset + cp * window.duration,
    b: cp * window.duration,
  }
}

export function ffmpegProgress(p: number): number {
  return Math.min(1, Math.max(0, 1 - clampProgress(p)))
}

export interface PreviewTimeline {
  lead: number
  tail: number
  total: number
}

export function previewTimeline(
  offsetEff: number,
  duration: number,
  _durA: number,
  durB: number,
): PreviewTimeline {
  const lead = Math.max(0, Math.min(1.0, offsetEff))
  const tail = Math.max(0, Math.min(1.0, durB - duration))
  return { lead, tail, total: lead + duration + tail }
}

export interface TimelineSeeks {
  p: number
  aTime: number
  bTime: number
  aActive: boolean
  bActive: boolean
}

export function timelineToSeeks(
  t: number,
  window: TransitionWindow,
  timeline: PreviewTimeline,
): TimelineSeeks {
  const { duration, offset } = window
  const { lead, total } = timeline
  const tc = Math.min(Math.max(0, Number.isFinite(t) ? t : 0), total)
  if (tc < lead) {
    return { p: 0, aTime: offset - lead + tc, bTime: 0, aActive: true, bActive: false }
  }
  if (tc < lead + duration) {
    const p = clampProgress(duration > 0 ? (tc - lead) / duration : 1)
    return { p, aTime: offset - lead + tc, bTime: tc - lead, aActive: true, bActive: true }
  }
  return { p: 1, aTime: offset + duration, bTime: tc - lead, aActive: false, bActive: true }
}

export const REFERENCE_MODES = [
  'fade', 'wipeleft', 'circleopen', 'dissolve', 'pixelize',
  'slideright', 'radial', 'fadeblack',
] as const

export type ReferenceMode = (typeof REFERENCE_MODES)[number]

const f = Math.fround

function mix32(a: number, b: number, m: number): number {
  return f(f(a * m) + f(b * f(1 - m)))
}

function smoothstep32(edge0: number, edge1: number, x: number): number {
  let t = f(f(x - edge0) / f(edge1 - edge0))
  t = Math.min(1, Math.max(0, t))
  return f(f(t * t) * f(3 - f(2 * t)))
}

function frand32(x: number, y: number): number {
  const arg = f(f(x * f(12.9898)) + f(y * f(78.233)))
  const r = f(f(Math.sin(arg)) * f(43758.545))
  return f(r - Math.floor(r))
}

type PixelFn = (
  a: Uint8Array,
  b: Uint8Array,
  x: number,
  y: number,
  w: number,
  h: number,
  P: number,
  c: number,
  i: number,
) => number

function px(frame: Uint8Array, w: number, x: number, y: number, c: number): number {
  return frame[(y * w + x) * 3 + c]
}

const refFade: PixelFn = (a, b, _x, _y, _w, _h, P, _c, i) => mix32(a[i], b[i], P)

const refWipeleft: PixelFn = (a, b, x, _y, w, _h, P, _c, i) => {
  const z = Math.trunc(f(w * P))
  return x > z ? b[i] : a[i]
}

const refCircleopen: PixelFn = (a, b, x, y, w, h, P, _c, i) => {
  const z = f(Math.hypot(Math.trunc(w / 2), Math.trunc(h / 2)))
  const pp = f(f(P - 0.5) * 3)
  const smooth = f(f(f(Math.hypot(x - Math.trunc(w / 2), y - Math.trunc(h / 2))) / z) + pp)
  return mix32(a[i], b[i], smoothstep32(0, 1, smooth))
}

const refDissolve: PixelFn = (a, b, x, y, _w, _h, P, _c, i) => {
  const smooth = f(f(f(frand32(x, y) * 2) + f(P * 2)) - 1.5)
  return smooth >= 0.5 ? a[i] : b[i]
}

const refPixelize: PixelFn = (a, b, x, y, w, h, P, c) => {
  const d = f(Math.min(P, f(1 - P)))
  const dist = f(Math.ceil(f(d * 50)) / 50)
  const sq = f(f(f(2 * dist) * Math.min(w, h)) / 20)
  const sx = dist > 0
    ? Math.trunc(Math.min(f(f(Math.floor(f(x / sq)) + 0.5) * sq), w - 1))
    : x
  const sy = dist > 0
    ? Math.trunc(Math.min(f(f(Math.floor(f(y / sq)) + 0.5) * sq), h - 1))
    : y
  return mix32(px(a, w, sx, sy, c), px(b, w, sx, sy, c), P)
}

const refSlideright: PixelFn = (a, b, x, y, w, _h, P, c) => {
  const z = Math.trunc(f(P * w))
  const zx = z + x
  const zz = (zx % w) + (zx < 0 ? w : 0)
  return zx >= 0 && zx < w ? px(b, w, zz, y, c) : px(a, w, zz, y, c)
}

const refRadial: PixelFn = (a, b, x, y, w, h, P, _c, i) => {
  const angle = f(Math.atan2(x - Math.trunc(w / 2), y - Math.trunc(h / 2)))
  const smooth = f(angle - (P - 0.5) * (Math.PI * 2.5))
  return mix32(b[i], a[i], smoothstep32(0, 1, smooth))
}

const refFadeblack: PixelFn = (a, b, _x, _y, _w, _h, P, _c, i) => {
  const phase = f(0.2)
  return mix32(
    mix32(a[i], 0, smoothstep32(f(1 - phase), 1, P)),
    mix32(0, b[i], smoothstep32(phase, 1, P)),
    P,
  )
}

const REFERENCE_FNS: Record<ReferenceMode, PixelFn> = {
  fade: refFade,
  wipeleft: refWipeleft,
  circleopen: refCircleopen,
  dissolve: refDissolve,
  pixelize: refPixelize,
  slideright: refSlideright,
  radial: refRadial,
  fadeblack: refFadeblack,
}

export function renderTransitionReference(
  mode: ReferenceMode,
  a: Uint8Array,
  b: Uint8Array,
  w: number,
  h: number,
  p: number,
): Uint8Array {
  const P = f(1 - f(clampProgress(p)))
  const fn = REFERENCE_FNS[mode]
  const out = new Uint8Array(w * h * 3)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        const i = (y * w + x) * 3 + c
        const v = fn(a, b, x, y, w, h, P, c, i)
        out[i] = Math.min(255, Math.max(0, Math.trunc(v)))
      }
    }
  }
  return out
}
