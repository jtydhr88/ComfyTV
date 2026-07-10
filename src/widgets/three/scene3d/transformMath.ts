import * as THREE from 'three'

import type { Quat, Vec3 } from './types'

const euler = new THREE.Euler()
const quaternion = new THREE.Quaternion()

export function quatToEulerDegrees(q: Quat): Vec3 {
  quaternion.set(q.x, q.y, q.z, q.w).normalize()
  euler.setFromQuaternion(quaternion, 'XYZ')
  return {
    x: THREE.MathUtils.radToDeg(euler.x),
    y: THREE.MathUtils.radToDeg(euler.y),
    z: THREE.MathUtils.radToDeg(euler.z)
  }
}

export function eulerDegreesToQuat(degrees: Vec3): Quat {
  euler.set(
    THREE.MathUtils.degToRad(degrees.x),
    THREE.MathUtils.degToRad(degrees.y),
    THREE.MathUtils.degToRad(degrees.z),
    'XYZ'
  )
  quaternion.setFromEuler(euler)
  return {
    x: quaternion.x,
    y: quaternion.y,
    z: quaternion.z,
    w: quaternion.w
  }
}
