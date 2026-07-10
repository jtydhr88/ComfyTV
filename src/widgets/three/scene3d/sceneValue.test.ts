import { describe, expect, it } from 'vitest'

import { normalizeSceneValue } from './sceneValue'
import { createEmptyScene } from './types'

function characterInput(overrides: Record<string, unknown> = {}) {
  return {
    id: 'char_1',
    model: 'human',
    animation: { clip: 'Walk_Loop', speed: 1, loop: true, startOffset: 0 },
    transform: {
      position: { x: 1, y: 2, z: 3 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    },
    ...overrides
  }
}

describe('normalizeSceneValue', () => {
  it('returns an empty scene for garbage input', () => {
    expect(normalizeSceneValue(undefined)).toEqual(createEmptyScene())
    expect(normalizeSceneValue(42)).toEqual(createEmptyScene())
    expect(normalizeSceneValue('not json {')).toEqual(createEmptyScene())
    expect(normalizeSceneValue([])).toEqual({
      ...createEmptyScene(),
      characters: []
    })
  })

  it('parses a JSON string form', () => {
    const scene = normalizeSceneValue(
      JSON.stringify({ characters: [characterInput()] })
    )
    expect(scene.characters).toHaveLength(1)
    expect(scene.characters[0].model).toBe('human')
  })

  it('round-trips a well-formed scene unchanged', () => {
    const input = {
      version: 1,
      characters: [characterInput()],
      camera: {
        presetId: 'pan_90_degree',
        file: 'basic-moves/pan_90_degree.json',
        tuning: {
          fovScale: 1.2,
          reverse: true,
          positionOffset: { x: 0, y: 1, z: 0 },
          yawDegrees: 15,
          pathScale: 2,
          rollDegrees: -5
        },
        speed: 2
      },
      output: { fps: 30, frameCount: 48 }
    }
    const once = normalizeSceneValue(input)
    expect(normalizeSceneValue(once)).toEqual(once)
    expect(once.cameras).toHaveLength(1)
    expect(once.cameras[0].preset?.tuning.yawDegrees).toBe(15)
    expect(once.cameras[0].preset?.speed).toBe(2)
    expect(once.output).toEqual({
      fps: 30,
      frameCount: 48,
      cameraId: once.cameras[0].id
    })
  })

  it('normalizes camera entries and validates the output camera id', () => {
    const scene = normalizeSceneValue({
      cameras: [
        {
          id: 'cam_a',
          fov: 999,
          transform: { position: { x: 1 }, quaternion: {} },
          preset: null
        }
      ],
      output: { cameraId: 'nonexistent' }
    })
    expect(scene.cameras[0].fov).toBe(140)
    expect(scene.cameras[0].transform.position).toEqual({ x: 1, y: 0, z: 0 })
    expect(scene.output.cameraId).toBe('')
  })

  it('drops characters without a model and deduplicates ids', () => {
    const scene = normalizeSceneValue({
      characters: [
        characterInput(),
        characterInput({ id: 'char_1', model: 'fox' }),
        { animation: {} },
        'nonsense'
      ]
    })
    expect(scene.characters).toHaveLength(2)
    expect(new Set(scene.characters.map((c) => c.id)).size).toBe(2)
  })

  it('clamps animation speed and normalizes the quaternion', () => {
    const scene = normalizeSceneValue({
      characters: [
        characterInput({
          animation: { clip: 'Run', speed: 0, loop: false, startOffset: 2 },
          transform: {
            position: {},
            quaternion: { x: 0, y: 2, z: 0, w: 0 },
            scale: { x: 0, y: -5, z: 2 }
          }
        })
      ]
    })
    const character = scene.characters[0]
    expect(character.animation.speed).toBe(0.01)
    expect(character.animation.loop).toBe(false)
    expect(character.transform.quaternion).toEqual({ x: 0, y: 1, z: 0, w: 0 })
    expect(character.transform.scale.x).toBe(0.001)
    expect(character.transform.scale.y).toBe(0.001)
  })

  it('drops custom camera paths (not supported in this port)', () => {
    const scene = normalizeSceneValue({
      camera: {
        presetId: '__custom__',
        file: '',
        custom: { fps: 24, fcurves: [] },
        speed: 1
      }
    })
    expect(scene.cameras).toHaveLength(0)
  })

  it('drops legacy cameras without a preset file', () => {
    expect(
      normalizeSceneValue({ camera: { presetId: 'x', file: '' } }).cameras
    ).toHaveLength(0)
  })

  it('rejects camera files with path traversal and clamps output', () => {
    const scene = normalizeSceneValue({
      camera: { presetId: 'evil', file: '../secrets.json', speed: 99 },
      output: { fps: 999, frameCount: -5 }
    })
    expect(scene.cameras).toHaveLength(0)
    expect(scene.output).toEqual({ fps: 120, frameCount: 0, cameraId: '' })
  })

  it('normalizes primitives and drops unknown shapes', () => {
    const scene = normalizeSceneValue({
      primitives: [
        {
          id: 'p1',
          shape: 'cube',
          color: '#ff8800',
          transform: { position: { x: 1, y: 0, z: 0 } }
        },
        { shape: 'sphere', color: 'red' },
        { shape: 'torus' },
        'nonsense'
      ]
    })
    expect(scene.primitives.map((p) => p.shape)).toEqual(['cube', 'sphere'])
    expect(scene.primitives[0].color).toBe('#ff8800')
    expect(scene.primitives[1].color).toBe('#9aa0a6')
    expect(scene.primitives[1].id).toBe('prim_2')
  })


  it('normalizes lights per type and drops unknown types', () => {
    const scene = normalizeSceneValue({
      lights: [
        {
          id: 'l1',
          type: 'spot',
          color: '#ff0000',
          intensity: 5,
          position: { x: 1, y: 4, z: 0 },
          innerConeAngle: 50,
          outerConeAngle: 30
        },
        { type: 'point', intensity: -2 },
        { type: 'area' },
        'nonsense'
      ]
    })
    expect(scene.lights.map((l) => l.type)).toEqual(['spot', 'point'])
    const [spot, point] = scene.lights
    expect(spot.target).toEqual({ x: 0, y: 0, z: 0 })
    expect(spot.outerConeAngle).toBe(50)
    expect(point.intensity).toBe(0)
    expect(point.target).toBeUndefined()
    expect(point.id).toBe('light_2')
  })

  it('keeps character and primitive ids in one namespace', () => {
    const scene = normalizeSceneValue({
      characters: [characterInput({ id: 'shared' })],
      primitives: [{ id: 'shared', shape: 'cube', color: '#ffffff' }]
    })
    expect(scene.characters[0].id).toBe('shared')
    expect(scene.primitives[0].id).not.toBe('shared')
  })

  it('drops figure entries (feature removed)', () => {
    const scene = normalizeSceneValue({
      figures: [{ id: 'f1', model: 'mannequin', pose: {} }]
    })
    expect('figures' in scene).toBe(false)
  })

  it('normalizes custom model entries and drops url-less ones', () => {
    const scene = normalizeSceneValue({
      models: [
        {
          id: 'm1',
          url: '/view?filename=robot.fbx&subfolder=comfytv%2Fassets&type=input',
          name: 'Robot',
          animation: { clip: 'Walk', speed: 2, loop: false, startOffset: 1 }
        },
        { name: 'no-url' },
        'nonsense'
      ]
    })
    expect(scene.models).toHaveLength(1)
    expect(scene.models[0].id).toBe('m1')
    expect(scene.models[0].name).toBe('Robot')
    expect(scene.models[0].animation).toEqual({
      clip: 'Walk',
      speed: 2,
      loop: false,
      startOffset: 1
    })
  })

  it('defaults the environment and validates the background color', () => {
    expect(normalizeSceneValue({}).environment).toEqual({
      showGrid: true,
      background: '',
      showRoom: false
    })
    expect(
      normalizeSceneValue({
        environment: { showGrid: false, background: '#1e1e2e', showRoom: true }
      }).environment
    ).toEqual({ showGrid: false, background: '#1e1e2e', showRoom: true })
    expect(
      normalizeSceneValue({ environment: { background: 'red' } }).environment
        .background
    ).toBe('')
  })

  it('defaults an invalid quaternion to identity', () => {
    const scene = normalizeSceneValue({
      characters: [
        characterInput({
          transform: { quaternion: { x: 0, y: 0, z: 0, w: 0 } }
        })
      ]
    })
    expect(scene.characters[0].transform.quaternion).toEqual({
      x: 0,
      y: 0,
      z: 0,
      w: 1
    })
  })
})
