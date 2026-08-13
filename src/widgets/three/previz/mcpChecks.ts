export interface ActorBoundsInfo {
  label: string
  kind: string
  mounted?: boolean
  min: [number, number, number]
  max: [number, number, number]
}

const OVERLAP_EXEMPT_KINDS: ReadonlySet<string> = new Set(['road'])
const OVERLAP_RATIO_THRESHOLD = 0.15

function volume(info: ActorBoundsInfo): number {
  return Math.max(0, info.max[0] - info.min[0])
    * Math.max(0, info.max[1] - info.min[1])
    * Math.max(0, info.max[2] - info.min[2])
}

function intersectionVolume(a: ActorBoundsInfo, b: ActorBoundsInfo): number {
  const dx = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0])
  const dy = Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1])
  const dz = Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2])
  if (dx <= 0 || dy <= 0 || dz <= 0) return 0
  return dx * dy * dz
}

export function actorOverlapWarnings(infos: ActorBoundsInfo[]): string[] {
  const candidates = infos.filter(
    (info) => !OVERLAP_EXEMPT_KINDS.has(info.kind) && !info.mounted)
  const warnings: string[] = []
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i]
      const b = candidates[j]
      const overlap = intersectionVolume(a, b)
      if (overlap <= 0) continue
      const smaller = Math.min(volume(a), volume(b))
      if (smaller <= 0) continue
      const ratio = overlap / smaller
      if (ratio < OVERLAP_RATIO_THRESHOLD) continue
      warnings.push(
        `'${a.label}' (${a.kind}) overlaps '${b.label}' (${b.kind}) by `
        + `~${Math.round(ratio * 100)}% of the smaller one — move one via `
        + `update_actor {pos} or remove it`)
    }
  }
  return warnings
}
