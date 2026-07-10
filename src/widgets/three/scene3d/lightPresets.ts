import type { SceneLightEntry } from './types'

export const LIGHT_PRESET_NAMES = [
  'studio',
  'outdoor',
  'dramatic',
  'none'
] as const
export type LightPresetName = (typeof LIGHT_PRESET_NAMES)[number]

const ORIGIN = { x: 0, y: 0, z: 0 }
const SUBJECT = { x: 0, y: 1, z: 0 }

const PRESETS: Record<LightPresetName, Omit<SceneLightEntry, 'id'>[]> = {
  studio: [
    {
      type: 'directional',
      color: '#fff1e0',
      intensity: 2.5,
      position: { x: 3, y: 5, z: 3 },
      target: SUBJECT
    },
    {
      type: 'directional',
      color: '#cfe0ff',
      intensity: 0.8,
      position: { x: -4, y: 3, z: 2 },
      target: SUBJECT
    },
    {
      type: 'spot',
      color: '#ffffff',
      intensity: 12,
      position: { x: 0, y: 4, z: -4 },
      target: { x: 0, y: 1.2, z: 0 },
      range: 0,
      innerConeAngle: 35,
      outerConeAngle: 60
    }
  ],
  outdoor: [
    {
      type: 'directional',
      color: '#fff2d9',
      intensity: 3,
      position: { x: 6, y: 8, z: 4 },
      target: ORIGIN
    },
    {
      type: 'directional',
      color: '#9db8ff',
      intensity: 0.8,
      position: { x: -3, y: 6, z: -4 },
      target: ORIGIN
    }
  ],
  dramatic: [
    {
      type: 'spot',
      color: '#ffffff',
      intensity: 25,
      position: { x: 3, y: 4, z: 1 },
      target: SUBJECT,
      range: 0,
      innerConeAngle: 15,
      outerConeAngle: 30
    },
    {
      type: 'point',
      color: '#6677aa',
      intensity: 2,
      position: { x: -3, y: 2, z: -2 },
      range: 10
    }
  ],
  none: []
}

export function createLightPreset(
  name: LightPresetName,
  existingIds: readonly string[]
): SceneLightEntry[] {
  const taken = new Set(existingIds)
  let index = 0
  return PRESETS[name].map((light) => {
    do {
      index += 1
    } while (taken.has(`light_${index}`))
    return {
      id: `light_${index}`,
      ...light,
      position: { ...light.position },
      ...(light.target ? { target: { ...light.target } } : {})
    }
  })
}
