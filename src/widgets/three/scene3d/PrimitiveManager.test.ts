import * as THREE from 'three'
import { beforeEach, describe, expect, it } from 'vitest'

import { Scene3dPrimitiveManager } from './PrimitiveManager'
import { createDefaultPrimitive } from './types'
import type { PrimitiveShape, ScenePrimitiveEntry } from './types'

function makeEntry(
  id: string,
  shape: PrimitiveShape = 'cube',
  overrides: Partial<ScenePrimitiveEntry> = {}
): ScenePrimitiveEntry {
  const entry = createDefaultPrimitive(shape, [])
  entry.id = id
  return { ...entry, ...overrides }
}

describe('Scene3dPrimitiveManager', () => {
  let scene: THREE.Scene
  let manager: Scene3dPrimitiveManager

  beforeEach(() => {
    scene = new THREE.Scene()
    manager = new Scene3dPrimitiveManager(scene)
  })

  it('creates one mesh per entry and applies transform and color', () => {
    const entry = makeEntry('p1', 'sphere', { color: '#ff0000' })
    entry.transform.position = { x: 2, y: 1, z: 0 }
    manager.applyPrimitives([entry, makeEntry('p2', 'cube')])

    expect(scene.children).toHaveLength(2)
    const mesh = manager.getObject('p1') as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >
    expect(mesh.position.x).toBe(2)
    expect(mesh.material.color.getHexString()).toBe('ff0000')
    expect(mesh.userData.sceneObjectId).toBe('p1')
  })

  it('reuses meshes for unchanged shape and rebuilds on shape change', () => {
    manager.applyPrimitives([makeEntry('p1', 'cube')])
    const first = manager.getObject('p1')
    manager.applyPrimitives([makeEntry('p1', 'cube', { color: '#00ff00' })])
    expect(manager.getObject('p1')).toBe(first)

    manager.applyPrimitives([makeEntry('p1', 'sphere')])
    expect(manager.getObject('p1')).not.toBe(first)
  })

  it('removes stale meshes and disposes on cleanup', () => {
    manager.applyPrimitives([makeEntry('p1'), makeEntry('p2')])
    manager.applyPrimitives([makeEntry('p2')])
    expect(manager.getObject('p1')).toBeNull()
    expect(scene.children).toHaveLength(1)

    manager.dispose()
    expect(scene.children).toHaveLength(0)
  })

  it('exposes pickable meshes', () => {
    manager.applyPrimitives([makeEntry('p1'), makeEntry('p2')])
    expect(manager.pickables()).toHaveLength(2)
  })
})
