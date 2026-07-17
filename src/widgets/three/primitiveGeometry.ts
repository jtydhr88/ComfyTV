import * as THREE from 'three'

export type PrimKind = 'cube' | 'sphere' | 'cylinder' | 'cone' | 'plane' | 'torus'

export const PRIM_KINDS: PrimKind[] = ['cube', 'sphere', 'cylinder', 'cone', 'plane', 'torus']

const TAU = Math.PI * 2

export function normalizePrimKind(v: string): PrimKind {
  return (PRIM_KINDS as string[]).includes(v) ? (v as PrimKind) : 'cube'
}

export function buildPrimitiveGeometry(
  kind: PrimKind,
  p: Record<string, number | boolean>,
): THREE.BufferGeometry {
  const n = (k: string, d: number): number => {
    const v = Number(p[k])
    return Number.isFinite(v) ? v : d
  }
  const b = (k: string): boolean => Boolean(p[k])
  switch (kind) {
    case 'sphere':
      return new THREE.SphereGeometry(n('radius', 0.5), n('widthSegments', 32), n('heightSegments', 16),
        n('phiStart', 0), n('phiLength', TAU), n('thetaStart', 0), n('thetaLength', Math.PI))
    case 'cylinder':
      return new THREE.CylinderGeometry(n('radiusTop', 0.5), n('radiusBottom', 0.5), n('height', 1),
        n('radialSegments', 32), n('heightSegments', 1), b('openEnded'), n('thetaStart', 0), n('thetaLength', TAU))
    case 'cone':
      return new THREE.ConeGeometry(n('radius', 0.5), n('height', 1), n('radialSegments', 32),
        n('heightSegments', 1), b('openEnded'), n('thetaStart', 0), n('thetaLength', TAU))
    case 'plane':
      return new THREE.PlaneGeometry(n('width', 1), n('height', 1), n('widthSegments', 1), n('heightSegments', 1))
    case 'torus':
      return new THREE.TorusGeometry(n('radius', 0.5), n('tube', 0.2), n('radialSegments', 12),
        n('tubularSegments', 48), n('arc', TAU))
    case 'cube':
    default:
      return new THREE.BoxGeometry(n('width', 1), n('height', 1), n('depth', 1),
        n('widthSegments', 1), n('heightSegments', 1), n('depthSegments', 1))
  }
}

export interface PrimitiveRecipe {
  kind: PrimKind
  params: Record<string, number | boolean>
}

export function parsePrimitiveRecipe(payload: string | null | undefined): PrimitiveRecipe | null {
  const s = (payload ?? '').trim()
  if (!s.startsWith('{') || !s.includes('__prim__')) return null
  try {
    const spec = JSON.parse(s) as Record<string, unknown>
    const prim = spec.__prim__ as Record<string, unknown> | undefined
    if (!prim || typeof prim !== 'object') return null
    const params: Record<string, number | boolean> = {}
    for (const [k, v] of Object.entries(prim)) {
      if (k === 'kind') continue
      params[k] = typeof v === 'boolean' ? v : Number(v)
    }
    return { kind: normalizePrimKind(String(prim.kind ?? 'cube')), params }
  } catch {
    return null
  }
}

export function buildPrimitiveMesh(kind: PrimKind, params: Record<string, number | boolean>): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x9aa4b2,
    metalness: 0.05,
    roughness: 0.75,
    side: THREE.DoubleSide,
  })
  return new THREE.Mesh(buildPrimitiveGeometry(kind, params), mat)
}
