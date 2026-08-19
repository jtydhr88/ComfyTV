import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three'

import type {
  Scene3DState,
  SceneCameraEntry,
  SceneLightType,
  PrimitiveShape
} from './types'
import {
  cloneScene,
  createDefaultCamera,
  createDefaultCharacter,
  createDefaultLight,
  createDefaultModel,
  createDefaultPrimitive,
  createDefaultShot
} from './types'
import { buildPathActionJson } from './pathStrip'

export interface SceneOpsContext {
  resolveModel: (assetId?: number, url?: string) =>
    { url: string; name: string } | null
  resolvePresetFile: (presetId: string) => string | null
  editorPose?: () =>
    | { position: { x: number; y: number; z: number }
        quaternion: { x: number; y: number; z: number; w: number }
        fov: number }
    | undefined
}

export interface SceneOpResult {
  op: string
  id?: string
  [key: string]: unknown
}

const PRIMITIVE_SHAPES: readonly PrimitiveShape[] =
  ['cube', 'sphere', 'cylinder', 'plane']
const LIGHT_TYPES: readonly SceneLightType[] = ['directional', 'point', 'spot']

const OPS = [
  'add_primitive', 'add_model', 'add_character', 'add_light', 'add_camera',
  'set_transform', 'set_color', 'patch_light', 'set_animation',
  'rename', 'set_hidden', 'remove',
  'set_environment', 'set_output',
  'bind_camera_preset', 'set_camera_tuning', 'set_camera_fov',
  'add_shot', 'patch_shot', 'move_shot', 'add_prompt', 'patch_prompt',
  'set_path',
] as const

type Vec3Like = { x: number; y: number; z: number } | [number, number, number]

function vec3(value: Vec3Like | undefined, fallback: { x: number; y: number; z: number }) {
  if (Array.isArray(value) && value.length === 3) {
    return { x: Number(value[0]), y: Number(value[1]), z: Number(value[2]) }
  }
  if (value && typeof value === 'object' && 'x' in value) {
    return { x: Number(value.x), y: Number(value.y), z: Number(value.z) }
  }
  return fallback
}

function quatFrom(op: any, current: { x: number; y: number; z: number; w: number },
                  position: { x: number; y: number; z: number }) {
  if (op.look_at != null) {
    const target = vec3(op.look_at, { x: 0, y: 0, z: 0 })
    const m = new Matrix4().lookAt(
      new Vector3(position.x, position.y, position.z),
      new Vector3(target.x, target.y, target.z),
      new Vector3(0, 1, 0)
    )
    const q = new Quaternion().setFromRotationMatrix(m)
    return { x: q.x, y: q.y, z: q.z, w: q.w }
  }
  if (op.rotation_deg != null) {
    const r = vec3(op.rotation_deg, { x: 0, y: 0, z: 0 })
    const q = new Quaternion().setFromEuler(new Euler(
      MathUtils.degToRad(r.x), MathUtils.degToRad(r.y), MathUtils.degToRad(r.z)))
    return { x: q.x, y: q.y, z: q.z, w: q.w }
  }
  if (op.quaternion != null) {
    const q = op.quaternion
    if (Array.isArray(q) && q.length === 4) {
      return { x: Number(q[0]), y: Number(q[1]), z: Number(q[2]), w: Number(q[3]) }
    }
    return { x: Number(q.x), y: Number(q.y), z: Number(q.z), w: Number(q.w) }
  }
  return current
}

function allIds(scene: Scene3DState): string[] {
  return [
    ...scene.characters, ...scene.primitives, ...scene.models,
    ...scene.lights, ...scene.cameras, ...scene.shots, ...scene.promptTrack,
  ].map((entry) => entry.id)
}

function findEntry(scene: Scene3DState, id: string) {
  const keys = [
    'characters', 'primitives', 'models', 'lights', 'cameras',
    'shots', 'promptTrack',
  ] as const
  for (const key of keys) {
    const list = scene[key] as Array<{ id: string }>
    const index = list.findIndex((entry) => entry.id === id)
    if (index >= 0) return { key, list, index, entry: list[index] as any }
  }
  return null
}

function requireShot(scene: Scene3DState, id: unknown, where: string) {
  const shotId = String(id ?? '')
  const index = scene.shots.findIndex((shot) => shot.id === shotId)
  if (index < 0) {
    throw new Error(
      `${where}: no shot '${id}'; shots: ${scene.shots.map((s) => s.id).join(', ') || '(none)'}`)
  }
  return { index, shot: scene.shots[index] }
}

function requireShotCamera(scene: Scene3DState, cameraId: unknown, where: string): string {
  const id = String(cameraId ?? '')
  if (!id || !scene.cameras.some((camera) => camera.id === id)) {
    throw new Error(`${where}: no camera '${cameraId}'; `
      + `cameras: ${scene.cameras.map((c) => c.id).join(', ') || '(none)'}`)
  }
  return id
}

function shotLockFrom(scene: Scene3DState, lock: unknown, where: string): string {
  const id = String(lock ?? '')
  if (!id) return ''
  if (!scene.characters.some((character) => character.id === id)) {
    throw new Error(`${where}: lock must be a character id; `
      + `characters: ${scene.characters.map((c) => c.id).join(', ') || '(none)'}`)
  }
  return id
}

function clampFrames(value: unknown, fallback: number): number {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(10000, Math.max(1, Math.round(num)))
}

function requireEntry(scene: Scene3DState, id: unknown, where: string) {
  const found = findEntry(scene, String(id ?? ''))
  if (!found) {
    throw new Error(
      `${where}: no object '${id}' in the scene; ids: ${allIds(scene).join(', ') || '(empty)'}`)
  }
  return found
}

function applyTransformOp(entry: any, op: any): void {
  const t = entry.transform
  if (op.position != null) t.position = vec3(op.position, t.position)
  t.quaternion = quatFrom(op, t.quaternion, t.position)
  if (op.scale != null && t.scale) {
    if (typeof op.scale === 'number') {
      t.scale = { x: op.scale, y: op.scale, z: op.scale }
    } else {
      t.scale = vec3(op.scale, t.scale)
    }
  }
}

export function applySceneOps(
  scene: Scene3DState,
  ops: any[],
  ctx: SceneOpsContext
): { next: Scene3DState; results: SceneOpResult[] } {
  if (!Array.isArray(ops) || ops.length === 0) {
    throw new Error('ops must be a non-empty array')
  }
  const next = cloneScene(scene)
  const results: SceneOpResult[] = []

  ops.forEach((op, i) => {
    const where = `ops[${i}] (${op?.op})`
    switch (op?.op) {
      case 'add_primitive': {
        if (!PRIMITIVE_SHAPES.includes(op.shape)) {
          throw new Error(`${where}: shape must be one of ${PRIMITIVE_SHAPES.join(', ')}`)
        }
        const entry = createDefaultPrimitive(op.shape, allIds(next))
        if (typeof op.color === 'string') entry.color = op.color
        if (typeof op.name === 'string') entry.name = op.name
        applyTransformOp(entry, op)
        next.primitives.push(entry)
        results.push({ op: op.op, id: entry.id })
        break
      }
      case 'add_model': {
        const resolved = ctx.resolveModel(
          op.asset_id != null ? Number(op.asset_id) : undefined,
          typeof op.url === 'string' ? op.url : undefined)
        if (!resolved) {
          throw new Error(
            `${where}: pass asset_id (a model asset from the assets tool) or url; `
            + `asset ${op.asset_id ?? op.url ?? '(none)'} did not resolve to a loadable `
            + `3D model (mesh, gaussian splat or point cloud)`)
        }
        const entry = createDefaultModel(
          resolved.url, String(op.name ?? resolved.name), allIds(next))
        applyTransformOp(entry, op)
        next.models.push(entry)
        results.push({ op: op.op, id: entry.id })
        break
      }
      case 'add_character': {
        if (typeof op.model !== 'string' || !op.model) {
          throw new Error(`${where}: model is required (a character id from scene_get resources)`)
        }
        const entry = createDefaultCharacter(op.model, allIds(next))
        if (typeof op.name === 'string') entry.name = op.name
        if (op.animation && typeof op.animation === 'object') {
          entry.animation = { ...entry.animation, ...op.animation }
        }
        applyTransformOp(entry, op)
        next.characters.push(entry)
        results.push({ op: op.op, id: entry.id })
        break
      }
      case 'add_light': {
        if (!LIGHT_TYPES.includes(op.type)) {
          throw new Error(`${where}: type must be one of ${LIGHT_TYPES.join(', ')}`)
        }
        const entry = createDefaultLight(op.type, allIds(next))
        if (typeof op.color === 'string') entry.color = op.color
        if (Number.isFinite(op.intensity)) entry.intensity = Number(op.intensity)
        if (op.position != null) entry.position = vec3(op.position, entry.position)
        if (op.target != null && entry.target) entry.target = vec3(op.target, entry.target)
        if (Number.isFinite(op.range) && 'range' in entry) entry.range = Number(op.range)
        if (Number.isFinite(op.inner_cone_angle) && 'innerConeAngle' in entry) {
          entry.innerConeAngle = Number(op.inner_cone_angle)
        }
        if (Number.isFinite(op.outer_cone_angle) && 'outerConeAngle' in entry) {
          entry.outerConeAngle = Number(op.outer_cone_angle)
        }
        next.lights.push(entry)
        results.push({ op: op.op, id: entry.id })
        break
      }
      case 'add_camera': {
        const pose = op.position == null && op.look_at == null && op.quaternion == null
          && op.rotation_deg == null
          ? ctx.editorPose?.()
          : undefined
        const entry: SceneCameraEntry = createDefaultCamera(allIds(next), pose)
        if (Number.isFinite(op.fov)) entry.fov = Number(op.fov)
        if (op.position != null) {
          entry.transform.position = vec3(op.position, entry.transform.position)
        }
        entry.transform.quaternion = quatFrom(
          op, entry.transform.quaternion, entry.transform.position)
        if (typeof op.name === 'string') entry.name = op.name
        next.cameras.push(entry)
        if (!next.output.cameraId || op.output === true) next.output.cameraId = entry.id
        results.push({ op: op.op, id: entry.id })
        break
      }
      case 'set_transform': {
        const found = requireEntry(next, op.id, where)
        if (!found.entry.transform) {
          throw new Error(`${where}: '${op.id}' has no transform`)
        }
        applyTransformOp(found.entry, op)
        results.push({ op: op.op, id: found.entry.id })
        break
      }
      case 'set_color': {
        const found = requireEntry(next, op.id, where)
        if (found.key === 'lights') {
          throw new Error(`${where}: use patch_light for lights`)
        }
        if (found.key === 'characters') {
          const color = String(op.color ?? '')
          if (color) found.entry.color = color
          else delete found.entry.color
          results.push({ op: op.op, id: found.entry.id })
          break
        }
        if (!('color' in found.entry)) {
          throw new Error(`${where}: '${op.id}' has no color`)
        }
        found.entry.color = String(op.color ?? found.entry.color)
        results.push({ op: op.op, id: found.entry.id })
        break
      }
      case 'patch_light': {
        const found = requireEntry(next, op.id, where)
        if (found.key !== 'lights') {
          throw new Error(`${where}: '${op.id}' is not a light`)
        }
        const light = found.entry
        if (typeof op.color === 'string') light.color = op.color
        if (Number.isFinite(op.intensity)) light.intensity = Number(op.intensity)
        if (op.position != null) light.position = vec3(op.position, light.position)
        if (op.target != null && light.target) light.target = vec3(op.target, light.target)
        if (Number.isFinite(op.range) && 'range' in light) light.range = Number(op.range)
        if (Number.isFinite(op.inner_cone_angle) && 'innerConeAngle' in light) {
          light.innerConeAngle = Number(op.inner_cone_angle)
        }
        if (Number.isFinite(op.outer_cone_angle) && 'outerConeAngle' in light) {
          light.outerConeAngle = Number(op.outer_cone_angle)
        }
        results.push({ op: op.op, id: light.id })
        break
      }
      case 'set_animation': {
        const found = requireEntry(next, op.id, where)
        if (found.key !== 'characters' && found.key !== 'models') {
          throw new Error(`${where}: '${op.id}' has no animation (characters/models only)`)
        }
        const patch: Record<string, unknown> = {}
        if (typeof op.clip === 'string') patch.clip = op.clip
        if (Number.isFinite(op.speed)) patch.speed = Number(op.speed)
        if (typeof op.loop === 'boolean') patch.loop = op.loop
        if (Number.isFinite(op.start_offset)) patch.startOffset = Number(op.start_offset)
        found.entry.animation = { ...found.entry.animation, ...patch }
        results.push({ op: op.op, id: found.entry.id })
        break
      }
      case 'rename': {
        const found = requireEntry(next, op.id, where)
        found.entry.name = String(op.name ?? '')
        results.push({ op: op.op, id: found.entry.id })
        break
      }
      case 'set_hidden': {
        const found = requireEntry(next, op.id, where)
        if (found.key === 'shots' || found.key === 'promptTrack') {
          throw new Error(`${where}: '${op.id}' cannot be hidden`)
        }
        found.entry.hidden = op.hidden !== false
        results.push({ op: op.op, id: found.entry.id })
        break
      }
      case 'remove': {
        const found = requireEntry(next, op.id, where)
        found.list.splice(found.index, 1)
        if (found.key === 'cameras') {
          if (next.output.cameraId === op.id) {
            next.output.cameraId = next.cameras[0]?.id ?? ''
          }
          for (const shot of next.shots) {
            if (shot.cameraId === op.id) shot.cameraId = ''
          }
        }
        if (found.key === 'characters') {
          for (const shot of next.shots) {
            if (shot.lock === op.id) delete shot.lock
          }
        }
        results.push({ op: op.op, id: String(op.id) })
        break
      }
      case 'add_shot': {
        const cameraId = requireShotCamera(next, op.camera_id, where)
        const entry = createDefaultShot(cameraId, allIds(next))
        entry.durFrames = clampFrames(op.dur_frames, entry.durFrames)
        if (typeof op.name === 'string') entry.name = op.name
        const lock = shotLockFrom(next, op.lock, where)
        if (lock) entry.lock = lock
        const index = Number.isFinite(op.index)
          ? Math.min(next.shots.length, Math.max(0, Math.round(Number(op.index))))
          : next.shots.length
        next.shots.splice(index, 0, entry)
        results.push({ op: op.op, id: entry.id, index })
        break
      }
      case 'patch_shot': {
        const { shot } = requireShot(next, op.id, where)
        if (op.camera_id != null) {
          shot.cameraId = requireShotCamera(next, op.camera_id, where)
        }
        if (op.dur_frames != null) {
          shot.durFrames = clampFrames(op.dur_frames, shot.durFrames)
        }
        if (typeof op.name === 'string') shot.name = op.name
        if (op.lock != null) {
          const lock = shotLockFrom(next, op.lock, where)
          if (lock) shot.lock = lock
          else delete shot.lock
        }
        results.push({ op: op.op, id: shot.id })
        break
      }
      case 'move_shot': {
        const { index, shot } = requireShot(next, op.id, where)
        if (!Number.isFinite(op.index)) {
          throw new Error(`${where}: index is required`)
        }
        const target = Math.min(
          next.shots.length - 1,
          Math.max(0, Math.round(Number(op.index)))
        )
        next.shots.splice(index, 1)
        next.shots.splice(target, 0, shot)
        results.push({ op: op.op, id: shot.id, index: target })
        break
      }
      case 'add_prompt': {
        const start = Math.max(0, Math.round(Number(op.start ?? 0)))
        const end = Math.round(Number(op.end ?? 0))
        if (!Number.isFinite(end) || end <= start) {
          throw new Error(`${where}: end must be a frame greater than start`)
        }
        const taken = new Set(allIds(next))
        let suffix = 1
        while (taken.has(`prompt_${suffix}`)) suffix += 1
        const entry = {
          id: `prompt_${suffix}`,
          range: { start, end: Math.min(10000, end) },
          text: String(op.text ?? '')
        }
        next.promptTrack.push(entry)
        results.push({ op: op.op, id: entry.id })
        break
      }
      case 'patch_prompt': {
        const strip = next.promptTrack.find((entry) => entry.id === String(op.id ?? ''))
        if (!strip) {
          throw new Error(`${where}: no prompt strip '${op.id}'; `
            + `strips: ${next.promptTrack.map((s) => s.id).join(', ') || '(none)'}`)
        }
        if (op.start != null) strip.range.start = Math.max(0, Math.round(Number(op.start)))
        if (op.end != null) strip.range.end = Math.min(10000, Math.round(Number(op.end)))
        if (strip.range.end <= strip.range.start) {
          throw new Error(`${where}: range end must be greater than start`)
        }
        if (typeof op.text === 'string') strip.text = op.text
        results.push({ op: op.op, id: strip.id })
        break
      }
      case 'set_path': {
        const found = requireEntry(next, op.id, where)
        if (found.key !== 'characters') {
          throw new Error(`${where}: '${op.id}' is not a character`)
        }
        if (op.clear === true) {
          delete found.entry.path
          results.push({ op: op.op, id: found.entry.id, path: null })
          break
        }
        if (!Array.isArray(op.points) || op.points.length < 2) {
          throw new Error(`${where}: points must be >= 2 waypoints, each [x,z] or [x,y,z]`)
        }
        const points = op.points.map((p: unknown, pi: number): [number, number, number] => {
          if (!Array.isArray(p) || p.length < 2 || p.length > 3) {
            throw new Error(`${where}: points[${pi}] must be [x,z] or [x,y,z]`)
          }
          const nums = p.map(Number)
          if (nums.some((n: number) => !Number.isFinite(n))) {
            throw new Error(`${where}: points[${pi}] has a non-finite coordinate`)
          }
          return p.length === 2 ? [nums[0], 0, nums[1]] : [nums[0], nums[1], nums[2]]
        })
        const times = Array.isArray(op.times_sec)
          ? op.times_sec.map(Number)
          : undefined
        if (times && (times.length !== points.length || times.some((t: number) => !Number.isFinite(t)))) {
          throw new Error(`${where}: times_sec must match points length with finite seconds`)
        }
        const path: Record<string, unknown> = {
          action: buildPathActionJson(points, times, op.straight === true)
        }
        if (op.range && typeof op.range === 'object') {
          const start = Math.max(0, Math.round(Number(op.range.start ?? 0)))
          const end = Math.round(Number(op.range.end ?? 0))
          if (Number.isFinite(end) && end > start) {
            path.range = { start, end: Math.min(10000, end) }
          }
        }
        const sync = Number(op.sync_speed)
        if (Number.isFinite(sync) && sync > 0) {
          path.syncSpeed = Math.min(10, Math.max(0.1, sync))
        }
        found.entry.path = path
        results.push({ op: op.op, id: found.entry.id })
        break
      }
      case 'set_environment': {
        if (typeof op.show_grid === 'boolean') next.environment.showGrid = op.show_grid
        if (typeof op.background === 'string') next.environment.background = op.background
        if (typeof op.show_room === 'boolean') next.environment.showRoom = op.show_room
        if (typeof op.floor_only === 'boolean') {
          if (op.floor_only) next.environment.floorOnly = true
          else delete next.environment.floorOnly
        }
        results.push({ op: op.op })
        break
      }
      case 'set_output': {
        if (Number.isFinite(op.fps)) next.output.fps = Number(op.fps)
        if (Number.isFinite(op.frame_count)) next.output.frameCount = Number(op.frame_count)
        if (typeof op.camera_id === 'string') {
          if (op.camera_id && !next.cameras.some((c) => c.id === op.camera_id)) {
            throw new Error(`${where}: no camera '${op.camera_id}'; `
              + `cameras: ${next.cameras.map((c) => c.id).join(', ') || '(none)'}`)
          }
          next.output.cameraId = op.camera_id
        }
        results.push({ op: op.op })
        break
      }
      case 'bind_camera_preset': {
        const found = requireEntry(next, op.id, where)
        if (found.key !== 'cameras') throw new Error(`${where}: '${op.id}' is not a camera`)
        if (op.preset_id == null || op.preset_id === '') {
          found.entry.preset = null
          results.push({ op: op.op, id: found.entry.id, preset: null })
          break
        }
        const file = ctx.resolvePresetFile(String(op.preset_id))
        if (!file) {
          throw new Error(
            `${where}: unknown camera preset '${op.preset_id}' — see scene_get resources.camera_presets`)
        }
        found.entry.preset = {
          presetId: String(op.preset_id), file,
          tuning: {}, speed: Number.isFinite(op.speed) ? Number(op.speed) : 1,
        }
        results.push({ op: op.op, id: found.entry.id, preset: String(op.preset_id) })
        break
      }
      case 'set_camera_tuning': {
        const found = requireEntry(next, op.id, where)
        if (found.key !== 'cameras' || !found.entry.preset) {
          throw new Error(`${where}: '${op.id}' is not a camera with a bound preset`)
        }
        const tuning: Record<string, unknown> = { ...found.entry.preset.tuning }
        if (typeof op.reverse === 'boolean') tuning.reverse = op.reverse
        if (op.position_offset != null) {
          tuning.positionOffset = vec3(op.position_offset, { x: 0, y: 0, z: 0 })
        }
        if (Number.isFinite(op.path_scale)) tuning.pathScale = Number(op.path_scale)
        if (Number.isFinite(op.yaw_degrees)) tuning.yawDegrees = Number(op.yaw_degrees)
        if (Number.isFinite(op.roll_degrees)) tuning.rollDegrees = Number(op.roll_degrees)
        if (Number.isFinite(op.fov_scale)) tuning.fovScale = Number(op.fov_scale)
        found.entry.preset.tuning = tuning
        if (Number.isFinite(op.speed)) found.entry.preset.speed = Number(op.speed)
        results.push({ op: op.op, id: found.entry.id })
        break
      }
      case 'set_camera_fov': {
        const found = requireEntry(next, op.id, where)
        if (found.key !== 'cameras') throw new Error(`${where}: '${op.id}' is not a camera`)
        if (!Number.isFinite(op.fov)) throw new Error(`${where}: fov must be a number`)
        found.entry.fov = Math.min(Math.max(Number(op.fov), 10), 140)
        results.push({ op: op.op, id: found.entry.id })
        break
      }
      default:
        throw new Error(
          `ops[${i}]: unknown op '${op?.op}'; valid ops: ${OPS.join(', ')}`)
    }
  })

  return { next, results }
}
