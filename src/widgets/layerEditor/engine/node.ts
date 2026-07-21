import type { LayerMode } from './mode'

export interface Vec2 {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Transform {
  x: number
  y: number
  w: number
  h: number
  rotation: number
}

export interface Locks {
  content: boolean
  position: boolean
  visibility: boolean
}

export interface NodeBase {
  id: string
  kind: string
  name: string
  visible: boolean
  opacity: number
  mode: LayerMode
  transform: Transform
  locks: Locks
  colorTag?: string
}

export type ChannelRole = 'mask' | 'selection' | 'saved'

export interface ChannelData {
  id: string
  role: ChannelRole
  contentId: string
  url?: string
  enabled: boolean
  color?: string
}

export interface EffectRef {
  id: string
  op: string
  enabled: boolean
  params: Record<string, unknown>
}

export interface DrawableData extends NodeBase {
  mask?: ChannelData
  effects?: EffectRef[]
}

export interface RasterData extends DrawableData {
  kind: 'raster'
  contentId: string
  url?: string
  naturalWidth: number
  naturalHeight: number
}

export type FontRef =
  | { kind: 'builtin'; id: string }
  | { kind: 'url'; url: string; name?: string }

export interface TextData extends DrawableData {
  kind: 'text'
  text: string
  fontRef: FontRef
  fontSize: number
  color: string
  letterSpacing: number
  lineHeight: number
  align: 'left' | 'center' | 'right'
}

export interface VectorData extends DrawableData {
  kind: 'vector'

  path: import('./vector').PathData
  fill?: import('./vector').FillStyle
  stroke?: import('./vector').StrokeStyle
}

export interface GroupData extends DrawableData {
  kind: 'group'
  children: SceneNode[]
  passThrough: boolean
}

export type SceneNode = RasterData | TextData | VectorData | GroupData

export function isDrawable(node: NodeBase): node is DrawableData {
  return node.kind !== 'path'
}

export function isGroup(node: NodeBase): node is GroupData {
  return node.kind === 'group'
}
