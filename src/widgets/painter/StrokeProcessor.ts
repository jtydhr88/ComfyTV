import type { Point } from './types'
import { catmullRomSpline, resampleSegment } from './splineUtils'

export class StrokeProcessor {
  private controlPoints: Point[] = []
  private remainder: number = 0
  private spacing: number
  private isFirstPoint: boolean = true
  private hasProcessedSegment: boolean = false

  constructor(spacing: number) {
    this.spacing = spacing
  }

  public addPoint(point: Point): Point[] {
    if (this.isFirstPoint) {
      this.controlPoints.push(point)
      this.controlPoints.push(point)
      this.isFirstPoint = false
      return []
    }

    this.controlPoints.push(point)

    if (this.controlPoints.length < 4) {
      return []
    }

    const p0 = this.controlPoints[0]
    const p1 = this.controlPoints[1]
    const p2 = this.controlPoints[2]
    const p3 = this.controlPoints[3]

    const newPoints = this.processSegment(p0, p1, p2, p3)

    this.controlPoints.shift()

    return newPoints
  }

  public endStroke(): Point[] {
    if (this.controlPoints.length < 2) {
      return []
    }

    const newPoints: Point[] = []

    while (this.controlPoints.length >= 3) {
      const p0 = this.controlPoints[0]
      const p1 = this.controlPoints[1]
      const p2 = this.controlPoints[2]
      const p3 = p2

      const points = this.processSegment(p0, p1, p2, p3)
      newPoints.push(...points)

      this.controlPoints.shift()
    }

    if (!this.hasProcessedSegment && this.controlPoints.length >= 2) {
      const p = this.controlPoints[1]
      const points = this.processSegment(p, p, p, p)
      newPoints.push(...points)
    }

    return newPoints
  }

  private processSegment(p0: Point, p1: Point, p2: Point, p3: Point): Point[] {
    this.hasProcessedSegment = true
    const densePoints: Point[] = []

    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
    const samples = Math.max(5, Math.ceil(dist))

    for (let i = 0; i < samples; i++) {
      const t = i / samples
      densePoints.push(catmullRomSpline(p0, p1, p2, p3, t))
    }
    densePoints.push(p2)

    const { points, remainder } = resampleSegment(
      densePoints,
      this.spacing,
      this.remainder
    )

    this.remainder = remainder
    return points
  }
}
