import * as THREE from 'three'

import type { MaterialParams } from './types'

export function applyMaterialParams(
  mat: THREE.MeshPhysicalMaterial,
  p: MaterialParams,
): void {
  mat.color.set(p.color)
  mat.metalness = p.metalness
  mat.roughness = p.roughness
  mat.transmission = p.transmission
  mat.opacity = p.opacity
  mat.transparent = p.opacity < 1
  mat.clearcoat = p.clearcoat
  mat.clearcoatRoughness = p.clearcoatRoughness
  mat.ior = p.ior
  mat.emissive.set(p.emissive)
  mat.emissiveIntensity = p.emissiveIntensity
}
