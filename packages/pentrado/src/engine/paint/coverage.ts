import { getStamp, quantizeSubpixel } from './stampCache'

export interface DirtyRect {
  x0: number
  y0: number
  x1: number
  y1: number
}

const EXTENT_PAD = 32
const RECT_MERGE_GAP = 24
const RECT_LIST_CAP = 16

function addRectToList(list: DirtyRect[], x0: number, y0: number, x1: number, y1: number): void {
  for (const r of list) {
    if (
      x0 <= r.x1 + RECT_MERGE_GAP && x1 >= r.x0 - RECT_MERGE_GAP &&
      y0 <= r.y1 + RECT_MERGE_GAP && y1 >= r.y0 - RECT_MERGE_GAP
    ) {
      r.x0 = Math.min(r.x0, x0)
      r.y0 = Math.min(r.y0, y0)
      r.x1 = Math.max(r.x1, x1)
      r.y1 = Math.max(r.y1, y1)
      return
    }
  }
  if (list.length >= RECT_LIST_CAP) {
    let best = 0
    let bestD = Infinity
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2
    for (let i = 0; i < list.length; i++) {
      const r = list[i]
      const d = Math.abs((r.x0 + r.x1) / 2 - cx) + Math.abs((r.y0 + r.y1) / 2 - cy)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    const r = list[best]
    r.x0 = Math.min(r.x0, x0)
    r.y0 = Math.min(r.y0, y0)
    r.x1 = Math.max(r.x1, x1)
    r.y1 = Math.max(r.y1, y1)
    return
  }
  list.push({ x0, y0, x1, y1 })
}

export function unionOfRects(list: DirtyRect[]): DirtyRect | null {
  if (!list.length) return null
  const out = { ...list[0] }
  for (let i = 1; i < list.length; i++) {
    out.x0 = Math.min(out.x0, list[i].x0)
    out.y0 = Math.min(out.y0, list[i].y0)
    out.x1 = Math.max(out.x1, list[i].x1)
    out.y1 = Math.max(out.y1, list[i].y1)
  }
  return out
}

export class CoverageBuffer {
  private dirtyList: DirtyRect[] = []
  private recentList: DirtyRect[] = []
  private buf = new Float32Array(0)
  private ext: DirtyRect | null = null
  private extW = 0

  get dirty(): DirtyRect | null {
    return unionOfRects(this.dirtyList)
  }

  dirtyRects(): DirtyRect[] {
    return this.dirtyList.map((r) => ({ ...r }))
  }

  constructor(
    readonly width: number,
    readonly height: number
  ) {}

  stampCircle(
    cx: number,
    cy: number,
    radius: number,
    hardness: number,
    flow: number,
    hardEdge = false,
    additive = false
  ): void {
    if (radius <= 0 || flow <= 0) return
    const ix = Math.floor(cx)
    const iy = Math.floor(cy)
    const fx = quantizeSubpixel(cx - ix)
    const fy = quantizeSubpixel(cy - iy)
    const stamp = getStamp(radius, hardness, hardEdge, fx, fy)
    const ox = ix - stamp.center
    const oy = iy - stamp.center

    const x0 = Math.max(0, ox)
    const y0 = Math.max(0, oy)
    const x1 = Math.min(this.width - 1, ox + stamp.size - 1)
    const y1 = Math.min(this.height - 1, oy + stamp.size - 1)
    if (x1 < x0 || y1 < y0) return

    this.ensureExtent(x0, y0, x1, y1)
    const ext = this.ext as DirtyRect
    let touched = false
    for (let y = y0; y <= y1; y++) {
      const srow = (y - oy) * stamp.size
      const brow = (y - ext.y0) * this.extW
      for (let x = x0; x <= x1; x++) {
        const p = stamp.data[srow + (x - ox)] * flow
        if (p <= 0) continue
        const i = brow + (x - ext.x0)
        if (additive) {
          this.buf[i] = Math.min(1, this.buf[i] + p)
        } else if (p > this.buf[i]) {
          this.buf[i] = p
        }
        touched = true
      }
    }
    if (touched) this.expandDirty(x0, y0, x1, y1)
  }

  valueAt(x: number, y: number): number {
    const ext = this.ext
    if (!ext || x < ext.x0 || x > ext.x1 || y < ext.y0 || y > ext.y1) return 0
    return this.buf[(y - ext.y0) * this.extW + (x - ext.x0)]
  }

  maxAt(x: number, y: number): number {
    return this.valueAt(x, y)
  }

  allocatedLength(): number {
    return this.buf.length
  }

  takeRecentRects(): DirtyRect[] {
    const list = this.recentList
    this.recentList = []
    return list
  }

  private ensureExtent(x0: number, y0: number, x1: number, y1: number): void {
    const old = this.ext
    const pad = old
      ? Math.max(EXTENT_PAD, Math.floor(Math.max(old.x1 - old.x0, old.y1 - old.y0) / 2))
      : EXTENT_PAD
    const want: DirtyRect = {
      x0: Math.max(0, x0 - pad),
      y0: Math.max(0, y0 - pad),
      x1: Math.min(this.width - 1, x1 + pad),
      y1: Math.min(this.height - 1, y1 + pad),
    }
    if (old && old.x0 <= x0 && old.y0 <= y0 && old.x1 >= x1 && old.y1 >= y1) return
    const next: DirtyRect = old
      ? {
          x0: Math.min(old.x0, want.x0),
          y0: Math.min(old.y0, want.y0),
          x1: Math.max(old.x1, want.x1),
          y1: Math.max(old.y1, want.y1),
        }
      : want
    const nextW = next.x1 - next.x0 + 1
    const nextH = next.y1 - next.y0 + 1
    const buf = new Float32Array(nextW * nextH)
    if (old) {
      const oldW = this.extW
      for (let y = old.y0; y <= old.y1; y++) {
        const src = (y - old.y0) * oldW
        const dst = (y - next.y0) * nextW + (old.x0 - next.x0)
        buf.set(this.buf.subarray(src, src + oldW), dst)
      }
    }
    this.buf = buf
    this.ext = next
    this.extW = nextW
  }

  private expandDirty(x0: number, y0: number, x1: number, y1: number): void {
    addRectToList(this.dirtyList, x0, y0, x1, y1)
    addRectToList(this.recentList, x0, y0, x1, y1)
  }
}
