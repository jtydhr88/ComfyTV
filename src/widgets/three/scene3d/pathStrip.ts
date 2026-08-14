import {
  Extend,
  HandleType,
  Interpolation,
  arcLengthToU,
  buildArcTable,
  evaluateFCurve,
  exportCameraActionToJson,
  importCameraActionFromJson,
  insertOrReplaceKeyframe,
  makeCameraAction,
  makeFCurve,
  makePathFollowConstraint,
  makeSplinePath,
  makeSplinePoint,
  pathPos,
  pathTangent,
  recalcAllSplineHandles,
  segmentCount,
  uToArcLength,
  type ArcTable,
  type CameraAction,
  type FCurve,
  type SplinePath,
  type Vec3
} from 'dollycurve'

import type { CharacterPathStrip } from './types'

export const PATH_FPS = 30
const DEFAULT_PATH_SECONDS = 5

export interface ParsedPathStrip {
  action: CameraAction
  path: SplinePath
  table: ArcTable | null
}

export interface PathSample {
  x: number
  y: number
  z: number
  yaw: number
  s: number
  speed: number
  active: boolean
}

function speedCurve(action: CameraAction): FCurve | null {
  return action.pathFollow?.speedCurve ?? null
}

export function rebuildPathTable(parsed: ParsedPathStrip): void {
  parsed.table =
    parsed.path.points.length >= 2 ? buildArcTable(parsed.path) : null
}

export function exportParsedPathJson(
  parsed: ParsedPathStrip
): Record<string, unknown> {
  return exportCameraActionToJson(parsed.action) as unknown as Record<
    string,
    unknown
  >
}

export function parsePathStrip(raw: unknown): ParsedPathStrip | null {
  try {
    const action = importCameraActionFromJson(raw)
    action.fps = PATH_FPS
    const path = action.pathFollow?.splinePath ?? null
    if (!path || !path.points.length) return null
    const table = path.points.length >= 2 ? buildArcTable(path) : null
    return { action, path, table }
  } catch {
    return null
  }
}

export function pathStripDuration(
  strip: CharacterPathStrip,
  parsed: ParsedPathStrip | null,
  fps: number
): number {
  if (strip.range) return (strip.range.end - strip.range.start) / fps
  const fcu = parsed ? speedCurve(parsed.action) : null
  const lastKey = fcu?.bezt[fcu.bezt.length - 1]?.vec[1][0]
  if (typeof lastKey === 'number' && lastKey > 0) {
    return lastKey / (parsed?.action.fps || PATH_FPS)
  }
  return DEFAULT_PATH_SECONDS
}

function smoothstep(t: number): number {
  t = Math.max(0, Math.min(1, t))
  return t * t * (3 - 2 * t)
}

export function samplePathStrip(
  parsed: ParsedPathStrip,
  localSeconds: number,
  durationSec: number
): PathSample {
  const { action, path, table } = parsed
  if (!table) {
    const [x, y, z] = path.points[0].co
    return { x, y, z, yaw: 0, s: 0, speed: 0, active: false }
  }
  const segments = segmentCount(path)
  let s: number
  let u: number
  let active: boolean
  let speed = 0
  const fcu = speedCurve(action)
  if (fcu && fcu.bezt.length >= 2) {
    const frame = localSeconds * action.fps
    s = Math.max(0, Math.min(table.totalLen, evaluateFCurve(fcu, frame)))
    u = arcLengthToU(table, s)
    const first = fcu.bezt[0]?.vec[1][0] ?? 0
    const last = fcu.bezt[fcu.bezt.length - 1]?.vec[1][0] ?? 0
    active = frame > first && frame < last
    if (active) {
      const eps = 0.5
      speed =
        Math.abs(
          evaluateFCurve(fcu, frame + eps) - evaluateFCurve(fcu, frame - eps)
        ) /
        ((2 * eps) / action.fps)
    }
  } else {
    const t = Math.max(0, Math.min(1, localSeconds / Math.max(0.001, durationSec)))
    const eased = smoothstep(t)
    s = eased * table.totalLen
    u = arcLengthToU(table, s)
    active = t > 0 && t < 1
    const dt = 6 * t * (1 - t)
    speed = (dt * table.totalLen) / Math.max(0.001, durationSec)
  }
  const [x, y, z] = pathPos(path, u)
  const tan = pathTangent(path, Math.min(u, segments - 1e-6))
  const yaw =
    Math.hypot(tan[0], tan[2]) > 1e-4 ? Math.atan2(tan[0], tan[2]) : 0
  return { x, y, z, yaw, s, speed, active }
}

export function samplePathPoints(
  parsed: ParsedPathStrip,
  samples = 64
): Array<[number, number, number]> {
  const { path } = parsed
  if (path.points.length < 2) {
    return path.points.map((p) => [p.co[0], p.co[1], p.co[2]])
  }
  const segments = segmentCount(path)
  const points: Array<[number, number, number]> = []
  for (let i = 0; i <= samples; i++) {
    const u = (i / samples) * segments
    const [x, y, z] = pathPos(path, Math.min(u, segments - 1e-6))
    points.push([x, y, z])
  }
  return points
}

function anchorTangent(
  points: ReadonlyArray<readonly [number, number, number]>,
  i: number
): Vec3 {
  const prev = points[Math.max(0, i - 1)]
  const next = points[Math.min(points.length - 1, i + 1)]
  const tan: Vec3 = [next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]]
  const len = Math.hypot(tan[0], tan[1], tan[2])
  if (len < 1e-4) return [1, 0, 0]
  return [tan[0] / len, tan[1] / len, tan[2] / len]
}

export function buildPathActionJson(
  points: ReadonlyArray<readonly [number, number, number]>,
  timesSec?: readonly number[],
  straight = false
): Record<string, unknown> {
  const splinePoints = points.map((p, i) => {
    const neighbor =
      points[Math.min(points.length - 1, i + 1)] ?? points[Math.max(0, i - 1)]
    const gap =
      points.length > 1
        ? Math.max(
            0.2,
            Math.hypot(p[0] - neighbor[0], p[1] - neighbor[1], p[2] - neighbor[2]) / 3
          )
        : 1
    const sp = makeSplinePoint([p[0], p[1], p[2]], anchorTangent(points, i), gap)
    if (straight) {
      sp.h1Type = HandleType.VECTOR
      sp.h2Type = HandleType.VECTOR
    }
    return sp
  })
  const path = makeSplinePath(splinePoints)
  recalcAllSplineHandles(path)
  const action = makeCameraAction([], PATH_FPS)
  let curve: FCurve | undefined
  if (timesSec && timesSec.length === points.length && points.length >= 2) {
    const table = buildArcTable(path)
    curve = makeFCurve('scene3d_path_speed', [], { extend: Extend.CONSTANT })
    timesSec.forEach((t, i) => {
      insertOrReplaceKeyframe(curve!, t * PATH_FPS, uToArcLength(table, i), {
        ipo: Interpolation.BEZIER
      })
    })
  }
  action.pathFollow = makePathFollowConstraint(path, {
    orientation: 'free',
    upAxis: 'Y',
    arcLengthUniform: true,
    ...(curve ? { speedCurve: curve } : {})
  })
  return exportCameraActionToJson(action) as unknown as Record<string, unknown>
}
