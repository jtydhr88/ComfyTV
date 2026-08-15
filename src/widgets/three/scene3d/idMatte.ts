import type { Scene3DState } from './types'

export interface IdLegendEntry {
  id: string
  name: string
  kind: 'character' | 'model' | 'primitive'
  color: string
}

const GOLDEN_ANGLE = 137.508

export function idMatteColor(index: number): string {
  const hue = (index * GOLDEN_ANGLE) % 360
  const saturation = 1
  const lightness = 0.5
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = lightness - c / 2
  let rgb: [number, number, number]
  if (hue < 60) rgb = [c, x, 0]
  else if (hue < 120) rgb = [x, c, 0]
  else if (hue < 180) rgb = [0, c, x]
  else if (hue < 240) rgb = [0, x, c]
  else if (hue < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`
}

export function idMatteOrder(state: Scene3DState): IdLegendEntry[] {
  const entries: IdLegendEntry[] = []
  for (const character of state.characters) {
    entries.push({
      id: character.id,
      name: character.name || character.model,
      kind: 'character',
      color: ''
    })
  }
  for (const model of state.models) {
    entries.push({ id: model.id, name: model.name || model.id, kind: 'model', color: '' })
  }
  for (const primitive of state.primitives) {
    entries.push({
      id: primitive.id,
      name: primitive.name || primitive.shape,
      kind: 'primitive',
      color: ''
    })
  }
  entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  entries.forEach((entry, index) => {
    entry.color = idMatteColor(index)
  })
  return entries
}

export function idMatteColorById(state: Scene3DState): Map<string, string> {
  const map = new Map<string, string>()
  for (const entry of idMatteOrder(state)) {
    map.set(entry.id, entry.color)
  }
  return map
}
