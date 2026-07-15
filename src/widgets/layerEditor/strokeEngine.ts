
import { getEffectiveBrushSize, getEffectiveHardness } from '@/widgets/painter/brushUtils'
import { hexToRgb, type Point } from '@/widgets/painter/types'

export interface StrokeBrush {
  radius: number
  effectiveRadius: number
  effectiveHardness: number
  hardness: number
  r: number
  g: number
  b: number
}

export function makeStrokeBrush(sizePx: number, hardness: number, color: string): StrokeBrush {
  const radius = Math.max(0.5, sizePx / 2)
  const effectiveRadius = getEffectiveBrushSize(radius, hardness)
  return {
    radius,
    effectiveRadius,
    effectiveHardness: getEffectiveHardness(radius, hardness, effectiveRadius),
    hardness,
    ...hexToRgb(color),
  }
}

export function applyBrushStyle(ctx: CanvasRenderingContext2D, b: StrokeBrush): void {
  const color = `rgb(${b.r}, ${b.g}, ${b.b})`
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = b.effectiveRadius * 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

export function drawCircle(ctx: CanvasRenderingContext2D, b: StrokeBrush, point: Point): void {
  ctx.beginPath()
  ctx.arc(point.x, point.y, b.effectiveRadius, 0, Math.PI * 2)
  if (b.hardness < 1) {
    const gradient = ctx.createRadialGradient(
      point.x, point.y, 0, point.x, point.y, b.effectiveRadius,
    )
    gradient.addColorStop(0, `rgba(${b.r}, ${b.g}, ${b.b}, 1)`)
    gradient.addColorStop(b.effectiveHardness, `rgba(${b.r}, ${b.g}, ${b.b}, 1)`)
    gradient.addColorStop(1, `rgba(${b.r}, ${b.g}, ${b.b}, 0)`)
    ctx.fillStyle = gradient
  }
  ctx.fill()
}

export function drawSegment(
  ctx: CanvasRenderingContext2D,
  b: StrokeBrush,
  from: Point,
  to: Point,
): void {
  if (b.hardness < 1) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dist = Math.hypot(dx, dy)
    const step = Math.max(1, b.effectiveRadius / 2)
    if (dist > 0) {
      const steps = Math.ceil(dist / step)
      const dab: Point = { x: 0, y: 0 }
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        dab.x = from.x + dx * t
        dab.y = from.y + dy * t
        drawCircle(ctx, b, dab)
      }
    }
  } else {
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    drawCircle(ctx, b, to)
  }
}
