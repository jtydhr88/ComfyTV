import type { CameraActionJson } from 'dollycurve'

export type PrevizActorKind =
  | 'char'
  | 'horse'
  | 'car'
  | 'dog'
  | 'tree'
  | 'mount'
  | 'house'
  | 'rock'
  | 'bush'
  | 'road'
  | 'wall'
  | 'pillar'
  | 'prop'

export type PrevizPose = 'stand' | 'sit' | 'crouch' | 'lie' | 'ride' | 'custom'
export type PrevizTimeLink = 'independent' | 'cameraNodes' | 'cameraFollow'
export type PrevizTimingMode = 'pointSync' | 'arcLength' | 'custom'
export type PrevizGroundStyle = 'checker' | 'white' | 'black' | 'color'
export type PrevizSunQuality = 'performance' | 'standard' | 'high'

export const PREVIZ_LOCK_GLOBAL = ''
export const PREVIZ_LOCK_MANUAL = '__manual__'

export interface PrevizActorData {
  kind: PrevizActorKind
  label: string
  pose: PrevizPose
  pos: [number, number]
  rotY: number
  height: number
  scale: number
  timeLink: PrevizTimeLink
  timeOffset: number
  timeLinkShot: number
  mount?: string
  joints?: Record<string, number>
  track: CameraActionJson | null
}

export interface PrevizShotData {
  name: string
  desc: string
  dur: number
  lock: string
  fov: number
  timingMode: PrevizTimingMode
  syncActor: string
  yaw: number
  pitch: number
  camera: CameraActionJson
}

export interface PrevizSun {
  enabled: boolean
  pos: [number, number, number]
  intensity: number
  temp: number
  ambient: number
  softness: number
  quality: PrevizSunQuality
}

export interface PrevizGround {
  style: PrevizGroundStyle
  color?: string
}

export interface PrevizSceneData {
  name: string
  desc: string
  actors: PrevizActorData[]
  shots: PrevizShotData[]
  ground: PrevizGround
  sun: PrevizSun
}

export interface PrevizProjectData {
  app: 'ComfyTV.Previz'
  version: number
  aspect: string
  settings: { collision: boolean; labels: boolean }
  scenes: PrevizSceneData[]
}

export const PREVIZ_VERSION = 2
export const PREVIZ_SHOT_DURATION_MIN = 0.5
export const PREVIZ_STAGE_LIMIT = 29.5
export const PREVIZ_CAMERA_HEIGHT_MIN = 0.2
export const PREVIZ_CAMERA_HEIGHT_MAX = 30

export const PREVIZ_ASPECTS: Record<string, [number, number]> = {
  '16:9': [1920, 1080],
  '9:16': [1080, 1920],
  '1:1': [1440, 1440],
  '4:3': [1664, 1248]
}

export const PREVIZ_POSES: ReadonlySet<string> = new Set([
  'stand',
  'sit',
  'crouch',
  'lie',
  'ride',
  'custom'
])
export const PREVIZ_TIME_LINKS: ReadonlySet<string> = new Set([
  'independent',
  'cameraNodes',
  'cameraFollow'
])
export const PREVIZ_TIMING_MODES: ReadonlySet<string> = new Set([
  'pointSync',
  'arcLength',
  'custom'
])
export const PREVIZ_ACTOR_KINDS: ReadonlySet<string> = new Set([
  'char',
  'horse',
  'car',
  'dog',
  'tree',
  'mount',
  'house',
  'rock',
  'bush',
  'road',
  'wall',
  'pillar',
  'prop'
])
export const PREVIZ_GROUND_STYLES: ReadonlySet<string> = new Set([
  'checker',
  'white',
  'black',
  'color'
])

export const PREVIZ_JOINT_KEYS: ReadonlyArray<string> = [
  'bodyY',
  'bodyRotX',
  'neckX',
  'neckY',
  'spineX',
  'spineY',
  'spineZ',
  'shLX',
  'shLZ',
  'shRX',
  'shRZ',
  'elL',
  'elR',
  'wristLX',
  'wristLZ',
  'wristRX',
  'wristRZ',
  'hipLX',
  'hipLZ',
  'hipRX',
  'hipRZ',
  'kneeL',
  'kneeR',
  'ankleLX',
  'ankleLZ',
  'ankleRX',
  'ankleRZ'
]

export const PREVIZ_DEFAULT_SUN: Readonly<PrevizSun> = Object.freeze({
  enabled: true,
  pos: [8, 14, 6] as [number, number, number],
  intensity: 0.9,
  temp: 5600,
  ambient: 0.28,
  softness: 2,
  quality: 'standard' as PrevizSunQuality
})
