export interface PartPoint {
  x: number
  y: number
  label: 0 | 1
}

export interface PartBox {
  x: number
  y: number
  w: number
  h: number
}

export type Part =
  | { id: number; kind: 'points'; points: PartPoint[] }
  | { id: number; kind: 'box'; box: PartBox }

export const PART_COLORS = [
  '#4ea8ff', '#3fd68f', '#ffab40', '#d88cff',
  '#ff7d9c', '#59d4d4', '#e8d35b', '#ff9c6b',
]

export function partColor(id: number): string {
  return PART_COLORS[Math.abs(id) % PART_COLORS.length]
}

const num = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function parsePartsData(json: string | null | undefined): Part[] {
  if (!json) return []
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return []
  }
  const raw = (data as { parts?: unknown })?.parts
  if (!Array.isArray(raw)) return []
  const out: Part[] = []
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue
    const id = num((p as { id?: unknown }).id) ?? out.length + 1
    const kind = (p as { kind?: unknown }).kind
    if (kind === 'points' && Array.isArray((p as { points?: unknown }).points)) {
      const points: PartPoint[] = []
      for (const q of (p as { points: unknown[] }).points) {
        const x = num((q as { x?: unknown })?.x)
        const y = num((q as { y?: unknown })?.y)
        if (x == null || y == null) continue
        points.push({ x, y, label: (q as { label?: unknown }).label === 0 ? 0 : 1 })
      }
      if (points.length) out.push({ id, kind: 'points', points })
    } else if (kind === 'box') {
      const b = (p as { box?: Record<string, unknown> }).box
      const x = num(b?.x), y = num(b?.y), w = num(b?.w), h = num(b?.h)
      if (x != null && y != null && w != null && h != null && w > 0 && h > 0) {
        out.push({ id, kind: 'box', box: { x, y, w, h } })
      }
    }
  }
  return out
}

export function serializePartsData(parts: Part[]): string {
  if (!parts.length) return ''
  const rounded = parts.map((p) =>
    p.kind === 'points'
      ? { id: p.id, kind: 'points', points: p.points.map((q) => ({ x: Math.round(q.x), y: Math.round(q.y), label: q.label })) }
      : { id: p.id, kind: 'box', box: { x: Math.round(p.box.x), y: Math.round(p.box.y), w: Math.round(p.box.w), h: Math.round(p.box.h) } },
  )
  return JSON.stringify({ parts: rounded })
}

export function nextPartId(parts: Part[]): number {
  return parts.reduce((m, p) => Math.max(m, p.id), 0) + 1
}
