export type LightInfoType = 'directional' | 'point' | 'spot'

export const LIGHT_TYPES: readonly LightInfoType[] = [
  'directional',
  'point',
  'spot'
]

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface LightInfoEntry {
  type: LightInfoType
  color: string
  intensity: number
  position: Vec3
  target?: Vec3
  range?: number
  innerConeAngle?: number
  outerConeAngle?: number
}

export function createDefaultLight(type: LightInfoType): LightInfoEntry {
  if (type === 'point') {
    return {
      type,
      color: '#ffffff',
      intensity: 25,
      position: { x: 2, y: 3, z: 2 }
    }
  }
  if (type === 'spot') {
    return {
      type,
      color: '#ffffff',
      intensity: 25,
      position: { x: 2, y: 3, z: 2 },
      target: { x: 0, y: 0, z: 0 },
      innerConeAngle: 30,
      outerConeAngle: 45
    }
  }
  return {
    type: 'directional',
    color: '#ffffff',
    intensity: 1.5,
    position: { x: 0, y: 7.07, z: 7.07 },
    target: { x: 0, y: 0, z: 0 }
  }
}

function cloneLight(light: LightInfoEntry): LightInfoEntry {
  return {
    ...light,
    position: { ...light.position },
    ...(light.target ? { target: { ...light.target } } : {})
  }
}

export function cloneLights(lights: LightInfoEntry[]): LightInfoEntry[] {
  return lights.map(cloneLight)
}

export function lightTarget(light: LightInfoEntry): Vec3 {
  return light.target ?? { x: 0, y: 0, z: 0 }
}
