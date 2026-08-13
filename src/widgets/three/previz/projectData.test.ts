import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { makeTrackAction, trackToJson } from './dollyTrack'
import {
  defaultScene,
  defaultShotCamera,
  normalizeActor,
  normalizeGround,
  normalizeProject,
  normalizeScene,
  normalizeShot,
  normalizeSun,
  parseProjectJson,
  sceneDuration
} from './projectData'
import { PREVIZ_LOCK_GLOBAL } from './types'

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

function track(points: Array<[number, number, number]>) {
  return trackToJson(makeTrackAction(points.map((p) => v3(...p))))
}

describe('normalizeActor', () => {
  it('applies defaults', () => {
    const actor = normalizeActor({ label: 'A' })
    expect(actor.kind).toBe('prop')
    expect(actor.pose).toBe('stand')
    expect(actor.track).toBeNull()
  })

  it('keeps a valid dollycurve track and drops junk', () => {
    const good = normalizeActor({ label: 'A', track: track([[0, 0, 0], [2, 0, 2]]) })
    expect(good.track).not.toBeNull()
    const bad = normalizeActor({ label: 'A', track: { garbage: 1 } })
    expect(bad.track).toBeNull()
  })

  it('whitelists joint keys', () => {
    const actor = normalizeActor({
      label: 'A',
      kind: 'char',
      joints: { kneeL: 10, bogus: 99 }
    })
    expect(actor.joints).toEqual({ kneeL: 10 })
  })

  it('clamps scale', () => {
    expect(normalizeActor({ label: 'A', scale: 99 }).scale).toBe(3)
    expect(normalizeActor({ label: 'A' }).scale).toBe(1)
  })
})

describe('normalizeShot', () => {
  it('supplies a default single-anchor camera when none is stored', () => {
    const shot = normalizeShot({ name: 'S', dur: 4 })
    expect(shot.camera.pathFollow?.splinePath.points).toHaveLength(1)
  })

  it('replaces an unparseable camera with the default', () => {
    const shot = normalizeShot({ name: 'S', camera: { broken: true } })
    expect(shot.camera.pathFollow?.splinePath.points).toHaveLength(1)
  })

  it('keeps a valid stored camera', () => {
    const camera = defaultShotCamera([v3(-6, 2, 8), v3(-4, 2, 6)])
    const shot = normalizeShot({ name: 'S', camera })
    expect(shot.camera.pathFollow?.splinePath.points).toHaveLength(2)
  })

  it('enforces the minimum shot duration and fov range', () => {
    expect(normalizeShot({ dur: 0.1 }).dur).toBe(0.5)
    expect(normalizeShot({ fov: 500 }).fov).toBe(110)
  })
})

describe('normalizeScene', () => {
  it('drops duplicate labels, dangling locks and cyclic mounts', () => {
    const scene = normalizeScene({
      name: 'S',
      actors: [
        { label: 'A', kind: 'char', mount: 'B' },
        { label: 'B', kind: 'horse', mount: 'A' },
        { label: 'A', kind: 'prop' },
        { label: 'C', kind: 'char', mount: 'Ghost' }
      ],
      shots: [{ name: 's1', dur: 2, lock: 'Nobody', syncActor: 'Ghost' }]
    })
    expect(scene.actors.map((a) => a.label)).toEqual(['A', 'B', 'C'])
    expect(scene.actors[0].mount).toBeUndefined()
    expect(scene.actors[2].mount).toBeUndefined()
    expect(scene.shots[0].lock).toBe(PREVIZ_LOCK_GLOBAL)
    expect(scene.shots[0].syncActor).toBe('')
  })

  it('always keeps at least one shot', () => {
    const scene = normalizeScene({ name: 'S', actors: [], shots: [] })
    expect(scene.shots).toHaveLength(1)
  })
})

describe('normalizeSun / normalizeGround', () => {
  it('clamps sun values into range', () => {
    const sun = normalizeSun({ intensity: 99, temp: 100, ambient: -3, softness: 100, pos: [99, 0, -99] })
    expect(sun.intensity).toBe(3)
    expect(sun.temp).toBe(2500)
    expect(sun.ambient).toBe(0)
    expect(sun.softness).toBe(5)
    expect(sun.pos).toEqual([30, 14, -30])
  })

  it('validates ground colors', () => {
    expect(normalizeGround({ style: 'color', color: '#AABBCC' })).toEqual({
      style: 'color',
      color: '#aabbcc'
    })
    expect(normalizeGround({ style: 'color', color: 'red' })).toEqual({
      style: 'color',
      color: '#707781'
    })
    expect(normalizeGround({ style: 'image' })).toEqual({ style: 'checker' })
  })
})

describe('normalizeProject / parseProjectJson', () => {
  it('produces a usable default project from junk', () => {
    const project = parseProjectJson('not json at all')
    expect(project.app).toBe('ComfyTV.Previz')
    expect(project.scenes).toHaveLength(1)
    expect(project.scenes[0].shots.length).toBeGreaterThan(0)
    expect(project.aspect).toBe('16:9')
  })

  it('round-trips a normalized project through JSON unchanged', () => {
    const project = normalizeProject({ scenes: [defaultScene()] })
    const again = parseProjectJson(JSON.stringify(project))
    expect(again).toEqual(project)
  })

  it('rejects unknown aspects', () => {
    expect(normalizeProject({ aspect: '21:9' }).aspect).toBe('16:9')
  })

  it('reads settings toggles', () => {
    const project = normalizeProject({ settings: { collision: false, labels: false } })
    expect(project.settings).toEqual({ collision: false, labels: false })
  })
})

describe('defaultScene', () => {
  it('ships dollycurve tracks for the starter actors and shots', () => {
    const scene = defaultScene()
    expect(scene.actors[0].track?.pathFollow?.splinePath.points).toHaveLength(3)
    expect(scene.shots[0].camera.pathFollow?.splinePath.points).toHaveLength(2)
    expect(sceneDuration(scene)).toBeCloseTo(13)
  })
})
