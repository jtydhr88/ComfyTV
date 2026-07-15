import {
  BLEND_MODES,
  type BlendMode,
  type FontRef,
  type Layer,
  type LayerEditorState,
  type LayerMask,
  type LayerTransform,
  type RasterLayer,
  type TextLayer,
} from './types'

export const MIN_ARTBOARD = 64
export const MAX_ARTBOARD = 4096
export const MIN_LAYER_SIZE = 8

let nextId = 1

export function generateId(prefix = 'layer'): string {
  return `${prefix}-${Date.now().toString(36)}-${(nextId++).toString(36)}`
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

function num(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function normalizeTransform(raw: unknown): LayerTransform {
  const t = (raw ?? {}) as Partial<LayerTransform>
  return {
    x: num(t.x, 0),
    y: num(t.y, 0),
    w: Math.max(MIN_LAYER_SIZE, num(t.w, MIN_LAYER_SIZE)),
    h: Math.max(MIN_LAYER_SIZE, num(t.h, MIN_LAYER_SIZE)),
    rotation: num(t.rotation, 0),
  }
}

function normalizeBlendMode(raw: unknown): BlendMode {
  return BLEND_MODES.includes(raw as BlendMode) ? (raw as BlendMode) : 'source-over'
}

function normalizeMask(raw: unknown): LayerMask | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const m = raw as Partial<LayerMask>
  if (typeof m.contentId !== 'string' || !m.contentId) return undefined
  const mask: LayerMask = { contentId: m.contentId, enabled: m.enabled !== false }
  if (typeof m.url === 'string' && m.url) mask.url = m.url
  return mask
}

function normalizeFontRef(raw: unknown): FontRef {
  const r = raw as FontRef | undefined
  if (r && r.kind === 'url' && typeof r.url === 'string' && r.url) {
    return { kind: 'url', url: r.url, name: typeof r.name === 'string' ? r.name : undefined }
  }
  if (r && r.kind === 'builtin' && typeof r.id === 'string' && r.id) {
    return { kind: 'builtin', id: r.id }
  }
  return { kind: 'builtin', id: 'inter' }
}

function normalizeLayer(raw: unknown): Layer | null {
  if (!raw || typeof raw !== 'object') return null
  const l = raw as Record<string, unknown>
  const base = {
    id: typeof l.id === 'string' && l.id ? l.id : generateId(),
    name: typeof l.name === 'string' ? l.name : 'Layer',
    visible: l.visible !== false,
    locked: l.locked === true,
    opacity: clamp(num(l.opacity, 1), 0, 1),
    blendMode: normalizeBlendMode(l.blendMode),
    transform: normalizeTransform(l.transform),
    mask: normalizeMask(l.mask),
  }
  if (l.type === 'text') {
    const layer: TextLayer = {
      ...base,
      type: 'text',
      text: typeof l.text === 'string' ? l.text : '',
      fontRef: normalizeFontRef(l.fontRef),
      fontSize: clamp(num(l.fontSize, 64), 4, 2048),
      color: typeof l.color === 'string' && l.color ? l.color : '#ffffff',
      letterSpacing: num(l.letterSpacing, 0),
      lineHeight: clamp(num(l.lineHeight, 1.2), 0.5, 4),
      align: l.align === 'center' || l.align === 'right' ? l.align : 'left',
    }
    return layer
  }
  if (typeof l.contentId !== 'string' || !l.contentId) return null
  const layer: RasterLayer = {
    ...base,
    type: 'raster',
    contentId: l.contentId,
    url: typeof l.url === 'string' && l.url ? l.url : undefined,
    naturalWidth: Math.max(1, Math.round(num(l.naturalWidth, num((l.transform as LayerTransform | undefined)?.w, 1)))),
    naturalHeight: Math.max(1, Math.round(num(l.naturalHeight, num((l.transform as LayerTransform | undefined)?.h, 1)))),
  }
  return layer
}

export function normalizeLayerState(raw: string | unknown): LayerEditorState {
  let value: unknown = raw
  if (typeof raw === 'string') {
    try {
      value = raw.trim() ? JSON.parse(raw) : {}
    } catch {
      value = {}
    }
  }
  const v = (value ?? {}) as Record<string, unknown>
  const layers = Array.isArray(v.layers)
    ? v.layers.map(normalizeLayer).filter((l): l is Layer => l !== null)
    : []
  return {
    version: 1,
    width: Math.round(clamp(num(v.width, 1024), MIN_ARTBOARD, MAX_ARTBOARD)),
    height: Math.round(clamp(num(v.height, 1024), MIN_ARTBOARD, MAX_ARTBOARD)),
    layers,
  }
}

export function cloneState(state: LayerEditorState): LayerEditorState {
  return JSON.parse(JSON.stringify(state)) as LayerEditorState
}

export function createRasterLayer(opts: {
  contentId: string
  name: string
  naturalWidth: number
  naturalHeight: number
  transform: LayerTransform
  url?: string
}): RasterLayer {
  return {
    id: generateId(),
    type: 'raster',
    name: opts.name,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    transform: { ...opts.transform },
    contentId: opts.contentId,
    url: opts.url,
    naturalWidth: opts.naturalWidth,
    naturalHeight: opts.naturalHeight,
  }
}

export function createTextLayer(opts: {
  text: string
  at: { x: number; y: number }
  fontRef?: FontRef
  fontSize?: number
  color?: string
}): TextLayer {
  const fontSize = opts.fontSize ?? 64
  return {
    id: generateId(),
    type: 'text',
    name: opts.text.slice(0, 20) || 'Text',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    transform: { x: opts.at.x, y: opts.at.y, w: fontSize * 4, h: fontSize * 1.2, rotation: 0 },
    text: opts.text,
    fontRef: opts.fontRef ?? { kind: 'builtin', id: 'inter' },
    fontSize,
    color: opts.color ?? '#ffffff',
    letterSpacing: 0,
    lineHeight: 1.2,
    align: 'left',
  }
}
export function contentIdsInJson(json: string): string[] {
  const state = normalizeLayerState(json)
  const ids: string[] = []
  for (const layer of state.layers) {
    if (layer.type === 'raster') ids.push(layer.contentId)
    if (layer.mask) ids.push(layer.mask.contentId)
  }
  return ids
}
