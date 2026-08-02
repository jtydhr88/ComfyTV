import type { SymmetrySpec } from '../paint'
import type { Vec2 } from '../node'

export type SymmetryTransform = (pt: Vec2) => Vec2

export function symmetryTransforms(spec?: SymmetrySpec): SymmetryTransform[] {
  const id: SymmetryTransform = (p) => p
  if (!spec || spec.mode === 'none') return [id]
  const { cx, cy } = spec
  const mh: SymmetryTransform = (p) => ({ x: 2 * cx - p.x, y: p.y })
  const mv: SymmetryTransform = (p) => ({ x: p.x, y: 2 * cy - p.y })
  switch (spec.mode) {
    case 'mirror-h':
      return [id, mh]
    case 'mirror-v':
      return [id, mv]
    case 'mirror-both':
      return [id, mh, mv, (p) => ({ x: 2 * cx - p.x, y: 2 * cy - p.y })]
    case 'mandala': {
      const n = Math.max(2, Math.min(16, Math.round(spec.sectors ?? 6)))
      const out: SymmetryTransform[] = []
      for (let k = 0; k < n; k++) {
        const a = (k * 2 * Math.PI) / n
        const c = Math.cos(a)
        const s = Math.sin(a)
        out.push((p) => {
          const dx = p.x - cx
          const dy = p.y - cy
          return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c }
        })
      }
      return out
    }
  }
}
