import * as THREE from 'three'
import type { CameraActionJson } from 'dollycurve'

import { makeTrackAction, trackFromJson, trackToJson } from './dollyTrack'
import type {
  PrevizActorData,
  PrevizActorKind,
  PrevizGround,
  PrevizGroundStyle,
  PrevizPose,
  PrevizProjectData,
  PrevizSceneData,
  PrevizShotData,
  PrevizSun,
  PrevizSunQuality,
  PrevizTimeLink,
  PrevizTimingMode
} from './types'
import {
  PREVIZ_ACTOR_KINDS,
  PREVIZ_ASPECTS,
  PREVIZ_CAMERA_HEIGHT_MAX,
  PREVIZ_CAMERA_HEIGHT_MIN,
  PREVIZ_DEFAULT_SUN,
  PREVIZ_GROUND_STYLES,
  PREVIZ_JOINT_KEYS,
  PREVIZ_LOCK_GLOBAL,
  PREVIZ_LOCK_MANUAL,
  PREVIZ_POSES,
  PREVIZ_SHOT_DURATION_MIN,
  PREVIZ_TIME_LINKS,
  PREVIZ_TIMING_MODES,
  PREVIZ_VERSION
} from './types'

function num(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback
}

function pick<T extends string>(v: unknown, allowed: ReadonlySet<string>, fallback: T): T {
  return typeof v === 'string' && allowed.has(v) ? (v as T) : fallback
}

function pair(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null
  const x = Number(value[0])
  const z = Number(value[1])
  return Number.isFinite(x) && Number.isFinite(z) ? [x, z] : null
}

function triple(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length < 3) return null
  const out = [Number(value[0]), Number(value[1]), Number(value[2])]
  return out.every(Number.isFinite) ? (out as [number, number, number]) : null
}

export function clampCameraPointHeight(value: unknown, fallback = PREVIZ_CAMERA_HEIGHT_MIN): number {
  const n = Number(value)
  if (Number.isFinite(n)) {
    return Math.max(PREVIZ_CAMERA_HEIGHT_MIN, Math.min(PREVIZ_CAMERA_HEIGHT_MAX, n))
  }
  const prev = Number(fallback)
  return Number.isFinite(prev) ? prev : PREVIZ_CAMERA_HEIGHT_MIN
}

function normalizeTrackJson(value: unknown): CameraActionJson | null {
  if (!value || typeof value !== 'object') return null
  const action = trackFromJson(value)
  return action ? trackToJson(action) : null
}

export function defaultShotCamera(points: THREE.Vector3[] = [new THREE.Vector3(6, 3, 6)]): CameraActionJson {
  return trackToJson(makeTrackAction(points))
}

export function normalizeActor(value: unknown): PrevizActorData {
  const raw = (value ?? {}) as Record<string, unknown>
  const out: PrevizActorData = {
    kind: pick<PrevizActorKind>(raw.kind, PREVIZ_ACTOR_KINDS, 'prop'),
    label: str(raw.label, ''),
    pose: pick<PrevizPose>(raw.pose, PREVIZ_POSES, 'stand'),
    pos: pair(raw.pos) ?? [0, 0],
    rotY: num(raw.rotY, 0),
    height: num(raw.height, 0),
    scale: Math.max(0.3, Math.min(3, num(raw.scale, 1))),
    timeLink: pick<PrevizTimeLink>(raw.timeLink, PREVIZ_TIME_LINKS, 'independent'),
    timeOffset: num(raw.timeOffset, 0),
    timeLinkShot: Number.isInteger(raw.timeLinkShot) ? (raw.timeLinkShot as number) : 0,
    track: normalizeTrackJson(raw.track)
  }
  if (typeof raw.mount === 'string' && raw.mount) out.mount = raw.mount
  if (raw.joints && typeof raw.joints === 'object') {
    const joints: Record<string, number> = {}
    for (const key of PREVIZ_JOINT_KEYS) {
      const v = (raw.joints as Record<string, unknown>)[key]
      if (Number.isFinite(Number(v))) joints[key] = Number(v)
    }
    out.joints = joints
  }
  return out
}

export function normalizeShot(value: unknown): PrevizShotData {
  const raw = (value ?? {}) as Record<string, unknown>
  return {
    name: str(raw.name, 'Shot'),
    desc: str(raw.desc, ''),
    dur: Math.max(PREVIZ_SHOT_DURATION_MIN, num(raw.dur, 5)),
    lock: str(raw.lock, PREVIZ_LOCK_GLOBAL),
    fov: Math.max(10, Math.min(110, num(raw.fov, 40))),
    timingMode: pick<PrevizTimingMode>(raw.timingMode, PREVIZ_TIMING_MODES, 'arcLength'),
    syncActor: str(raw.syncActor, ''),
    yaw: num(raw.yaw, 0),
    pitch: num(raw.pitch, 0),
    camera: normalizeTrackJson(raw.camera) ?? defaultShotCamera()
  }
}

export function normalizeSun(value: unknown): PrevizSun {
  const raw = (value ?? {}) as Record<string, unknown>
  const p = triple(raw.pos) ?? PREVIZ_DEFAULT_SUN.pos
  return {
    enabled: raw.enabled !== false,
    pos: [
      Math.max(-30, Math.min(30, p[0])),
      Math.max(1, Math.min(30, p[1] || PREVIZ_DEFAULT_SUN.pos[1])),
      Math.max(-30, Math.min(30, p[2]))
    ],
    intensity: Math.max(0, Math.min(3, num(raw.intensity, PREVIZ_DEFAULT_SUN.intensity))),
    temp: Math.max(2500, Math.min(9000, num(raw.temp, PREVIZ_DEFAULT_SUN.temp))),
    ambient: Math.max(0, Math.min(1, num(raw.ambient, PREVIZ_DEFAULT_SUN.ambient))),
    softness: Math.max(0, Math.min(5, num(raw.softness, PREVIZ_DEFAULT_SUN.softness))),
    quality: pick<PrevizSunQuality>(
      raw.quality,
      new Set(['performance', 'standard', 'high']),
      'standard'
    )
  }
}

export function normalizeGround(value: unknown): PrevizGround {
  const raw = (value ?? {}) as Record<string, unknown>
  const style = pick<PrevizGroundStyle>(raw.style, PREVIZ_GROUND_STYLES, 'checker')
  if (style === 'color') {
    const color =
      typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color)
        ? raw.color.toLowerCase()
        : '#707781'
    return { style, color }
  }
  return { style }
}

export function normalizeScene(value: unknown): PrevizSceneData {
  const raw = (value ?? {}) as Record<string, unknown>
  const actors = (Array.isArray(raw.actors) ? raw.actors : [])
    .map(normalizeActor)
    .filter((a) => a.label)
  const seen = new Set<string>()
  const unique = actors.filter((a) => {
    if (seen.has(a.label)) return false
    seen.add(a.label)
    return true
  })
  const byLabel = new Map(unique.map((a) => [a.label, a]))
  for (const a of unique) {
    if (!a.mount) continue
    if (!byLabel.has(a.mount) || a.mount === a.label) {
      delete a.mount
      continue
    }
    const visited = new Set([a.label])
    let next = byLabel.get(a.mount)
    while (next?.mount) {
      if (visited.has(next.label)) {
        delete a.mount
        break
      }
      visited.add(next.label)
      next = byLabel.get(next.mount)
    }
  }
  const shots = (Array.isArray(raw.shots) ? raw.shots : []).map(normalizeShot)
  if (!shots.length) shots.push(normalizeShot(null))
  for (const s of shots) {
    if (s.lock && s.lock !== PREVIZ_LOCK_MANUAL && !byLabel.has(s.lock)) s.lock = PREVIZ_LOCK_GLOBAL
    if (s.syncActor && !byLabel.has(s.syncActor)) s.syncActor = ''
  }
  return {
    name: str(raw.name, 'Scene 1'),
    desc: str(raw.desc, ''),
    actors: unique,
    shots,
    ground: normalizeGround(raw.ground),
    sun: normalizeSun(raw.sun)
  }
}

function starterTrack(points: Array<[number, number]>): CameraActionJson {
  return trackToJson(
    makeTrackAction(points.map((p) => new THREE.Vector3(p[0], 0, p[1])))
  )
}

export function defaultScene(): PrevizSceneData {
  return normalizeScene({
    name: 'Scene 1',
    actors: [
      {
        kind: 'char',
        label: 'A',
        pos: [1.5, 2.5],
        track: starterTrack([[1.5, 2.5], [2.5, 0.5], [3.2, -1.2]])
      },
      { kind: 'char', label: 'B', pos: [3.5, -2], track: starterTrack([[3.5, -2], [2.8, -0.8]]) },
      { kind: 'prop', label: 'Prop', pos: [0, -1] }
    ],
    shots: [
      {
        name: 'Shot 1',
        dur: 5,
        lock: 'A',
        fov: 38,
        camera: defaultShotCamera([new THREE.Vector3(-6, 2.4, 8), new THREE.Vector3(-4.8, 2.2, 6.8)])
      },
      {
        name: 'Shot 2',
        dur: 4,
        lock: 'B',
        fov: 42,
        camera: defaultShotCamera([new THREE.Vector3(0.2, 1.75, 3.2)])
      },
      {
        name: 'Shot 3',
        dur: 4,
        lock: 'A',
        fov: 42,
        camera: defaultShotCamera([new THREE.Vector3(4.8, 1.75, -0.8)])
      }
    ]
  })
}

export function normalizeProject(value: unknown): PrevizProjectData {
  const raw = (value ?? {}) as Record<string, unknown>
  const settings = (raw.settings ?? {}) as Record<string, unknown>
  const scenesRaw = Array.isArray(raw.scenes) ? raw.scenes : []
  const scenes = scenesRaw.length ? scenesRaw.map(normalizeScene) : [defaultScene()]
  const aspect =
    typeof raw.aspect === 'string' && raw.aspect in PREVIZ_ASPECTS ? raw.aspect : '16:9'
  return {
    app: 'ComfyTV.Previz',
    version: PREVIZ_VERSION,
    aspect,
    settings: {
      collision: settings.collision !== false,
      labels: settings.labels !== false
    },
    scenes
  }
}

export function parseProjectJson(json: string): PrevizProjectData {
  try {
    return normalizeProject(JSON.parse(json))
  } catch {
    return normalizeProject(null)
  }
}

export function sceneDuration(scene: PrevizSceneData): number {
  return scene.shots.reduce((sum, s) => sum + s.dur, 0)
}

export function shotStart(scene: PrevizSceneData, shotIdx: number): number {
  return scene.shots.slice(0, shotIdx).reduce((sum, s) => sum + s.dur, 0)
}
