import type { Vec3 } from './types'

const RAD2DEG = 180 / Math.PI
const DEG2RAD = Math.PI / 180

export const MIN_DISTANCE = 0.5
export const MAX_DISTANCE = 100
export const MIN_PITCH = -89
export const MAX_PITCH = 89

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v))

export function pointToYawAngle(point: Vec3, target: Vec3): number {
  return Math.atan2(point.x - target.x, point.z - target.z) * RAD2DEG
}

export function pointToPitchAngle(
  point: Vec3,
  target: Vec3,
  yawDeg: number
): number {
  const y = yawDeg * DEG2RAD
  const dx = point.x - target.x
  const dy = point.y - target.y
  const dz = point.z - target.z
  const horizontal = dx * Math.sin(y) + dz * Math.cos(y)
  const raw = Math.atan2(dy, horizontal) * RAD2DEG
  return clamp(raw, MIN_PITCH, MAX_PITCH)
}

export function pointToDistance(
  point: Vec3,
  target: Vec3,
  yawDeg: number,
  pitchDeg: number
): number {
  const y = yawDeg * DEG2RAD
  const p = pitchDeg * DEG2RAD
  const dirX = Math.cos(p) * Math.sin(y)
  const dirY = Math.sin(p)
  const dirZ = Math.cos(p) * Math.cos(y)
  const dx = point.x - target.x
  const dy = point.y - target.y
  const dz = point.z - target.z
  const projection = dx * dirX + dy * dirY + dz * dirZ
  return clamp(projection, MIN_DISTANCE, MAX_DISTANCE)
}
