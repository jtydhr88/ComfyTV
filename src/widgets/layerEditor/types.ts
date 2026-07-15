export interface Point {
  x: number
  y: number
}
export interface LayerTransform {
  x: number
  y: number
  w: number
  h: number
  rotation: number
}
export const BLEND_MODES = [
  'source-over', 'multiply', 'screen', 'overlay',
  'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion',
] as const

export type BlendMode = (typeof BLEND_MODES)[number]
export interface LayerMask {
  contentId: string
  url?: string
  enabled: boolean
}

interface LayerBase {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  blendMode: BlendMode
  transform: LayerTransform
  mask?: LayerMask
}

export interface RasterLayer extends LayerBase {
  type: 'raster'
  contentId: string
  url?: string
  naturalWidth: number
  naturalHeight: number
}

export type FontRef =
  | { kind: 'builtin'; id: string }
  | { kind: 'url'; url: string; name?: string }

export interface TextLayer extends LayerBase {
  type: 'text'
  text: string
  fontRef: FontRef
  fontSize: number
  color: string
  letterSpacing: number
  lineHeight: number
  align: 'left' | 'center' | 'right'
}

export type Layer = RasterLayer | TextLayer

export interface LayerEditorState {
  version: 1
  width: number
  height: number
  layers: Layer[]
}

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate'

export type ToolId = 'select' | 'brush' | 'eraser' | 'text'
