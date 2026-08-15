import { describe, expect, it } from 'vitest'

import { idMatteColor, idMatteColorById, idMatteOrder } from './idMatte'
import { createEmptyScene } from './types'

function sceneWith(): ReturnType<typeof createEmptyScene> {
  const scene = createEmptyScene()
  scene.characters = [
    {
      id: 'char_2',
      model: 'human',
      name: 'Rival',
      animation: { clip: '', speed: 1, loop: true, startOffset: 0 },
      transform: {
        position: { x: 0, y: 0, z: 0 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 }
      }
    },
    {
      id: 'char_1',
      model: 'human',
      animation: { clip: '', speed: 1, loop: true, startOffset: 0 },
      transform: {
        position: { x: 0, y: 0, z: 0 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 }
      }
    }
  ]
  scene.primitives = [
    {
      id: 'prim_1',
      shape: 'cube',
      color: '#9aa0a6',
      transform: {
        position: { x: 0, y: 0, z: 0 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 }
      }
    }
  ]
  return scene
}

describe('idMatteColor', () => {
  it('produces distinct saturated colors per index', () => {
    const colors = new Set(
      Array.from({ length: 12 }, (_, i) => idMatteColor(i))
    )
    expect(colors.size).toBe(12)
    for (const color of colors) expect(color).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('idMatteOrder', () => {
  it('orders deterministically by id and labels by name/model/shape', () => {
    const legend = idMatteOrder(sceneWith())
    expect(legend.map((entry) => entry.id)).toEqual([
      'char_1',
      'char_2',
      'prim_1'
    ])
    expect(legend[0].name).toBe('human')
    expect(legend[1].name).toBe('Rival')
    expect(legend[2].kind).toBe('primitive')
    expect(new Set(legend.map((entry) => entry.color)).size).toBe(3)
  })

  it('assigns the same colors regardless of authoring order', () => {
    const legend = idMatteOrder(sceneWith())
    const map = idMatteColorById(sceneWith())
    for (const entry of legend) {
      expect(map.get(entry.id)).toBe(entry.color)
    }
  })
})
