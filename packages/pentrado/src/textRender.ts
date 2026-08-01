import Typr, { type TyprFont } from './vendor/typr'

type FontRefLike = { kind: 'builtin'; id: string } | { kind: 'url'; url: string; name?: string }

export interface TextStyle {
  id: string
  text: string
  fontRef: FontRefLike
  fontSize: number
  color: string
  letterSpacing: number
  lineHeight: number
  align: 'left' | 'center' | 'right'
}

export interface TextMetrics {
  w: number
  h: number
}

interface ShapedLine {
  items: ReturnType<typeof Typr.U.shape>
  width: number
}

function shapeLines(style: TextStyle, font: TyprFont): { lines: ShapedLine[]; scale: number } {
  const scale = style.fontSize / font.head.unitsPerEm
  const lines = (style.text || ' ').split('\n').map((text) => {
    const items = Typr.U.shape(font, text)
    let width = 0
    for (const it of items) width += it.ax * scale + style.letterSpacing
    return { items, width }
  })
  return { lines, scale }
}
function padFor(style: TextStyle): number {
  return Math.ceil(style.fontSize * 0.25)
}

export function measureText(style: TextStyle, font: TyprFont): TextMetrics {
  const { lines, scale } = shapeLines(style, font)
  const asc = font.hhea.ascender * scale
  const desc = -font.hhea.descender * scale
  const lineAdvance = style.fontSize * style.lineHeight
  const pad = padFor(style)
  const w = Math.max(1, Math.ceil(Math.max(...lines.map((l) => l.width)) + pad * 2))
  const h = Math.max(1, Math.ceil((lines.length - 1) * lineAdvance + asc + desc + pad * 2))
  return { w, h }
}

export function renderTextToCanvas(style: TextStyle, font: TyprFont): HTMLCanvasElement {
  const { lines, scale } = shapeLines(style, font)
  const metrics = measureText(style, font)
  const asc = font.hhea.ascender * scale
  const lineAdvance = style.fontSize * style.lineHeight
  const pad = padFor(style)

  const canvas = document.createElement('canvas')
  canvas.width = metrics.w
  canvas.height = metrics.h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = style.color

  const maxWidth = metrics.w - pad * 2
  const alignFactor = style.align === 'center' ? 0.5 : style.align === 'right' ? 1 : 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const baseline = pad + asc + i * lineAdvance
    let penX = pad + (maxWidth - line.width) * alignFactor
    for (const item of line.items) {
      const path = Typr.U.glyphToPath(font, item.g)
      if (path.cmds.length > 0) {
        ctx.save()
        ctx.translate(penX + item.dx * scale, baseline - item.dy * scale)
        ctx.scale(scale, -scale)
        ctx.beginPath()
        Typr.U.pathToContext(path, ctx)
        ctx.fill()
        ctx.restore()
      }
      penX += item.ax * scale + style.letterSpacing
    }
  }
  return canvas
}

function paramsHash(style: TextStyle): string {
  const fontKey = style.fontRef.kind === 'builtin' ? style.fontRef.id : style.fontRef.url
  return [
    style.text, fontKey, style.fontSize, style.color,
    style.letterSpacing, style.lineHeight, style.align,
  ].join(' ')
}
export class TextRenderCache {
  private cache = new Map<string, { hash: string; canvas: HTMLCanvasElement }>()

  get(style: TextStyle, font: TyprFont | null): HTMLCanvasElement | null {
    if (!font) return null
    const hash = paramsHash(style)
    const hit = this.cache.get(style.id)
    if (hit && hit.hash === hash) return hit.canvas
    const canvas = renderTextToCanvas(style, font)
    this.cache.set(style.id, { hash, canvas })
    return canvas
  }

  drop(layerId: string): void {
    this.cache.delete(layerId)
  }

  clear(): void {
    this.cache.clear()
  }
}
