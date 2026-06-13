export interface Point {
  x: number
  y: number
}

export type PainterTool = 'brush' | 'eraser' | 'fill' | 'rect' | 'ellipse' | 'label'

export const PAINTER_TOOLS = {
  BRUSH: 'brush' as const,
  ERASER: 'eraser' as const,
  FILL: 'fill' as const,
  RECT: 'rect' as const,
  ELLIPSE: 'ellipse' as const,
  LABEL: 'label' as const,
}


export interface RGB {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string): RGB {
  let r = 0, g = 0, b = 0
  if (hex.length === 4 || hex.length === 5) {
    r = parseInt(hex[1] + hex[1], 16)
    g = parseInt(hex[2] + hex[2], 16)
    b = parseInt(hex[3] + hex[3], 16)
  } else if (hex.length === 7 || hex.length === 9) {
    r = parseInt(hex.slice(1, 3), 16)
    g = parseInt(hex.slice(3, 5), 16)
    b = parseInt(hex.slice(5, 7), 16)
  }
  return { r, g, b }
}

export function toHex(val: unknown): string {
  if (typeof val !== 'string') return '#000000'
  const raw = val.trim().toLowerCase()
  if (!raw) return '#000000'
  if (/^[0-9a-f]{3,4}$/.test(raw)) return `#${raw}`
  if (/^#[0-9a-f]{3,4}$/.test(raw)) return raw
  if (/^[0-9a-f]{6}$/.test(raw)) return `#${raw}`
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw
  if (/^[0-9a-f]{8}$/.test(raw)) return `#${raw}`.slice(0, 7)
  if (/^#[0-9a-f]{8}$/.test(raw)) return raw.slice(0, 7)
  return '#000000'
}
