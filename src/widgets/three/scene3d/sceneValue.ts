import type { CameraPresetTuning } from '@/widgets/three/load3d/interfaces'

import type {
  CharacterAnimationConfig,
  CharacterTransform,
  PrimitiveShape,
  Quat,
  Scene3DCameraConfig,
  Scene3DState,
  SceneCameraEntry,
  SceneCharacterEntry,
  SceneEnvironmentConfig,
  SceneLightEntry,
  SceneModelEntry,
  SceneLightType,
  ScenePrimitiveEntry,
  Vec3
} from './types'
import { LIGHT_TYPES, PRIMITIVE_SHAPES, createEmptyScene } from './types'

function toFinite(value: unknown, fallback: number): number {
  const num = typeof value === 'string' ? Number(value) : value
  return typeof num === 'number' && Number.isFinite(num) ? num : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function toVec3(value: unknown, fallback: number): Vec3 {
  const source = (value ?? {}) as Record<string, unknown>
  return {
    x: toFinite(source.x, fallback),
    y: toFinite(source.y, fallback),
    z: toFinite(source.z, fallback)
  }
}

function toUnitQuat(value: unknown): Quat {
  const source = (value ?? {}) as Record<string, unknown>
  const q = {
    x: toFinite(source.x, 0),
    y: toFinite(source.y, 0),
    z: toFinite(source.z, 0),
    w: toFinite(source.w, 1)
  }
  const norm = Math.hypot(q.x, q.y, q.z, q.w)
  if (norm < 1e-6) return { x: 0, y: 0, z: 0, w: 1 }
  return { x: q.x / norm, y: q.y / norm, z: q.z / norm, w: q.w / norm }
}

function toAnimation(value: unknown): CharacterAnimationConfig {
  const source = (value ?? {}) as Record<string, unknown>
  return {
    clip: typeof source.clip === 'string' ? source.clip : '',
    speed: clamp(toFinite(source.speed, 1), 0.01, 100),
    loop: source.loop === undefined ? true : Boolean(source.loop),
    startOffset: toFinite(source.startOffset, 0)
  }
}

function toTransform(value: unknown): CharacterTransform {
  const source = (value ?? {}) as Record<string, unknown>
  const scale = toVec3(source.scale, 1)
  return {
    position: toVec3(source.position, 0),
    quaternion: toUnitQuat(source.quaternion),
    scale: {
      x: clamp(scale.x, 0.001, 1000),
      y: clamp(scale.y, 0.001, 1000),
      z: clamp(scale.z, 0.001, 1000)
    }
  }
}

function labelFields(source: Record<string, unknown>): {
  name?: string
  hidden?: boolean
} {
  const name =
    typeof source.name === 'string' && source.name !== ''
      ? source.name
      : undefined
  return {
    ...(name ? { name } : {}),
    ...(source.hidden ? { hidden: true } : {})
  }
}

function claimId(
  source: Record<string, unknown>,
  prefix: string,
  index: number,
  takenIds: Set<string>
): string {
  let id = typeof source.id === 'string' && source.id !== '' ? source.id : ''
  if (!id || takenIds.has(id)) {
    let suffix = index + 1
    while (takenIds.has(`${prefix}_${suffix}`)) suffix += 1
    id = `${prefix}_${suffix}`
  }
  takenIds.add(id)
  return id
}

function toCharacter(
  value: unknown,
  index: number,
  takenIds: Set<string>
): SceneCharacterEntry | null {
  if (typeof value !== 'object' || value === null) return null
  const source = value as Record<string, unknown>
  if (typeof source.model !== 'string' || source.model === '') return null
  return {
    id: claimId(source, 'char', index, takenIds),
    model: source.model,
    ...labelFields(source),
    animation: toAnimation(source.animation),
    transform: toTransform(source.transform)
  }
}

function toModelEntry(
  value: unknown,
  index: number,
  takenIds: Set<string>
): SceneModelEntry | null {
  if (typeof value !== 'object' || value === null) return null
  const source = value as Record<string, unknown>
  if (typeof source.url !== 'string' || !source.url.startsWith('/')) {
    return null
  }
  return {
    id: claimId(source, 'model', index, takenIds),
    url: source.url,
    name: typeof source.name === 'string' ? source.name : '',
    ...(source.hidden ? { hidden: true } : {}),
    animation: toAnimation(source.animation),
    transform: toTransform(source.transform)
  }
}

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

function toPrimitive(
  value: unknown,
  index: number,
  takenIds: Set<string>
): ScenePrimitiveEntry | null {
  if (typeof value !== 'object' || value === null) return null
  const source = value as Record<string, unknown>
  if (!PRIMITIVE_SHAPES.includes(source.shape as PrimitiveShape)) return null
  const color =
    typeof source.color === 'string' && COLOR_PATTERN.test(source.color)
      ? source.color
      : '#9aa0a6'
  return {
    id: claimId(source, 'prim', index, takenIds),
    shape: source.shape as PrimitiveShape,
    color,
    ...labelFields(source),
    transform: toTransform(source.transform)
  }
}

function toLight(
  value: unknown,
  index: number,
  takenIds: Set<string>
): SceneLightEntry | null {
  if (typeof value !== 'object' || value === null) return null
  const source = value as Record<string, unknown>
  if (!LIGHT_TYPES.includes(source.type as SceneLightType)) return null
  const type = source.type as SceneLightType
  const light: SceneLightEntry = {
    id: claimId(source, 'light', index, takenIds),
    type,
    ...labelFields(source),
    color:
      typeof source.color === 'string' && COLOR_PATTERN.test(source.color)
        ? source.color
        : '#ffffff',
    intensity: Math.max(toFinite(source.intensity, 1), 0),
    position: toVec3(source.position, 0)
  }
  if (type !== 'point') {
    light.target = toVec3(source.target, 0)
  }
  if (type !== 'directional') {
    light.range = Math.max(toFinite(source.range, 0), 0)
  }
  if (type === 'spot') {
    light.innerConeAngle = clamp(toFinite(source.innerConeAngle, 30), 0, 89)
    light.outerConeAngle = clamp(
      toFinite(source.outerConeAngle, 45),
      light.innerConeAngle,
      90
    )
  }
  return light
}

const TUNING_DEFAULTS = {
  fovScale: 1,
  yawDegrees: 0,
  pathScale: 1,
  rollDegrees: 0
} as const

function toTuning(value: unknown): CameraPresetTuning {
  const source = (value ?? {}) as Record<string, unknown>
  const tuning: CameraPresetTuning = {
    reverse: Boolean(source.reverse),
    positionOffset: toVec3(source.positionOffset, 0)
  }
  for (const key of Object.keys(TUNING_DEFAULTS) as Array<
    keyof typeof TUNING_DEFAULTS
  >) {
    tuning[key] = toFinite(source[key], TUNING_DEFAULTS[key])
  }
  return tuning
}

function toEnvironment(value: unknown): SceneEnvironmentConfig {
  const source = (value ?? {}) as Record<string, unknown>
  return {
    showGrid: source.showGrid === undefined ? true : Boolean(source.showGrid),
    background:
      typeof source.background === 'string' &&
      COLOR_PATTERN.test(source.background)
        ? source.background
        : '',
    showRoom: Boolean(source.showRoom)
  }
}

function toCameraConfig(value: unknown): Scene3DCameraConfig | null {
  if (typeof value !== 'object' || value === null) return null
  const source = value as Record<string, unknown>
  const file = typeof source.file === 'string' ? source.file : ''
  if (file === '' || file.includes('..')) return null
  return {
    presetId: typeof source.presetId === 'string' ? source.presetId : '',
    file,
    tuning: toTuning(source.tuning),
    speed: clamp(toFinite(source.speed, 1), 0.1, 10)
  }
}

function toSceneCamera(
  value: unknown,
  index: number,
  takenIds: Set<string>
): SceneCameraEntry | null {
  if (typeof value !== 'object' || value === null) return null
  const source = value as Record<string, unknown>
  const transform = (source.transform ?? {}) as Record<string, unknown>
  return {
    id: claimId(source, 'cam', index, takenIds),
    ...labelFields(source),
    fov: clamp(toFinite(source.fov, 50), 10, 140),
    transform: {
      position: toVec3(transform.position, 0),
      quaternion: toUnitQuat(transform.quaternion)
    },
    preset: toCameraConfig(source.preset)
  }
}

export function normalizeSceneValue(value: unknown): Scene3DState {
  let source = value
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source)
    } catch {
      return createEmptyScene()
    }
  }
  if (typeof source !== 'object' || source === null) {
    return createEmptyScene()
  }
  const record = source as Record<string, unknown>

  const takenIds = new Set<string>()
  const characters = (
    Array.isArray(record.characters) ? record.characters : []
  ).flatMap((entry, index) => {
    const character = toCharacter(entry, index, takenIds)
    return character ? [character] : []
  })
  const primitives = (
    Array.isArray(record.primitives) ? record.primitives : []
  ).flatMap((entry, index) => {
    const primitive = toPrimitive(entry, index, takenIds)
    return primitive ? [primitive] : []
  })
  const models = (Array.isArray(record.models) ? record.models : []).flatMap(
    (entry, index) => {
      const model = toModelEntry(entry, index, takenIds)
      return model ? [model] : []
    }
  )
  const lights = (Array.isArray(record.lights) ? record.lights : []).flatMap(
    (entry, index) => {
      const light = toLight(entry, index, takenIds)
      return light ? [light] : []
    }
  )

  const cameras = (Array.isArray(record.cameras) ? record.cameras : []).flatMap(
    (entry, index) => {
      const camera = toSceneCamera(entry, index, takenIds)
      return camera ? [camera] : []
    }
  )

  const output = (record.output ?? {}) as Record<string, unknown>
  let legacyCameraId = ''
  if (cameras.length === 0 && record.camera) {
    const legacy = toCameraConfig(record.camera)
    if (legacy) {
      const migrated = toSceneCamera({ preset: legacy }, cameras.length, takenIds)
      if (migrated) {
        cameras.push(migrated)
        legacyCameraId = migrated.id
      }
    }
  }

  const cameraIdRaw =
    typeof output.cameraId === 'string' ? output.cameraId : legacyCameraId
  const cameraId = cameras.some((camera) => camera.id === cameraIdRaw)
    ? cameraIdRaw
    : legacyCameraId

  return {
    version: 1,
    characters,
    primitives,
    models,
    lights,
    cameras,
    environment: toEnvironment(record.environment),
    output: {
      fps: clamp(toFinite(output.fps, 24), 1, 120),
      frameCount: clamp(Math.round(toFinite(output.frameCount, 0)), 0, 10000),
      cameraId
    }
  }
}
