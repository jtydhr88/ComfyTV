export type FilterOp = 'gaussian-blur' | 'sharpen' | 'motion-blur' | 'pixelate' | 'noise' | 'desaturate'

export const FILTER_OPS: FilterOp[] = ['gaussian-blur', 'sharpen', 'motion-blur', 'pixelate', 'noise', 'desaturate']

export const FILTER_PARAM_DEFS: Record<FilterOp, Array<{ key: string; min: number; max: number; default: number; step?: number }>> = {
  'gaussian-blur': [{ key: 'radius', min: 1, max: 100, default: 8, step: 1 }],
  sharpen: [
    { key: 'amount', min: 0, max: 3, default: 0.5, step: 0.05 },
    { key: 'radius', min: 1, max: 20, default: 2, step: 1 },
  ],
  'motion-blur': [
    { key: 'distance', min: 2, max: 200, default: 20, step: 1 },
    { key: 'angle', min: 0, max: 360, default: 0, step: 1 },
  ],
  pixelate: [{ key: 'size', min: 2, max: 64, default: 8, step: 1 }],
  noise: [{ key: 'amount', min: 0, max: 1, default: 0.15, step: 0.01 }],
  desaturate: [],
}

export function defaultFilterParams(op: FilterOp): Record<string, number> {
  const out: Record<string, number> = {}
  for (const def of FILTER_PARAM_DEFS[op]) out[def.key] = def.default
  return out
}

function blank(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return { canvas, ctx: canvas.getContext('2d')! }
}

function gaussianBlur(src: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  const { canvas, ctx } = blank(src.width, src.height)
  ctx.filter = `blur(${Math.max(0, radius)}px)`
  ctx.drawImage(src, 0, 0)
  return canvas
}

function sharpen(src: HTMLCanvasElement, amount: number, radius: number): HTMLCanvasElement {
  const blurred = gaussianBlur(src, radius)
  const { canvas, ctx } = blank(src.width, src.height)
  ctx.drawImage(src, 0, 0)
  const img = ctx.getImageData(0, 0, src.width, src.height)
  const b = blurred.getContext('2d')!.getImageData(0, 0, src.width, src.height).data
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i] + (d[i] - b[i]) * amount
    d[i + 1] = d[i + 1] + (d[i + 1] - b[i + 1]) * amount
    d[i + 2] = d[i + 2] + (d[i + 2] - b[i + 2]) * amount
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

function motionBlur(src: HTMLCanvasElement, distance: number, angleDeg: number): HTMLCanvasElement {
  const { canvas, ctx } = blank(src.width, src.height)
  const steps = Math.min(64, Math.max(3, Math.round(distance / 2)))
  const rad = (angleDeg * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  for (let i = 0; i < steps; i++) {
    const f = (i / (steps - 1) - 0.5) * distance
    ctx.globalAlpha = 1 / (i + 1)
    ctx.drawImage(src, dx * f, dy * f)
  }
  ctx.globalAlpha = 1
  return canvas
}

function pixelate(src: HTMLCanvasElement, size: number): HTMLCanvasElement {
  const s = Math.max(2, Math.round(size))
  const w = Math.max(1, Math.round(src.width / s))
  const h = Math.max(1, Math.round(src.height / s))
  const small = blank(w, h)
  small.ctx.imageSmoothingEnabled = true
  small.ctx.drawImage(src, 0, 0, w, h)
  const { canvas, ctx } = blank(src.width, src.height)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(small.canvas, 0, 0, src.width, src.height)
  return canvas
}

function noise(src: HTMLCanvasElement, amount: number): HTMLCanvasElement {
  const { canvas, ctx } = blank(src.width, src.height)
  ctx.drawImage(src, 0, 0)
  const img = ctx.getImageData(0, 0, src.width, src.height)
  const d = img.data
  const scale = amount * 255
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue
    const n = (Math.random() * 2 - 1) * scale
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

function desaturate(src: HTMLCanvasElement): HTMLCanvasElement {
  const { canvas, ctx } = blank(src.width, src.height)
  ctx.filter = 'grayscale(1)'
  ctx.drawImage(src, 0, 0)
  return canvas
}

export function applyImageFilter(
  op: FilterOp,
  src: HTMLCanvasElement,
  params: Record<string, number>
): HTMLCanvasElement {
  switch (op) {
    case 'gaussian-blur':
      return gaussianBlur(src, params.radius ?? 8)
    case 'sharpen':
      return sharpen(src, params.amount ?? 0.5, params.radius ?? 2)
    case 'motion-blur':
      return motionBlur(src, params.distance ?? 20, params.angle ?? 0)
    case 'pixelate':
      return pixelate(src, params.size ?? 8)
    case 'noise':
      return noise(src, params.amount ?? 0.15)
    case 'desaturate':
      return desaturate(src)
  }
}
