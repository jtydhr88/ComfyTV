import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Scene3dCharacterManager } from './CharacterManager'
import { createDefaultCharacter } from './types'
import type { SceneCharacterEntry } from './types'

const loadCharacterAssets = vi.hoisted(() => vi.fn())

vi.mock('./scene3dAssets', () => ({
  loadCharacterAssets
}))

function makeAssets() {
  const template = new THREE.Group()
  const puppet = new THREE.Object3D()
  puppet.name = 'Puppet'
  template.add(puppet)
  const clip = new THREE.AnimationClip('Walk', 2, [
    new THREE.VectorKeyframeTrack('Puppet.position', [0, 2], [0, 0, 0, 2, 0, 0])
  ])
  return { template, clips: [clip] }
}

function makeEntry(
  id: string,
  model = 'human',
  animation: Partial<SceneCharacterEntry['animation']> = {}
): SceneCharacterEntry {
  const entry = createDefaultCharacter(model, [])
  entry.id = id
  entry.animation = { ...entry.animation, clip: 'Walk', ...animation }
  return entry
}

describe('Scene3dCharacterManager', () => {
  let scene: THREE.Scene
  let manager: Scene3dCharacterManager

  beforeEach(() => {
    loadCharacterAssets.mockReset()
    loadCharacterAssets.mockImplementation(async () => makeAssets())
    scene = new THREE.Scene()
    manager = new Scene3dCharacterManager(scene)
  })

  it('instantiates one clone per character and applies the transform', async () => {
    const entry = makeEntry('a')
    entry.transform.position = { x: 3, y: 0, z: -1 }
    await manager.applyCharacters([entry, makeEntry('b')])

    expect(scene.children).toHaveLength(2)
    const root = manager.getObject('a')
    expect(root).not.toBeNull()
    expect(root!.position.x).toBe(3)
    expect(root!.userData.sceneObjectId).toBe('a')
  })

  it('reuses the instance for an unchanged id+model and rebuilds on model change', async () => {
    await manager.applyCharacters([makeEntry('a', 'human')])
    const first = manager.getObject('a')
    await manager.applyCharacters([makeEntry('a', 'human')])
    expect(manager.getObject('a')).toBe(first)
    expect(loadCharacterAssets).toHaveBeenCalledTimes(1)

    await manager.applyCharacters([makeEntry('a', 'fox')])
    expect(manager.getObject('a')).not.toBe(first)
    expect(loadCharacterAssets).toHaveBeenCalledTimes(2)
  })

  it('removes stale characters from the scene', async () => {
    await manager.applyCharacters([makeEntry('a'), makeEntry('b')])
    await manager.applyCharacters([makeEntry('b')])
    expect(manager.getObject('a')).toBeNull()
    expect(scene.children).toHaveLength(1)
  })

  it('poses characters deterministically from absolute timeline time', async () => {
    await manager.applyCharacters([
      makeEntry('a', 'human', { speed: 2, startOffset: 0, loop: true })
    ])
    const puppet = manager
      .getObject('a')!
      .getObjectByName('Puppet') as THREE.Object3D

    manager.setTimelineTime(0.5)
    expect(puppet.position.x).toBeCloseTo(1)

    manager.setTimelineTime(1.5)
    expect(puppet.position.x).toBeCloseTo(1)
  })

  it('clamps non-looping clips to the final pose', async () => {
    await manager.applyCharacters([makeEntry('a', 'human', { loop: false })])
    const puppet = manager
      .getObject('a')!
      .getObjectByName('Puppet') as THREE.Object3D
    manager.setTimelineTime(10)
    expect(puppet.position.x).toBeCloseTo(2)
  })

  it('leaves characters unposed when the clip is unknown', async () => {
    await manager.applyCharacters([
      makeEntry('a', 'human', { clip: 'DoesNotExist' })
    ])
    manager.setTimelineTime(1)
    expect(manager.getClipDuration('a')).toBe(0)
  })

  it('dispose removes everything from the scene', async () => {
    await manager.applyCharacters([makeEntry('a'), makeEntry('b')])
    manager.dispose()
    expect(scene.children).toHaveLength(0)
  })
})
