import { brushProfile } from './brushProfile'

export interface DirtyRect {
  x0: number
  y0: number
  x1: number
  y1: number
}

export class CoverageBuffer {
  readonly data: Float32Array
  dirty: DirtyRect | null = null

  constructor(
    readonly width: number,
    readonly height: number
  ) {
    this.data = new Float32Array(width * height)
  }

  stampCircle(
    cx: number,
    cy: number,
    radius: number,
    hardness: number,
    flow: number,
    hardEdge = false
  ): void {
    if (radius <= 0 || flow <= 0) return
    const x0 = Math.max(0, Math.floor(cx - radius))
    const y0 = Math.max(0, Math.floor(cy - radius))
    const x1 = Math.min(this.width - 1, Math.ceil(cx + radius))
    const y1 = Math.min(this.height - 1, Math.ceil(cy + radius))
    if (x1 < x0 || y1 < y0) return

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy)
        if (d > radius) continue
        const p = hardEdge ? flow : brushProfile(d / radius, hardness) * flow
        const i = y * this.width + x
        if (p > this.data[i]) this.data[i] = p
      }
    }
    this.expandDirty(x0, y0, x1, y1)
  }

  maxAt(x: number, y: number): number {
    return this.data[y * this.width + x]
  }

  private expandDirty(x0: number, y0: number, x1: number, y1: number): void {
    if (!this.dirty) {
      this.dirty = { x0, y0, x1, y1 }
      return
    }
    this.dirty.x0 = Math.min(this.dirty.x0, x0)
    this.dirty.y0 = Math.min(this.dirty.y0, y0)
    this.dirty.x1 = Math.max(this.dirty.x1, x1)
    this.dirty.y1 = Math.max(this.dirty.y1, y1)
  }
}
