import * as THREE from 'three'
import { beforeEach, describe, expect, it } from 'vitest'

import { Scene3dLightManager } from './LightManager'
import { createDefaultLight } from './types'
import type { SceneLightEntry, SceneLightType } from './types'

function makeEntry(
  id: string,
  type: SceneLightType = 'point',
  overrides: Partial<SceneLightEntry> = {}
): SceneLightEntry {
  const entry = createDefaultLight(type, [])
  entry.id = id
  return { ...entry, ...overrides }
}

describe('Scene3dLightManager', () => {
  let scene: THREE.Scene
  let manager: Scene3dLightManager

  beforeEach(() => {
    scene = new THREE.Scene()
    manager = new Scene3dLightManager(scene)
  })

  it('creates the matching THREE light per entry', () => {
    manager.applyLights([
      makeEntry('l1', 'directional'),
      makeEntry('l2', 'point'),
      makeEntry('l3', 'spot')
    ])
    expect(manager.getObject('l1')).toBeInstanceOf(THREE.DirectionalLight)
    expect(manager.getObject('l2')).toBeInstanceOf(THREE.PointLight)
    expect(manager.getObject('l3')).toBeInstanceOf(THREE.SpotLight)
    expect(manager.isLight('l2')).toBe(true)
    expect(manager.isLight('nope')).toBe(false)
  })

  it('applies color, intensity, position, target and spot cone', () => {
    manager.applyLights([
      makeEntry('l1', 'spot', {
        color: '#ff0000',
        intensity: 12,
        position: { x: 1, y: 4, z: 2 },
        target: { x: 0, y: 1, z: 0 },
        range: 20,
        innerConeAngle: 20,
        outerConeAngle: 40
      })
    ])
    const light = manager.getObject('l1') as THREE.SpotLight
    expect(light.color.getHexString()).toBe('ff0000')
    expect(light.intensity).toBe(12)
    expect(light.position.y).toBe(4)
    expect(light.target.position.y).toBe(1)
    expect(light.distance).toBe(20)
    expect(light.angle).toBeCloseTo(THREE.MathUtils.degToRad(40))
    expect(light.penumbra).toBeCloseTo(0.5)
  })

  it('reuses lights for an unchanged type and rebuilds on type change', () => {
    manager.applyLights([makeEntry('l1', 'point')])
    const first = manager.getObject('l1')
    manager.applyLights([makeEntry('l1', 'point', { intensity: 3 })])
    expect(manager.getObject('l1')).toBe(first)

    manager.applyLights([makeEntry('l1', 'spot')])
    expect(manager.getObject('l1')).not.toBe(first)
  })

  it('removes stale lights and cleans up on dispose', () => {
    manager.applyLights([makeEntry('l1'), makeEntry('l2', 'directional')])
    manager.applyLights([makeEntry('l1')])
    expect(manager.getObject('l2')).toBeNull()

    manager.dispose()
    expect(manager.getObject('l1')).toBeNull()
    expect(scene.children).toHaveLength(0)
  })
})
