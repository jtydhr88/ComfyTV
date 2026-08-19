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

  it('authors a shot cut track with validation', () => {
    const { next, results } = applySceneOps(createEmptyScene(), [
      { op: 'add_character', model: 'human' },
      { op: 'add_camera', position: [4, 2, 4] },
      { op: 'add_camera', position: [-4, 2, 4] },
      { op: 'add_shot', camera_id: 'cam_1', dur_frames: 48, name: 'Wide' },
      { op: 'add_shot', camera_id: 'cam_2', dur_frames: 24, lock: 'char_1' },
      { op: 'add_shot', camera_id: 'cam_1', index: 0, dur_frames: 12 },
    ], ctx)
    expect(next.shots.map((s) => [s.id, s.durFrames, s.cameraId])).toEqual([
      ['shot_3', 12, 'cam_1'],
      ['shot_1', 48, 'cam_1'],
      ['shot_2', 24, 'cam_2'],
    ])
    expect(next.shots[2].lock).toBe('char_1')
    expect(results.at(-1)).toEqual({ op: 'add_shot', id: 'shot_3', index: 0 })
  })

  it('rejects shots referencing unknown cameras or characters', () => {
    expect(() =>
      applySceneOps(createEmptyScene(), [
        { op: 'add_shot', camera_id: 'ghost' },
      ], ctx)
    ).toThrow(/no camera 'ghost'/)
    expect(() =>
      applySceneOps(createEmptyScene(), [
        { op: 'add_camera' },
        { op: 'add_shot', camera_id: 'cam_1', lock: 'ghost' },
      ], ctx)
    ).toThrow(/lock must be a character id/)
  })

  it('patches, reorders and removes shots with reference cleanup', () => {
    const base = applySceneOps(createEmptyScene(), [
      { op: 'add_character', model: 'human' },
      { op: 'add_camera' },
      { op: 'add_camera' },
      { op: 'add_shot', camera_id: 'cam_1', dur_frames: 48 },
      { op: 'add_shot', camera_id: 'cam_2', dur_frames: 24, lock: 'char_1' },
    ], ctx).next

    const patched = applySceneOps(base, [
      { op: 'patch_shot', id: 'shot_1', dur_frames: 96, camera_id: 'cam_2' },
      { op: 'patch_shot', id: 'shot_2', lock: '' },
      { op: 'move_shot', id: 'shot_2', index: 0 },
    ], ctx).next
    expect(patched.shots[1]).toEqual({
      id: 'shot_1', durFrames: 96, cameraId: 'cam_2'
    })
    expect(patched.shots[0].lock).toBeUndefined()

    const cleaned = applySceneOps(base, [
      { op: 'remove', id: 'cam_2' },
      { op: 'remove', id: 'char_1' },
    ], ctx).next
    expect(cleaned.shots[1].cameraId).toBe('')
    expect(cleaned.shots[1].lock).toBeUndefined()

    const removed = applySceneOps(base, [{ op: 'remove', id: 'shot_1' }], ctx).next
    expect(removed.shots.map((s) => s.id)).toEqual(['shot_2'])
  })

  it('lays a character path with set_path', () => {
    const { next } = applySceneOps(createEmptyScene(), [
      { op: 'add_character', model: 'human' },
      { op: 'set_path', id: 'char_1', points: [[0, 0], [4, 0], [4, 6]],
        times_sec: [0, 2, 5], range: { start: 0, end: 120 }, sync_speed: 1.4 },
    ], ctx)
    const path = next.characters[0].path
    expect(path).toBeDefined()
    expect(path!.range).toEqual({ start: 0, end: 120 })
    expect(path!.syncSpeed).toBeCloseTo(1.4)
    expect(path!.action).toHaveProperty('pathFollow')

    const cleared = applySceneOps(next, [
      { op: 'set_path', id: 'char_1', clear: true },
    ], ctx).next
    expect(cleared.characters[0].path).toBeUndefined()
  })

  it('validates set_path input', () => {
    const base = applySceneOps(createEmptyScene(), [
      { op: 'add_character', model: 'human' },
      { op: 'add_primitive', shape: 'cube' },
    ], ctx).next
    expect(() =>
      applySceneOps(base, [
        { op: 'set_path', id: 'prim_1', points: [[0, 0], [1, 1]] },
      ], ctx)
    ).toThrow(/not a character/)
    expect(() =>
      applySceneOps(base, [{ op: 'set_path', id: 'char_1', points: [[0, 0]] }], ctx)
    ).toThrow(/>= 2 waypoints/)
    expect(() =>
      applySceneOps(base, [
        { op: 'set_path', id: 'char_1', points: [[0, 0], [1, 1]], times_sec: [0] },
      ], ctx)
    ).toThrow(/times_sec/)
  })

  it('manages prompt strips', () => {
    const { next } = applySceneOps(createEmptyScene(), [
      { op: 'add_prompt', start: 0, end: 48, text: 'a chase at dusk' },
      { op: 'add_prompt', start: 48, end: 72 },
      { op: 'patch_prompt', id: 'prompt_2', text: 'the getaway', end: 96 },
    ], ctx)
    expect(next.promptTrack).toEqual([
      { id: 'prompt_1', range: { start: 0, end: 48 }, text: 'a chase at dusk' },
      { id: 'prompt_2', range: { start: 48, end: 96 }, text: 'the getaway' },
    ])
    expect(() =>
      applySceneOps(next, [
        { op: 'patch_prompt', id: 'prompt_1', end: 0 },
      ], ctx)
    ).toThrow(/greater than start/)
    expect(() =>
      applySceneOps(next, [{ op: 'add_prompt', start: 5, end: 5 }], ctx)
    ).toThrow(/greater than start/)
  })

  it('guards structural ops against shot and prompt entries', () => {
    const base = applySceneOps(createEmptyScene(), [
      { op: 'add_camera' },
      { op: 'add_shot', camera_id: 'cam_1' },
      { op: 'add_prompt', start: 0, end: 10 },
    ], ctx).next
    expect(() =>
      applySceneOps(base, [
        { op: 'set_transform', id: 'shot_1', position: [1, 0, 0] },
      ], ctx)
    ).toThrow(/has no transform/)
    expect(() =>
      applySceneOps(base, [{ op: 'set_hidden', id: 'prompt_1' }], ctx)
    ).toThrow(/cannot be hidden/)
    const renamed = applySceneOps(base, [
      { op: 'rename', id: 'shot_1', name: 'Opening' },
    ], ctx).next
    expect(renamed.shots[0].name).toBe('Opening')
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
    ], ctx)).toThrow(/did not resolve to a loadable 3D model/)

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
