import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Scene3dCharacterManager } from './CharacterManager'
import { buildPathActionJson } from './pathStrip'
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

  it('drives a pathed character along its spline and draws the path line', async () => {
    const entry = makeEntry('a')
    entry.path = {
      action: buildPathActionJson(
        [
          [0, 0, 0],
          [10, 0, 0]
        ],
        undefined,
        true
      ),
      syncSpeed: 2
    }
    manager.setSceneFps(24)
    await manager.applyCharacters([entry])

    const line = scene.children.find((child) => (child as THREE.Line).isLine)
    expect(line).toBeDefined()

    const root = manager.getObject('a')!
    manager.setTimelineTime(2.5)
    expect(root.position.x).toBeCloseTo(5, 0)
    expect(root.position.x).toBeGreaterThan(0.5)

    manager.setTimelineTime(0)
    expect(root.position.x).toBeCloseTo(0, 1)

    manager.setHelpersVisible(false)
    expect((line as THREE.Line).visible).toBe(false)

    delete entry.path
    await manager.applyCharacters([entry])
    expect(scene.children.some((child) => (child as THREE.Line).isLine)).toBe(
      false
    )
  })

  it('tints and untints per-instance materials without cross-talk', async () => {
    const template = makeAssets()
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial({ color: 0x2266aa })
    )
    template.template.add(mesh)
    loadCharacterAssets.mockImplementation(async () => template)

    const tinted = makeEntry('a')
    tinted.color = '#ff0000'
    const plain = makeEntry('b')
    await manager.applyCharacters([tinted, plain])

    const materialOf = (id: string): THREE.MeshStandardMaterial => {
      let found: THREE.MeshStandardMaterial | null = null
      manager.getObject(id)!.traverse((child) => {
        if (child instanceof THREE.Mesh && !found) {
          found = child.material as THREE.MeshStandardMaterial
        }
      })
      return found!
    }
    expect(materialOf('a').color.getHexString()).toBe('ff0000')
    expect(materialOf('b').color.getHexString()).toBe('2266aa')

    delete tinted.color
    await manager.applyCharacters([tinted, plain])
    expect(materialOf('a').color.getHexString()).toBe('2266aa')
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
