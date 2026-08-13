import * as THREE from 'three'
import {
  Extend,
  HandleType,
  Interpolation,
  arcLengthToU,
  buildArcTable,
  deleteKeyframe,
  evaluateFCurve,
  exportCameraActionToJson,
  importCameraActionFromJson,
  insertOrReplaceKeyframe,
  makeCameraAction,
  makeFCurve,
  makePathFollowConstraint,
  makeSplinePath,
  makeSplinePoint,
  moveKeyframe,
  pathPos,
  pathTangent,
  recalcAllSplineHandles,
  recalcSplineHandle,
  segmentCount,
  sortFCurve,
  uToArcLength,
  type ArcTable,
  type CameraAction,
  type CameraActionJson,
  type FCurve,
  type SplinePath,
  type Vec3
} from 'dollycurve'

export const PREVIZ_FPS = 30
export const PREVIZ_SENSOR_MM = 24

export function fovToLens(fovDeg: number): number {
  return PREVIZ_SENSOR_MM / 2 / Math.tan((fovDeg * Math.PI) / 360)
}

export function lensToFov(lens: number): number {
  return (Math.atan(PREVIZ_SENSOR_MM / 2 / lens) * 360) / Math.PI
}

export function smoothstep(t: number): number {
  t = Math.max(0, Math.min(1, t))
  return t * t * (3 - 2 * t)
}

function anchorTangent(points: THREE.Vector3[], i: number): THREE.Vector3 {
  const prev = points[Math.max(0, i - 1)]
  const next = points[Math.min(points.length - 1, i + 1)]
  const tan = next.clone().sub(prev)
  return tan.lengthSq() < 1e-8 ? new THREE.Vector3(1, 0, 0) : tan
}

export function splineFromPoints(points: THREE.Vector3[], straight: boolean): SplinePath {
  const splinePoints = points.map((p, i) => {
    const gap =
      points.length > 1
        ? Math.max(
            0.2,
            p.distanceTo(points[Math.min(points.length - 1, i + 1)] ?? points[Math.max(0, i - 1)]) / 3
          )
        : 1
    const sp = makeSplinePoint(
      [p.x, p.y, p.z],
      anchorTangent(points, i).normalize().toArray() as Vec3,
      gap
    )
    if (straight) {
      sp.h1Type = HandleType.VECTOR
      sp.h2Type = HandleType.VECTOR
    }
    return sp
  })
  const path = makeSplinePath(splinePoints)
  recalcAllSplineHandles(path)
  return path
}

export function speedCurveFromTimes(path: SplinePath, timesSec: number[]): FCurve {
  const table = buildArcTable(path)
  const fcu = makeFCurve('previz_speed', [], { extend: Extend.CONSTANT })
  timesSec.forEach((t, i) => {
    insertOrReplaceKeyframe(fcu, t * PREVIZ_FPS, uToArcLength(table, i), {
      ipo: Interpolation.BEZIER
    })
  })
  return fcu
}

export interface TrackBuildOptions {
  timesSec?: number[]
  straight?: boolean
}

export function makeTrackAction(points: THREE.Vector3[], opts: TrackBuildOptions = {}): CameraAction {
  const path = splineFromPoints(points, opts.straight ?? false)
  const action = makeCameraAction([], PREVIZ_FPS)
  const times =
    opts.timesSec && opts.timesSec.length === points.length ? opts.timesSec : null
  action.pathFollow = makePathFollowConstraint(path, {
    orientation: 'free',
    upAxis: 'Y',
    arcLengthUniform: true,
    ...(times ? { speedCurve: speedCurveFromTimes(path, times) } : {})
  })
  return action
}

export function distributeSpeed(action: CameraAction, startSec: number, endSec: number): void {
  const path = trackPath(action)
  if (!path || path.points.length < 2) {
    if (action.pathFollow) action.pathFollow.speedCurve = undefined
    return
  }
  const arcs = anchorArcLengths(action)
  const total = arcs[arcs.length - 1] || 1
  const times = arcs.map((s) => startSec + (endSec - startSec) * (s / total))
  action.pathFollow!.speedCurve = speedCurveFromTimes(path, times)
}

export function trackToJson(action: CameraAction): CameraActionJson {
  return exportCameraActionToJson(action)
}

export function trackFromJson(raw: unknown): CameraAction | null {
  try {
    const action = importCameraActionFromJson(raw)
    action.fps = PREVIZ_FPS
    return action
  } catch {
    return null
  }
}

export function trackPath(action: CameraAction): SplinePath | null {
  return action.pathFollow?.splinePath ?? null
}

export function trackSpeed(action: CameraAction): FCurve | null {
  return action.pathFollow?.speedCurve ?? null
}

export function anchorCount(action: CameraAction): number {
  return trackPath(action)?.points.length ?? 0
}

export function anchorPositions(action: CameraAction): THREE.Vector3[] {
  return (trackPath(action)?.points ?? []).map((p) => new THREE.Vector3(...p.co))
}

export function trackArcTable(action: CameraAction): ArcTable | null {
  const path = trackPath(action)
  return path && path.points.length >= 2 ? buildArcTable(path) : null
}

export function anchorArcLengths(action: CameraAction): number[] {
  const path = trackPath(action)
  if (!path) return []
  if (path.points.length < 2) return path.points.map(() => 0)
  const table = buildArcTable(path)
  return path.points.map((_, i) => uToArcLength(table, i))
}

export function trackTimes(action: CameraAction, durationSec: number): number[] {
  const speed = trackSpeed(action)
  const n = anchorCount(action)
  if (speed && speed.bezt.length === n) {
    return speed.bezt.map((k) => k.vec[1][0] / PREVIZ_FPS)
  }
  const lens = anchorArcLengths(action)
  const total = lens[lens.length - 1] || 1
  return lens.map((s) => inverseSmoothstep(s / total) * durationSec)
}

export function inverseSmoothstep(u: number): number {
  u = Math.max(0, Math.min(1, u))
  let lo = 0
  let hi = 1
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2
    if (smoothstep(m) < u) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}

export function ensureSpeedCurve(action: CameraAction, durationSec: number): FCurve {
  const existing = trackSpeed(action)
  const n = anchorCount(action)
  if (existing && existing.bezt.length === n) return existing
  const times = trackTimes(action, durationSec)
  const path = trackPath(action)!
  const fcu = speedCurveFromTimes(path, times)
  action.pathFollow!.speedCurve = fcu
  return fcu
}

export function setTrackTime(
  action: CameraAction,
  index: number,
  seconds: number,
  durationSec: number
): void {
  const fcu = ensureSpeedCurve(action, durationSec)
  if (index < 0 || index >= fcu.bezt.length) return
  const minGap = 0.3
  const lo = index > 0 ? fcu.bezt[index - 1].vec[1][0] + minGap : 0
  const hi =
    index < fcu.bezt.length - 1
      ? fcu.bezt[index + 1].vec[1][0] - minGap
      : durationSec * PREVIZ_FPS
  const frame = Math.max(lo, Math.min(hi, seconds * PREVIZ_FPS))
  moveKeyframe(fcu, index, frame)
  sortFCurve(fcu)
}

export function addTrackAnchor(
  action: CameraAction,
  co: THREE.Vector3,
  durationSec: number
): void {
  const path = trackPath(action)
  if (!path) return
  const last = path.points[path.points.length - 1]
  const tan = last
    ? co.clone().sub(new THREE.Vector3(...last.co))
    : new THREE.Vector3(1, 0, 0)
  const point = makeSplinePoint(
    [co.x, co.y, co.z],
    (tan.lengthSq() < 1e-8 ? new THREE.Vector3(1, 0, 0) : tan.normalize()).toArray() as Vec3
  )
  if (path.points.length && path.points[0].h1Type === HandleType.VECTOR) {
    point.h1Type = HandleType.VECTOR
    point.h2Type = HandleType.VECTOR
  }
  path.points.push(point)
  recalcSplineHandle(path, path.points.length - 2)
  recalcSplineHandle(path, path.points.length - 1)
  reconcileSpeed(action, durationSec)
}

export function removeTrackAnchor(action: CameraAction, index: number, durationSec: number): void {
  const path = trackPath(action)
  if (!path || path.points.length <= 1) return
  path.points.splice(index, 1)
  if (path.points.length > 1) {
    recalcSplineHandle(path, Math.max(0, index - 1))
    recalcSplineHandle(path, Math.min(path.points.length - 1, index))
  }
  reconcileSpeed(action, durationSec)
}

export function reconcileSpeed(action: CameraAction, durationSec: number): void {
  const path = trackPath(action)
  const speed = trackSpeed(action)
  if (!path || !speed) return
  const n = path.points.length
  if (n < 2) {
    action.pathFollow!.speedCurve = undefined
    return
  }
  const arcs = anchorArcLengths(action)
  if (speed.bezt.length === n) {
    speed.bezt.forEach((k, i) => {
      k.vec[1][1] = arcs[i]
    })
    sortFCurve(speed)
    return
  }
  const start = speed.bezt.length ? speed.bezt[0].vec[1][0] / PREVIZ_FPS : 0
  const end = speed.bezt.length
    ? speed.bezt[speed.bezt.length - 1].vec[1][0] / PREVIZ_FPS
    : durationSec
  const total = arcs[arcs.length - 1] || 1
  const times = arcs.map((s) => start + (end - start) * (s / total))
  action.pathFollow!.speedCurve = speedCurveFromTimes(path, times)
}

export function translateTrack(action: CameraAction, dx: number, dz: number): void {
  const path = trackPath(action)
  if (!path) return
  for (const p of path.points) {
    p.co[0] += dx
    p.co[2] += dz
    p.h1[0] += dx
    p.h1[2] += dz
    p.h2[0] += dx
    p.h2[2] += dz
  }
}

export function isTrackStraight(action: CameraAction): boolean {
  const path = trackPath(action)
  return !!path?.points.length && path.points.every((p) => p.h1Type === HandleType.VECTOR)
}

export function scaleTrackTimes(action: CameraAction, ratio: number): void {
  const curves = [...action.fcurves]
  const speed = trackSpeed(action)
  if (speed) curves.push(speed)
  const tilt = action.pathFollow?.tiltCurve
  if (tilt) curves.push(tilt)
  for (const fcu of curves) {
    for (const k of fcu.bezt) {
      k.vec[0][0] *= ratio
      k.vec[1][0] *= ratio
      k.vec[2][0] *= ratio
    }
    sortFCurve(fcu)
  }
}

export function setTrackStraight(action: CameraAction, straight: boolean): void {
  const path = trackPath(action)
  if (!path) return
  const type = straight ? HandleType.VECTOR : HandleType.AUTO
  for (const p of path.points) {
    p.h1Type = type
    p.h2Type = type
  }
  recalcAllSplineHandles(path)
}

export type TrackTimingMode = 'speed' | 'smoothstep' | 'indexed'

export interface TrackSample {
  position: THREE.Vector3
  tangent: THREE.Vector3
  s: number
  active: boolean
  speed: number
}

export function sampleTrack(
  action: CameraAction,
  seconds: number,
  mode: TrackTimingMode,
  durationSec: number,
  table: ArcTable | null = trackArcTable(action)
): TrackSample | null {
  const path = trackPath(action)
  if (!path || !path.points.length) return null
  if (path.points.length === 1 || !table) {
    return {
      position: new THREE.Vector3(...path.points[0].co),
      tangent: new THREE.Vector3(0, 0, 1),
      s: 0,
      active: false,
      speed: 0
    }
  }
  const segments = segmentCount(path)
  let u: number
  let s: number
  let active: boolean
  let speed = 0
  if (mode === 'indexed') {
    const t = smoothstep(seconds / Math.max(0.001, durationSec))
    u = t * segments
    s = uToArcLength(table, u)
    active = t > 0 && t < 1
    speed = active ? table.totalLen / Math.max(0.001, durationSec) : 0
  } else if (mode === 'speed' && trackSpeed(action)) {
    const fcu = trackSpeed(action)!
    const frame = seconds * PREVIZ_FPS
    s = Math.max(0, Math.min(table.totalLen, evaluateFCurve(fcu, frame)))
    u = arcLengthToU(table, s)
    const first = fcu.bezt[0]?.vec[1][0] ?? 0
    const last = fcu.bezt[fcu.bezt.length - 1]?.vec[1][0] ?? 0
    active = frame > first && frame < last
    if (active) {
      const eps = 0.5
      speed =
        Math.abs(evaluateFCurve(fcu, frame + eps) - evaluateFCurve(fcu, frame - eps)) /
        ((2 * eps) / PREVIZ_FPS)
    }
  } else {
    const t = Math.max(0, Math.min(1, seconds / Math.max(0.001, durationSec)))
    const eased = smoothstep(t)
    s = eased * table.totalLen
    u = arcLengthToU(table, s)
    active = t > 0 && t < 1
    const dt = 6 * t * (1 - t)
    speed = (dt * table.totalLen) / Math.max(0.001, durationSec)
  }
  const pos = pathPos(path, u)
  const tan = pathTangent(path, Math.min(u, segments - 1e-6))
  return {
    position: new THREE.Vector3(...pos),
    tangent: new THREE.Vector3(...tan),
    s,
    active,
    speed
  }
}

function channel(action: CameraAction, rnaPath: string, arrayIndex = 0): FCurve | null {
  return (
    action.fcurves.find((f) => f.rnaPath === rnaPath && f.arrayIndex === arrayIndex) ?? null
  )
}

function ensureChannel(action: CameraAction, rnaPath: string, arrayIndex = 0): FCurve {
  let fcu = channel(action, rnaPath, arrayIndex)
  if (!fcu) {
    fcu = makeFCurve(rnaPath, [], { arrayIndex, extend: Extend.CONSTANT })
    action.fcurves.push(fcu)
  }
  return fcu
}

export function setFovKey(action: CameraAction, seconds: number, fovDeg: number): void {
  insertOrReplaceKeyframe(
    ensureChannel(action, 'lens'),
    seconds * PREVIZ_FPS,
    fovToLens(Math.max(10, Math.min(110, fovDeg)))
  )
}

export function sampleFov(action: CameraAction, seconds: number, fallbackDeg: number): number {
  const fcu = channel(action, 'lens')
  if (!fcu || !fcu.bezt.length) return fallbackDeg
  const lens = evaluateFCurve(fcu, seconds * PREVIZ_FPS)
  return lens > 0 && Number.isFinite(lens)
    ? Math.max(10, Math.min(110, lensToFov(lens)))
    : fallbackDeg
}

export function setAimKey(
  action: CameraAction,
  seconds: number,
  yawDeg: number,
  pitchDeg: number
): void {
  const frame = seconds * PREVIZ_FPS
  insertOrReplaceKeyframe(
    ensureChannel(action, 'rotation_euler', 0),
    frame,
    (Math.max(-85, Math.min(85, pitchDeg)) * Math.PI) / 180
  )
  insertOrReplaceKeyframe(ensureChannel(action, 'rotation_euler', 1), frame, (yawDeg * Math.PI) / 180)
}

export function sampleAim(
  action: CameraAction,
  seconds: number,
  fallback: { yawDeg: number; pitchDeg: number }
): { yawDeg: number; pitchDeg: number } {
  const pitch = channel(action, 'rotation_euler', 0)
  const yaw = channel(action, 'rotation_euler', 1)
  const frame = seconds * PREVIZ_FPS
  return {
    yawDeg: yaw && yaw.bezt.length ? (evaluateFCurve(yaw, frame) * 180) / Math.PI : fallback.yawDeg,
    pitchDeg:
      pitch && pitch.bezt.length
        ? Math.max(-85, Math.min(85, (evaluateFCurve(pitch, frame) * 180) / Math.PI))
        : fallback.pitchDeg
  }
}

export function deleteShotKeysAt(action: CameraAction, seconds: number): void {
  const frame = seconds * PREVIZ_FPS
  for (const rna of [
    ['lens', 0],
    ['rotation_euler', 0],
    ['rotation_euler', 1]
  ] as const) {
    const fcu = channel(action, rna[0], rna[1])
    if (!fcu) continue
    const idx = fcu.bezt.findIndex((k) => Math.abs(k.vec[1][0] - frame) < 0.51)
    if (idx >= 0) deleteKeyframe(fcu, idx)
  }
}
