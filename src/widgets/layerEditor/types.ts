import type { SceneNode } from './engine/node'

export interface Point {
  x: number
  y: number
}

export type FontRef =
  | { kind: 'builtin'; id: string }
  | { kind: 'url'; url: string; name?: string }

export interface LayerRow {
  node: SceneNode
  depth: number
  parentId?: string
}

export type ToolId = 'select' | 'marquee' | 'brush' | 'eraser' | 'text' | 'shape'

export interface ToolHandler {
  onPointerDown: (e: PointerEvent, pt: Point) => boolean
  onPointerMove: (e: PointerEvent, pt: Point) => void
  onPointerUp: (e: PointerEvent, pt: Point) => void
  cursorFor: (pt: Point) => string
}
