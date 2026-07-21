import { getFontStore } from '../../fontStore'
import { TextRenderCache, type TextStyle } from '../../textRender'
import { defaultMode } from '../mode'
import type { NodeKind, RenderNodeCtx } from '../nodeKind'
import type { NodeTexture } from '../compositor'
import type { FontRef, Rect, TextData, Transform, Vec2 } from '../node'
import { generateId } from '../id'
import { placeBitmap } from '../render/place'

const textCache = new TextRenderCache()

function styleOf(node: TextData): TextStyle {
  return {
    id: node.id,
    text: node.text,
    fontRef: node.fontRef,
    fontSize: node.fontSize,
    color: node.color,
    letterSpacing: node.letterSpacing,
    lineHeight: node.lineHeight,
    align: node.align,
  }
}

function fillTextFallback(node: TextData, region: Rect): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas')
  canvas.width = region.w
  canvas.height = region.h
  const g = canvas.getContext('2d')
  if (!g) return null
  const tf = node.transform
  const family = node.fontRef.kind === 'url' ? (node.fontRef.name ?? 'sans-serif') : node.fontRef.id || 'sans-serif'
  g.save()
  g.translate(tf.x + tf.w / 2, tf.y + tf.h / 2)
  g.rotate(tf.rotation)
  g.font = `${node.fontSize}px ${family}`
  g.fillStyle = node.color
  g.textBaseline = 'top'
  g.textAlign = node.align
  if ('letterSpacing' in g) {
    ;(g as unknown as { letterSpacing: string }).letterSpacing = `${node.letterSpacing}px`
  }
  const originX = node.align === 'center' ? 0 : node.align === 'right' ? tf.w / 2 : -tf.w / 2
  const step = node.fontSize * node.lineHeight
  node.text.split('\n').forEach((line, i) => g.fillText(line, originX, -tf.h / 2 + i * step))
  g.restore()
  return canvas
}

const num = (v: unknown, d: number): number => (typeof v === 'number' && isFinite(v) ? v : d)
const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d)
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d)

function defaultTransform(): Transform {
  return { x: 0, y: 0, w: 200, h: 64, rotation: 0 }
}

export const textKind: NodeKind<TextData> = {
  kind: 'text',

  create(init: Partial<TextData> = {}): TextData {
    return {
      kind: 'text',
      id: init.id ?? generateId('text'),
      name: init.name ?? 'Text',
      visible: init.visible ?? true,
      opacity: init.opacity ?? 1,
      mode: init.mode ?? defaultMode('normal'),
      transform: init.transform ?? defaultTransform(),
      locks: init.locks ?? { content: false, position: false, visibility: false },
      text: init.text ?? 'Text',
      fontRef: init.fontRef ?? { kind: 'builtin', id: 'sans-serif' },
      fontSize: init.fontSize ?? 48,
      color: init.color ?? '#ffffff',
      letterSpacing: init.letterSpacing ?? 0,
      lineHeight: init.lineHeight ?? 1.2,
      align: init.align ?? 'left',
      mask: init.mask,
    }
  },

  normalize(raw: unknown): TextData {
    const r = (raw ?? {}) as Record<string, unknown>
    const t = (r.transform ?? {}) as Record<string, unknown>
    const locks = (r.locks ?? {}) as Record<string, unknown>
    const align = str(r.align, 'left')
    return {
      kind: 'text',
      id: str(r.id, generateId('text')),
      name: str(r.name, 'Text'),
      visible: bool(r.visible, true),
      opacity: Math.max(0, Math.min(1, num(r.opacity, 1))),
      mode: (r.mode as TextData['mode']) ?? defaultMode('normal'),
      transform: {
        x: num(t.x, 0),
        y: num(t.y, 0),
        w: num(t.w, 200),
        h: num(t.h, 64),
        rotation: num(t.rotation, 0),
      },
      locks: {
        content: bool(locks.content, false),
        position: bool(locks.position, false),
        visibility: bool(locks.visibility, false),
      },
      text: str(r.text, ''),
      fontRef: (r.fontRef as FontRef) ?? { kind: 'builtin', id: 'sans-serif' },
      fontSize: Math.max(4, Math.min(2048, num(r.fontSize, 48))),
      color: str(r.color, '#ffffff'),
      letterSpacing: num(r.letterSpacing, 0),
      lineHeight: num(r.lineHeight, 1.2),
      align: align === 'center' || align === 'right' ? align : 'left',
      mask: r.mask as TextData['mask'],
    }
  },

  serialize(node: TextData): unknown {
    return { ...node }
  },

  contentIds(node: TextData): string[] {
    return node.mask ? [node.mask.contentId].filter(Boolean) : []
  },

  async hydrate(node: TextData, deps): Promise<void> {
    if (node.mask && !deps.content.has(node.mask.contentId) && node.mask.url) {
      const canvas = await deps.loadUrl(node.mask.url)
      deps.content.register(canvas, { id: node.mask.contentId, uploadedUrl: node.mask.url })
    }
  },

  renderNode(node: TextData, ctx: RenderNodeCtx): NodeTexture | null {
    const font = getFontStore().getFontSyncWithFallback(node.fontRef)
    const bitmap = textCache.get(styleOf(node), font)
    if (bitmap) {
      const placed = placeBitmap(bitmap, node.transform, ctx.region.w, ctx.region.h)
      return placed ? { source: placed, rect: ctx.region, linear: false } : null
    }
    const canvas = fillTextFallback(node, ctx.region)
    return canvas ? { source: canvas, rect: ctx.region, linear: false } : null
  },

  bbox(node: TextData): Rect {
    return { x: node.transform.x, y: node.transform.y, w: node.transform.w, h: node.transform.h }
  },

  thumbnail(): HTMLCanvasElement | null {
    return null
  },

  hitTest(node: TextData, pt: Vec2): boolean {
    const b = this.bbox(node)
    return pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h
  },
}
