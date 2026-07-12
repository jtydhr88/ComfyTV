import * as THREE from 'three'

import type { CharacterTransform } from './types'

export const MODEL_FIT_TARGET_SIZE = 2

export const MODEL_AUTO_FIT_MIN = 0.1
export const MODEL_AUTO_FIT_MAX = 20

export interface ModelFitResult {
  maxDim: number
  transform: CharacterTransform
}

export function computeModelFit(object: THREE.Object3D): ModelFitResult | null {
  const bounds = new THREE.Box3().setFromObject(object)
  if (bounds.isEmpty()) return null
  const size = bounds.getSize(new THREE.Vector3())
  const center = bounds.getCenter(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  if (!Number.isFinite(maxDim) || maxDim <= 0) return null
  const scale = MODEL_FIT_TARGET_SIZE / maxDim
  return {
    maxDim,
    transform: {
      position: {
        x: -center.x * scale,
        y: -bounds.min.y * scale,
        z: -center.z * scale
      },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: scale, y: scale, z: scale }
    }
  }
}

export function needsAutoFit(maxDim: number): boolean {
  return maxDim > MODEL_AUTO_FIT_MAX || maxDim < MODEL_AUTO_FIT_MIN
}
