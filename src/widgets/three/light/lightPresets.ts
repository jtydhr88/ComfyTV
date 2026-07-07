import type { LightInfoEntry } from './types'

export interface LightPreset {
  key: string
  lights: LightInfoEntry[]
}

const D = (
  intensity: number,
  x: number,
  y: number,
  z: number,
  color = '#ffffff'
): LightInfoEntry => ({
  type: 'directional',
  color,
  intensity,
  position: { x, y, z },
  target: { x: 0, y: 0, z: 0 }
})

export const LIGHT_PRESETS: LightPreset[] = [
  {
    key: 'threePoint',
    lights: [D(2.5, 2, 3, 2), D(0.8, -2.5, 2, 2), D(1.8, 0, 3, -3)]
  },
  {
    key: 'rembrandt',
    lights: [D(2.2, 2.2, 2.5, 1.2)]
  },
  {
    key: 'butterfly',
    lights: [D(2.2, 0, 3, 2.5)]
  },
  {
    key: 'rim',
    lights: [D(3.0, 0, 2.5, -3.5), D(0.5, 0, 1.5, 3)]
  },
  {
    key: 'side',
    lights: [D(2.5, 3, 1.2, 0)]
  }
]
