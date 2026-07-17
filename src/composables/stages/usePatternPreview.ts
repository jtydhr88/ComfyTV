import { onMounted, watch, type Ref } from 'vue'

export const PATTERN_PREVIEW_W = 320

export type Rgb = [number, number, number]

export function ease(t: number, interp: string): number {
  if (interp === 'smooth') return t * t * (3 - 2 * t)
  if (interp === 'ease_in') return t * t
  if (interp === 'ease_out') return 1 - (1 - t) * (1 - t)
  return t
}

export function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function mixColors(a: Rgb, b: Rgb, t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t)
  const g = Math.round(a[1] + (b[1] - a[1]) * t)
  const bl = Math.round(a[2] + (b[2] - a[2]) * t)
  return `rgb(${r},${g},${bl})`
}

export function addEasedStops(grad: CanvasGradient, color0: string, color1: string, interp: string): void {
  const c0 = hexToRgb(color0)
  const c1 = hexToRgb(color1)
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    grad.addColorStop(t, mixColors(c0, c1, ease(t, interp)))
  }
}

export interface PatternParams {
  kind: string
  width: number
  height: number
  color0: string
  color1: string
  p0x: number
  p0y: number
  p1x: number
  p1y: number
  interp: string
  softness: number
  noiseScale: number
  noiseOctaves: number
  seed: number
}

export function drawPattern(canvas: HTMLCanvasElement, p: PatternParams): void {
  const w = PATTERN_PREVIEW_W
  const h = Math.max(16, Math.round((w * p.height) / Math.max(16, p.width)))
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)

  const x0 = p.p0x * w
  const y0 = p.p0y * h
  const x1 = p.p1x * w
  const y1 = p.p1y * h

  if (p.kind === 'ramp') {
    const grad = ctx.createLinearGradient(x0, y0, x1, y1)
    addEasedStops(grad, p.color0, p.color1, p.interp)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  } else if (p.kind === 'radial') {
    const r = Math.max(1, Math.hypot(x1 - x0, y1 - y0))
    const grad = ctx.createRadialGradient(x0, y0, 0, x0, y0, r)
    addEasedStops(grad, p.color0, p.color1, p.interp)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  } else if (p.kind === 'rectangle') {
    ctx.fillStyle = p.color1
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    ctx.filter = p.softness > 0 ? `blur(${p.softness * 12}px)` : 'none'
    ctx.fillStyle = p.color0
    ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0))
    ctx.restore()
  } else {
    const c0 = hexToRgb(p.color0)
    const c1 = hexToRgb(p.color1)
    const octaves = Math.max(1, Math.round(p.noiseOctaves))
    ctx.fillStyle = p.color0
    ctx.fillRect(0, 0, w, h)
    for (let o = 0; o < octaves; o++) {
      const rng = mulberry32(Math.round(p.seed) + o * 1013)
      const cell = Math.max(1, Math.round((w / Math.max(4, p.noiseScale)) * 8) >> o)
      ctx.globalAlpha = 1 / (o + 1)
      for (let y = 0; y < h; y += cell) {
        for (let x = 0; x < w; x += cell) {
          ctx.fillStyle = mixColors(c0, c1, rng())
          ctx.fillRect(x, y, cell, cell)
        }
      }
    }
    ctx.globalAlpha = 1
  }
}

export interface UsePatternPreviewOptions {
  canvasEl: Ref<HTMLCanvasElement | undefined>
  params: {
    kind: Ref<string>
    width: Ref<number>
    height: Ref<number>
    color0: Ref<string>
    color1: Ref<string>
    p0x: Ref<number>
    p0y: Ref<number>
    p1x: Ref<number>
    p1y: Ref<number>
    interp: Ref<string>
    softness: Ref<number>
    noiseScale: Ref<number>
    noiseOctaves: Ref<number>
    noiseSpeed: Ref<number>
    seed: Ref<number>
  }
}

export function usePatternPreview(opts: UsePatternPreviewOptions) {
  const p = opts.params

  function draw(): void {
    const canvas = opts.canvasEl.value
    if (!canvas) return
    drawPattern(canvas, {
      kind: p.kind.value,
      width: p.width.value,
      height: p.height.value,
      color0: p.color0.value,
      color1: p.color1.value,
      p0x: p.p0x.value,
      p0y: p.p0y.value,
      p1x: p.p1x.value,
      p1y: p.p1y.value,
      interp: p.interp.value,
      softness: p.softness.value,
      noiseScale: p.noiseScale.value,
      noiseOctaves: p.noiseOctaves.value,
      seed: p.seed.value,
    })
  }

  watch(
    [p.kind, p.width, p.height, p.color0, p.color1, p.p0x, p.p0y, p.p1x, p.p1y, p.interp, p.softness, p.noiseScale, p.noiseOctaves, p.noiseSpeed, p.seed],
    draw,
  )
  onMounted(draw)

  return { draw }
}
