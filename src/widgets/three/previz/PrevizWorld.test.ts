import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { makeTrackAction, trackToJson } from './dollyTrack'
import { PrevizWorld } from './PrevizWorld'
import { evaluateActors, evaluateShotCam } from './playback'
import { defaultScene, normalizeScene } from './projectData'
import { PREVIZ_LOCK_MANUAL } from './types'

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

function track(
  points: Array<[number, number, number]>,
  opts: { straight?: boolean; timesSec?: number[] } = {}
) {
  return trackToJson(makeTrackAction(points.map((p) => v3(...p)), opts))
}

function makeWorld(scene = defaultScene()) {
  const world = new PrevizWorld()
  world.loadScene(scene)
  return world
}

describe('PrevizWorld scene loading', () => {
  it('builds runtime actors and shots from scene data', () => {
    const world = makeWorld()
    expect(world.actors).toHaveLength(3)
    expect(world.shots).toHaveLength(3)
    expect(world.actorByLabel('A')?.track).not.toBeNull()
    world.dispose()
  })

  it('round-trips runtime state back to scene data', () => {
    const scene = defaultScene()
    const world = makeWorld(scene)
    const out = world.toSceneData(scene.name, scene.desc)
    expect(out.actors.map((a) => a.label)).toEqual(scene.actors.map((a) => a.label))
    expect(out.shots.map((s) => s.dur)).toEqual(scene.shots.map((s) => s.dur))
    expect(out.actors[0].track).toEqual(scene.actors[0].track)
    expect(out.shots[0].camera).toEqual(scene.shots[0].camera)
    world.dispose()
  })

  it('removing a mount frees its rider', () => {
    const world = makeWorld(
      normalizeScene({
        name: 'S',
        actors: [
          { label: 'Horse', kind: 'horse' },
          { label: 'Rider', kind: 'char', mount: 'Horse', pose: 'ride' }
        ],
        shots: [{ name: 's', dur: 2 }]
      })
    )
    const horse = world.actorByLabel('Horse')!
    world.removeActor(horse)
    expect(world.actorByLabel('Rider')?.data.mount).toBeUndefined()
    world.dispose()
  })

  it('seats riders on the mount saddle', () => {
    const world = makeWorld(
      normalizeScene({
        name: 'S',
        actors: [
          { label: 'Horse', kind: 'horse', pos: [2, 3] },
          { label: 'Rider', kind: 'char', mount: 'Horse', pose: 'ride' }
        ],
        shots: [{ name: 's', dur: 2 }]
      })
    )
    const rider = world.actorByLabel('Rider')!
    world.alignAllActors()
    expect(rider.obj.position.x).toBeCloseTo(2, 0)
    expect(rider.obj.position.y).toBeGreaterThan(1)
    world.dispose()
  })
})

describe('collision', () => {
  it('stops a moved actor at first contact', () => {
    const world = makeWorld(
      normalizeScene({
        name: 'S',
        actors: [
          { label: 'A', kind: 'char', pos: [0, 0] },
          { label: 'Wall', kind: 'wall', pos: [3, 0], rotY: Math.PI / 2 }
        ],
        shots: [{ name: 's', dur: 2 }]
      })
    )
    const a = world.actorByLabel('A')!
    world.moveActorSafely(a, 6, 0)
    expect(a.obj.position.x).toBeLessThan(3)
    expect(world.actorPenetrates(a)).toBe(false)
    world.dispose()
  })

  it('moves freely with collision disabled', () => {
    const world = makeWorld(
      normalizeScene({
        name: 'S',
        actors: [
          { label: 'A', kind: 'char', pos: [0, 0] },
          { label: 'Wall', kind: 'wall', pos: [3, 0], rotY: Math.PI / 2 }
        ],
        shots: [{ name: 's', dur: 2 }]
      })
    )
    world.collisionEnabled = false
    const a = world.actorByLabel('A')!
    world.moveActorSafely(a, 6, 0)
    expect(a.obj.position.x).toBeCloseTo(6)
    world.dispose()
  })
})

describe('playback evaluation', () => {
  it('moves an actor along its dolly track over time', () => {
    const world = makeWorld(
      normalizeScene({
        name: 'S',
        actors: [
          {
            label: 'A',
            kind: 'char',
            pos: [0, 0],
            track: track([[0, 0, 0], [4, 0, 0]], { straight: true, timesSec: [0, 2] })
          }
        ],
        shots: [{ name: 's', dur: 2 }]
      })
    )
    const a = world.actorByLabel('A')!
    evaluateActors(world, 0, 0)
    expect(a.obj.position.x).toBeCloseTo(0, 1)
    evaluateActors(world, 0, 1)
    expect(a.obj.position.x).toBeCloseTo(2, 0)
    evaluateActors(world, 0, 2)
    expect(a.obj.position.x).toBeCloseTo(4, 1)
    world.dispose()
  })

  it('aims the shot camera at the locked actor', () => {
    const world = makeWorld(
      normalizeScene({
        name: 'S',
        actors: [{ label: 'A', kind: 'char', pos: [0, 0] }],
        shots: [{ name: 's', dur: 2, lock: 'A', camera: track([[0, 2, 6]]) }]
      })
    )
    evaluateShotCam(world, world.shots[0], 0)
    expect(world.shotCam.position.z).toBeCloseTo(6)
    const dir = world.shotCam.getWorldDirection(new THREE.Vector3())
    expect(dir.z).toBeLessThan(0)
    world.dispose()
  })

  it('uses rotation_euler keys when the lock is manual', () => {
    const world = makeWorld(
      normalizeScene({
        name: 'S',
        actors: [],
        shots: [
          {
            name: 's',
            dur: 2,
            lock: PREVIZ_LOCK_MANUAL,
            yaw: 90,
            pitch: 0,
            camera: track([[0, 2, 6]])
          }
        ]
      })
    )
    evaluateShotCam(world, world.shots[0], 0)
    expect(world.shotCam.rotation.y).toBeCloseTo(Math.PI / 2, 1)
    world.dispose()
  })

  it('follows the speed curve in custom timing mode', () => {
    const world = makeWorld(
      normalizeScene({
        name: 'S',
        actors: [],
        shots: [
          {
            name: 's',
            dur: 2,
            timingMode: 'custom',
            camera: track([[0, 2, 0], [4, 2, 0]], { straight: true, timesSec: [0, 2] })
          }
        ]
      })
    )
    evaluateShotCam(world, world.shots[0], 1)
    expect(world.shotCam.position.x).toBeCloseTo(2, 0)
    evaluateShotCam(world, world.shots[0], 2)
    expect(world.shotCam.position.x).toBeCloseTo(4, 1)
    world.dispose()
  })

  it('applies the base fov without lens keys', () => {
    const world = makeWorld(
      normalizeScene({
        name: 'S',
        actors: [],
        shots: [{ name: 's', dur: 2, fov: 66, camera: track([[0, 2, 6]]) }]
      })
    )
    evaluateShotCam(world, world.shots[0], 0)
    expect(world.shotCam.fov).toBeCloseTo(66, 3)
    world.dispose()
  })
})
