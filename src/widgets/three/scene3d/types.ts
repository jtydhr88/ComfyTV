import type { CameraPresetTuning } from '@/widgets/three/load3d/interfaces'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Quat {
  x: number
  y: number
  z: number
  w: number
}

export interface CharacterAnimationConfig {
  clip: string
  speed: number
  loop: boolean
  startOffset: number
}

export interface CharacterTransform {
  position: Vec3
  quaternion: Quat
  scale: Vec3
}

export interface SceneCharacterEntry {
  id: string
  model: string
  name?: string
  hidden?: boolean
  animation: CharacterAnimationConfig
  transform: CharacterTransform
}

export interface SceneModelEntry {
  id: string
  url: string
  name: string
  hidden?: boolean
  animation: CharacterAnimationConfig
  transform: CharacterTransform
}

export const PRIMITIVE_SHAPES = ['cube', 'sphere', 'cylinder', 'plane'] as const
export type PrimitiveShape = (typeof PRIMITIVE_SHAPES)[number]

export const LIGHT_TYPES = ['directional', 'point', 'spot'] as const
export type SceneLightType = (typeof LIGHT_TYPES)[number]

export interface SceneLightEntry {
  id: string
  type: SceneLightType
  name?: string
  hidden?: boolean
  color: string
  intensity: number
  position: Vec3
  target?: Vec3
  range?: number
  innerConeAngle?: number
  outerConeAngle?: number
}

export interface ScenePrimitiveEntry {
  id: string
  shape: PrimitiveShape
  color: string
  name?: string
  hidden?: boolean
  transform: CharacterTransform
}

export interface Scene3DCameraConfig {
  presetId: string
  file: string
  tuning: CameraPresetTuning
  speed: number
}

export interface SceneCameraEntry {
  id: string
  name?: string
  hidden?: boolean
  fov: number
  transform: {
    position: Vec3
    quaternion: Quat
  }
  preset: Scene3DCameraConfig | null
}

interface Scene3DOutputConfig {
  fps: number
  frameCount: number
  cameraId: string
}

export interface SceneEnvironmentConfig {
  showGrid: boolean
  background: string
  showRoom: boolean
}

export function createDefaultEnvironment(): SceneEnvironmentConfig {
  return { showGrid: true, background: '', showRoom: false }
}

export interface Scene3DState {
  version: 1
  characters: SceneCharacterEntry[]
  primitives: ScenePrimitiveEntry[]
  models: SceneModelEntry[]
  lights: SceneLightEntry[]
  cameras: SceneCameraEntry[]
  environment: SceneEnvironmentConfig
  output: Scene3DOutputConfig
}

export function createEmptyScene(): Scene3DState {
  return {
    version: 1,
    characters: [],
    primitives: [],
    models: [],
    lights: [],
    cameras: [],
    environment: createDefaultEnvironment(),
    output: { fps: 24, frameCount: 0, cameraId: '' }
  }
}

const LIGHT_DEFAULTS: Record<SceneLightType, Omit<SceneLightEntry, 'id'>> = {
  directional: {
    type: 'directional',
    color: '#ffffff',
    intensity: 2,
    position: { x: 3, y: 5, z: 3 },
    target: { x: 0, y: 0, z: 0 }
  },
  point: {
    type: 'point',
    color: '#ffffff',
    intensity: 8,
    position: { x: 0, y: 2, z: 0 },
    range: 0
  },
  spot: {
    type: 'spot',
    color: '#ffffff',
    intensity: 15,
    position: { x: 0, y: 4, z: 2 },
    target: { x: 0, y: 0, z: 0 },
    range: 0,
    innerConeAngle: 30,
    outerConeAngle: 45
  }
}

export function createDefaultLight(
  type: SceneLightType,
  existingIds: readonly string[]
): SceneLightEntry {
  const taken = new Set(existingIds)
  let index = 1
  while (taken.has(`light_${index}`)) index += 1
  return { id: `light_${index}`, ...cloneLight(LIGHT_DEFAULTS[type]) }
}

function cloneLight<T extends Omit<SceneLightEntry, 'id'>>(light: T): T {
  return {
    ...light,
    position: { ...light.position },
    ...(light.target ? { target: { ...light.target } } : {})
  }
}

const DEFAULT_PRIMITIVE_COLOR = '#9aa0a6'

export function createDefaultPrimitive(
  shape: PrimitiveShape,
  existingIds: readonly string[]
): ScenePrimitiveEntry {
  const taken = new Set(existingIds)
  let index = 1
  while (taken.has(`prim_${index}`)) index += 1
  return {
    id: `prim_${index}`,
    shape,
    color: DEFAULT_PRIMITIVE_COLOR,
    transform: {
      position: { x: 0, y: shape === 'plane' ? 0 : 0.5, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    }
  }
}

export function createDefaultCamera(
  existingIds: readonly string[],
  pose?: { position: Vec3; quaternion: Quat; fov: number }
): SceneCameraEntry {
  const taken = new Set(existingIds)
  let index = 1
  while (taken.has(`cam_${index}`)) index += 1
  return {
    id: `cam_${index}`,
    fov: pose?.fov ?? 50,
    transform: {
      position: pose ? { ...pose.position } : { x: 4, y: 2.5, z: 4 },
      quaternion: pose ? { ...pose.quaternion } : { x: 0, y: 0, z: 0, w: 1 }
    },
    preset: null
  }
}

export function cloneCameraConfig(
  config: Scene3DCameraConfig
): Scene3DCameraConfig {
  return {
    presetId: config.presetId,
    file: config.file,
    tuning: {
      ...config.tuning,
      ...(config.tuning.positionOffset
        ? { positionOffset: { ...config.tuning.positionOffset } }
        : {})
    },
    speed: config.speed
  }
}

export function createDefaultCharacter(
  model: string,
  existingIds: readonly string[]
): SceneCharacterEntry {
  const taken = new Set(existingIds)
  let index = 1
  while (taken.has(`char_${index}`)) index += 1
  return {
    id: `char_${index}`,
    model,
    animation: { clip: '', speed: 1, loop: true, startOffset: 0 },
    transform: {
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    }
  }
}

export function createDefaultModel(
  url: string,
  name: string,
  existingIds: readonly string[]
): SceneModelEntry {
  const taken = new Set(existingIds)
  let index = 1
  while (taken.has(`model_${index}`)) index += 1
  return {
    id: `model_${index}`,
    url,
    name,
    animation: { clip: '', speed: 1, loop: true, startOffset: 0 },
    transform: {
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    }
  }
}

export function cloneTransform(
  transform: CharacterTransform
): CharacterTransform {
  return {
    position: { ...transform.position },
    quaternion: { ...transform.quaternion },
    scale: { ...transform.scale }
  }
}

function labelFields(entry: {
  name?: string
  hidden?: boolean
}): { name?: string; hidden?: boolean } {
  return {
    ...(entry.name ? { name: entry.name } : {}),
    ...(entry.hidden ? { hidden: true } : {})
  }
}

export function cloneScene(state: Scene3DState): Scene3DState {
  return {
    version: 1,
    characters: state.characters.map((character) => ({
      id: character.id,
      model: character.model,
      ...labelFields(character),
      animation: { ...character.animation },
      transform: cloneTransform(character.transform)
    })),
    primitives: state.primitives.map((primitive) => ({
      id: primitive.id,
      shape: primitive.shape,
      color: primitive.color,
      ...labelFields(primitive),
      transform: cloneTransform(primitive.transform)
    })),
    models: state.models.map((model) => ({
      id: model.id,
      url: model.url,
      name: model.name,
      ...(model.hidden ? { hidden: true } : {}),
      animation: { ...model.animation },
      transform: cloneTransform(model.transform)
    })),
    lights: state.lights.map((light) => ({
      ...cloneLight(light),
      ...labelFields(light)
    })),
    cameras: state.cameras.map((camera) => ({
      id: camera.id,
      ...labelFields(camera),
      fov: camera.fov,
      transform: {
        position: { ...camera.transform.position },
        quaternion: { ...camera.transform.quaternion }
      },
      preset: camera.preset ? cloneCameraConfig(camera.preset) : null
    })),
    environment: { ...state.environment },
    output: { ...state.output }
  }
}
