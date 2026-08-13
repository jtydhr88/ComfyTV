import { describe, expect, it } from 'vitest'

import { applySceneOps, type SceneOpsContext } from './mcpOps'
import { createEmptyScene } from './types'

const ctx: SceneOpsContext = {
  resolveModel: (assetId, url) => {
    if (url) return { url, name: 'by-url' }
    if (assetId === 42) return { url: '/view?filename=car.glb', name: 'car' }
    return null
  },
  resolvePresetFile: (presetId) =>
    presetId === 'orbit' ? 'orbit.json' : null,
  editorPose: () => ({
    position: { x: 1, y: 2, z: 3 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    fov: 40,
  }),
}

describe('applySceneOps', () => {
  it('builds a scene atomically and reports ids', () => {
    const { next, results } = applySceneOps(createEmptyScene(), [
      { op: 'add_primitive', shape: 'cube', color: '#ff0000',
        position: [0, 0.5, 0], scale: 2 },
      { op: 'add_light', type: 'spot', intensity: 20, position: [0, 4, 2],
        target: [0, 0, 0] },
      { op: 'add_model', asset_id: 42, position: [2, 0, 0] },
      { op: 'add_camera', fov: 35, position: [4, 2, 4], look_at: [0, 0.5, 0] },
      { op: 'set_environment', background: '#101014', show_grid: false },
      { op: 'set_output', fps: 24, frame_count: 72 },
    ], ctx)

    expect(results.map((r) => r.id)).toEqual(
      ['prim_1', 'light_1', 'model_1', 'cam_1', undefined, undefined])
    expect(next.primitives[0].color).toBe('#ff0000')
    expect(next.primitives[0].transform.scale).toEqual({ x: 2, y: 2, z: 2 })
    expect(next.lights[0].type).toBe('spot')
    expect(next.models[0].url).toBe('/view?filename=car.glb')
    expect(next.cameras[0].fov).toBe(35)
    expect(next.output.cameraId).toBe('cam_1')
    expect(next.output.frameCount).toBe(72)
    expect(next.environment.background).toBe('#101014')
  })

  it('look_at orients the camera toward the target', () => {
    const { next } = applySceneOps(createEmptyScene(), [
      { op: 'add_camera', position: [0, 0, 5], look_at: [0, 0, 0] },
    ], ctx)
    const q = next.cameras[0].transform.quaternion
    expect(Math.abs(q.x)).toBeLessThan(1e-6)
    expect(Math.abs(q.y)).toBeLessThan(1e-6)
    expect(q.w).toBeCloseTo(1, 5)
  })

  it('rotation_deg converts to a quaternion', () => {
    const { next } = applySceneOps(createEmptyScene(), [
      { op: 'add_primitive', shape: 'cube', rotation_deg: [0, 90, 0] },
    ], ctx)
    const q = next.primitives[0].transform.quaternion
    expect(q.y).toBeCloseTo(Math.SQRT1_2, 5)
    expect(q.w).toBeCloseTo(Math.SQRT1_2, 5)
  })

  it('mutates existing entries by id', () => {
    const base = applySceneOps(createEmptyScene(), [
      { op: 'add_primitive', shape: 'sphere' },
      { op: 'add_light', type: 'point' },
      { op: 'add_camera' },
    ], ctx).next

    const { next } = applySceneOps(base, [
      { op: 'set_transform', id: 'prim_1', position: [1, 1, 1] },
      { op: 'set_color', id: 'prim_1', color: '#00ff00' },
      { op: 'patch_light', id: 'light_1', intensity: 3 },
      { op: 'rename', id: 'prim_1', name: 'ball' },
      { op: 'bind_camera_preset', id: 'cam_1', preset_id: 'orbit', speed: 2 },
      { op: 'set_camera_tuning', id: 'cam_1', yaw_degrees: 45, reverse: true },
      { op: 'set_camera_fov', id: 'cam_1', fov: 200 },
    ], ctx)

    expect(next.primitives[0].transform.position).toEqual({ x: 1, y: 1, z: 1 })
    expect(next.primitives[0].color).toBe('#00ff00')
    expect(next.primitives[0].name).toBe('ball')
    expect(next.lights[0].intensity).toBe(3)
    expect(next.cameras[0].preset).toMatchObject(
      { presetId: 'orbit', file: 'orbit.json', speed: 2 })
    expect(next.cameras[0].preset!.tuning).toMatchObject(
      { yawDegrees: 45, reverse: true })
    expect(next.cameras[0].fov).toBe(140)
  })

  it('remove clears the output camera fallback', () => {
    const base = applySceneOps(createEmptyScene(), [
      { op: 'add_camera' }, { op: 'add_camera' },
    ], ctx).next
    const { next } = applySceneOps(base, [
      { op: 'set_output', camera_id: 'cam_1' },
      { op: 'remove', id: 'cam_1' },
    ], ctx)
    expect(next.cameras.map((c) => c.id)).toEqual(['cam_2'])
    expect(next.output.cameraId).toBe('cam_2')
  })

  it('errors are self-explanatory and atomic', () => {
    expect(() => applySceneOps(createEmptyScene(), [
      { op: 'levitate' },
    ], ctx)).toThrow(/unknown op 'levitate'; valid ops: add_primitive/)

    expect(() => applySceneOps(createEmptyScene(), [
      { op: 'set_transform', id: 'nope' },
    ], ctx)).toThrow(/no object 'nope'/)

    expect(() => applySceneOps(createEmptyScene(), [
      { op: 'add_model', asset_id: 7 },
    ], ctx)).toThrow(/did not resolve to a mesh model/)

    expect(() => applySceneOps(createEmptyScene(), [
      { op: 'add_camera' },
      { op: 'bind_camera_preset', id: 'cam_1', preset_id: 'nope' },
    ], ctx)).toThrow(/unknown camera preset 'nope'/)

    const scene = createEmptyScene()
    expect(() => applySceneOps(scene, [
      { op: 'add_primitive', shape: 'cube' },
      { op: 'set_transform', id: 'missing' },
    ], ctx)).toThrow()
    expect(scene.primitives).toHaveLength(0)
  })

  it('editor pose seeds an unposed camera', () => {
    const { next } = applySceneOps(createEmptyScene(), [
      { op: 'add_camera' },
    ], ctx)
    expect(next.cameras[0].transform.position).toEqual({ x: 1, y: 2, z: 3 })
    expect(next.cameras[0].fov).toBe(40)
  })
})
