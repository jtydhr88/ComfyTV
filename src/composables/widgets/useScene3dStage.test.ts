import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Scene3dViewportEvents } from '@/widgets/three/scene3d/Scene3dViewport'

vi.mock('@/i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))

const assetStoreState = {
  assets: [] as Array<Record<string, unknown>>,
  ensureHydrated: vi.fn(),
  installWebSocketSync: vi.fn()
}
vi.mock('@/stores/assetStore', () => ({
  useAssetStore: () => assetStoreState
}))

vi.mock('@/widgets/three/scene3d/scene3dAssets', () => ({
  fetchScene3dManifest: vi.fn(async () => [
    { id: 'human', name: 'Human' },
    { id: 'fox', name: 'Fox' }
  ]),
  getCharacterClipNames: vi.fn(async () => ['Walk', 'Run']),
  getCustomModelClipNames: vi.fn(async () => ['Idle'])
}))

vi.mock('@/widgets/three/load3d/cameraPresetAssets', () => ({
  fetchCameraPresetManifest: vi.fn(async () => [
    { id: 'p1', name: 'Pan', category: 'Basic', file: 'basic/pan.json' },
    { id: 'p2', name: 'Zoom', category: 'Basic', file: 'basic/zoom.json' }
  ])
}))

const captureSceneImages = vi.fn(
  async (): Promise<Array<{ cameraId: string | null; blob: Blob }>> => [
    { cameraId: null, blob: new Blob(['x']) }
  ]
)
vi.mock('@/widgets/three/scene3d/capture/SceneImageCapture', () => ({
  captureSceneImages: (...a: unknown[]) => captureSceneImages(...(a as []))
}))

const recordFn = vi.fn(async () => new Blob(['v']))
vi.mock('@/widgets/three/scene3d/capture/SceneVideoRecorder', () => ({
  SceneVideoRecorder: class {
    record = recordFn
  },
  isVideoRecordingSupported: () => true
}))

const uploadBlobNamed = vi.fn(async (_blob: Blob, opts: { filename: string }) => ({
  url: `/view/${opts.filename}`
}))
vi.mock('@/utils/uploadCanvas', () => ({
  uploadBlobNamed: (...a: unknown[]) => uploadBlobNamed(...(a as [Blob, { filename: string }]))
}))

let capturedEvents: Scene3dViewportEvents
let listeners: Record<string, (d: unknown) => void>
let viewport: any

function makeViewport() {
  listeners = {}
  return {
    setGizmoMode: vi.fn(),
    setPreviewChannel: vi.fn(),
    setPipCamera: vi.fn(),
    setTimelinePlayIntent: vi.fn(),
    setSelected: vi.fn(),
    setLookThroughCamera: vi.fn(),
    refreshViewport: vi.fn(),
    updateStatusMouseOnScene: vi.fn(),
    updateStatusMouseOnNode: vi.fn(),
    remove: vi.fn(),
    applyState: vi.fn(async () => {}),
    getEditorCameraPose: vi.fn(() => ({
      position: { x: 1, y: 2, z: 3 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      fov: 55
    })),
    addEventListener: vi.fn((evt: string, cb: (d: unknown) => void) => {
      listeners[evt] = cb
    }),
    timelineController: {
      getFps: () => 24,
      togglePlayPause: vi.fn(),
      seekToFrame: vi.fn(),
      setLoopPlayback: vi.fn(),
      totalDuration: 2
    },
    sceneCameraManager: {
      getPresetInfo: vi.fn(() => ({ frameCount: 100, fps: 24 })),
      maxPresetDuration: vi.fn(() => 4)
    },
    characterManager: {
      getClipDuration: vi.fn(() => 1.5),
      clipDurations: vi.fn(() => new Map())
    },
    customModelManager: {
      getClipDuration: vi.fn(() => 2),
      clipDurations: vi.fn(() => new Map())
    }
  }
}

const createScene3dViewport = vi.fn(
  (_c: HTMLElement, events: Scene3dViewportEvents) => {
    capturedEvents = events
    viewport = makeViewport()
    return viewport
  }
)
vi.mock('@/widgets/three/scene3d/createScene3dViewport', () => ({
  createScene3dViewport: (...a: unknown[]) =>
    createScene3dViewport(...(a as [HTMLElement, Scene3dViewportEvents]))
}))

import { useScene3dStage } from './useScene3dStage'

function makeNode(sceneState = '{}') {
  return {
    id: 7,
    widgets: [
      { name: 'scene_state', value: sceneState, callback: undefined },
      { name: 'channel', value: 'color', callback: undefined },
      { name: 'width', value: 1024, callback: undefined },
      { name: 'height', value: 1024, callback: undefined },
      { name: 'captured_image', value: '', callback: undefined },
      { name: 'captured_images', value: '', callback: undefined },
      { name: 'captured_video', value: '', callback: undefined }
    ],
    properties: {} as Record<string, unknown>,
    onConfigure: undefined as undefined | ((i: unknown) => void)
  } as any
}

function widgetVal(node: any, name: string) {
  return node.widgets.find((w: any) => w.name === name).value
}

async function withScene() {
  const node = makeNode()
  const onCaptured = vi.fn()
  const onRecorded = vi.fn()
  const s = useScene3dStage(node, { onCaptured, onRecorded })
  s.initScene(document.createElement('div'))
  await Promise.resolve()
  await Promise.resolve()
  return { node, s, onCaptured, onRecorded }
}

beforeEach(() => {
  vi.clearAllMocks()
  assetStoreState.assets = []
})

describe('useScene3dStage: setup + object add/remove', () => {
  it('starts empty and adds primitives, lights, cameras', async () => {
    const { node, s } = await withScene()
    expect(s.state.value.primitives).toHaveLength(0)

    s.addPrimitive('cube')
    expect(s.state.value.primitives).toHaveLength(1)
    expect(s.selectedPrimitive.value?.shape).toBe('cube')

    s.addLight('point')
    expect(s.state.value.lights).toHaveLength(1)
    expect(s.selectedLight.value?.type).toBe('point')

    s.addCamera()
    expect(s.state.value.cameras).toHaveLength(1)
    expect(s.outputCameraId.value).toBe(s.state.value.cameras[0].id)
    expect(JSON.parse(widgetVal(node, 'scene_state')).cameras).toHaveLength(1)
  })

  it('adds a character and a custom model with their first clip', async () => {
    const { s } = await withScene()
    await s.addCharacter('human')
    expect(s.state.value.characters).toHaveLength(1)
    expect(s.state.value.characters[0].animation.clip).toBe('Walk')

    assetStoreState.assets = [
      { id: 1, name: 'Robot', media_type: 'model', payload_url: '/view/robot.glb' }
    ]
    expect(s.modelAssets.value).toHaveLength(1)
    await s.addModelFromAsset(assetStoreState.assets[0] as any)
    expect(s.state.value.models).toHaveLength(1)
    expect(s.state.value.models[0].animation.clip).toBe('Idle')
  })

  it('applies a light preset and removes the selected object', async () => {
    const { s } = await withScene()
    s.applyLightPreset('studio' as any)
    const lightCount = s.state.value.lights.length
    expect(lightCount).toBeGreaterThan(0)

    s.addPrimitive('sphere')
    const id = s.selectedId.value!
    s.removeSelected()
    expect(s.state.value.primitives.find((p) => p.id === id)).toBeUndefined()
  })
})

describe('useScene3dStage: rename + hide', () => {
  it('renames across object kinds and toggles hidden', async () => {
    const { s } = await withScene()
    s.addPrimitive('cube')
    const id = s.selectedId.value!

    s.renameObject(id, '  Box  ')
    expect(s.state.value.primitives[0].name).toBe('Box')
    s.renameObject(id, '')
    expect(s.state.value.primitives[0].name).toBeFalsy()

    s.toggleObjectHidden(id)
    expect(s.state.value.primitives[0].hidden).toBe(true)
    s.toggleObjectHidden(id)
    expect(s.state.value.primitives[0].hidden).toBeFalsy()

    s.renameObject('nope', 'x')
    s.toggleObjectHidden('nope')
  })
})

describe('useScene3dStage: cameras + presets', () => {
  it('binds/unbinds presets, tunes, fov, speed, output, look-through, pip', async () => {
    const { s } = await withScene()
    s.addCamera()
    const id = s.state.value.cameras[0].id

    s.bindCameraPreset(id, 'p1')
    expect(s.state.value.cameras[0].preset?.presetId).toBe('p1')
    expect(s.state.value.cameras[0].preset?.file).toBe('basic/pan.json')

    s.updateCameraTuning(id, { positionOffset: { x: 1, y: 2, z: 3 } })
    expect(s.state.value.cameras[0].preset?.tuning.positionOffset).toEqual({
      x: 1,
      y: 2,
      z: 3
    })

    s.setCameraSpeedById(id, 2)
    expect(s.state.value.cameras[0].preset?.speed).toBe(2)

    s.bindCameraPreset(id, null)
    expect(s.state.value.cameras[0].preset).toBeNull()

    s.setCameraFov(id, 30)
    expect(s.state.value.cameras[0].fov).toBe(30)
    s.setCameraFov(id, 999)
    expect(s.state.value.cameras[0].fov).toBe(140)
    s.setCameraFov(id, NaN)
    expect(s.state.value.cameras[0].fov).toBe(140)

    s.setOutputCamera('')
    expect(s.outputCameraId.value).toBe('')

    expect(s.lookThroughId.value).toBe(id)
    s.toggleLookThrough(id)
    expect(s.lookThroughId.value).toBeNull()
    s.toggleLookThrough(id)
    expect(s.lookThroughId.value).toBe(id)
    expect(viewport.setLookThroughCamera).toHaveBeenCalledWith(id)

    expect(s.pipCameraId.value).toBe(id)
    s.setPipCamera(null)
    expect(s.pipCameraId.value).toBeNull()
  })

  it('binding an unknown preset id is a no-op', async () => {
    const { s } = await withScene()
    s.addCamera()
    const id = s.state.value.cameras[0].id
    s.bindCameraPreset(id, 'does-not-exist')
    expect(s.state.value.cameras[0].preset).toBeNull()
  })
})

describe('useScene3dStage: viewport transform + offset commits', () => {
  it('routes transform commits to light / camera / character', async () => {
    const { s } = await withScene()
    s.addLight('directional')
    const lightId = s.selectedId.value!
    capturedEvents.onTransformCommit(lightId, {
      position: { x: 5, y: 6, z: 7 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    })
    expect(s.state.value.lights[0].position).toEqual({ x: 5, y: 6, z: 7 })

    s.addCamera()
    const camId = s.state.value.cameras[0].id
    s.bindCameraPreset(camId, 'p1')
    capturedEvents.onTransformCommit(camId, {
      position: { x: 1, y: 1, z: 1 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    })
    expect(s.state.value.cameras[0].preset).toBeNull()
    expect(s.state.value.cameras[0].transform.position).toEqual({
      x: 1,
      y: 1,
      z: 1
    })

    await s.addCharacter('human')
    const charId = s.selectedId.value!
    capturedEvents.onTransformCommit(charId, {
      position: { x: 2, y: 0, z: 2 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    })
    expect(s.state.value.characters[0].transform.position).toEqual({
      x: 2,
      y: 0,
      z: 2
    })
  })

  it('offset commit updates the preset positionOffset', async () => {
    const { s } = await withScene()
    s.addCamera()
    const camId = s.state.value.cameras[0].id
    s.bindCameraPreset(camId, 'p1')
    capturedEvents.onCameraOffsetCommit(camId, { x: 4, y: 5, z: 6 })
    expect(s.state.value.cameras[0].preset?.tuning.positionOffset).toEqual({
      x: 4,
      y: 5,
      z: 6
    })
  })

  it('onSelectCharacter selects and onLightChange patches', async () => {
    const { s } = await withScene()
    s.addLight('spot')
    const id = s.selectedId.value!
    capturedEvents.onSelectCharacter(null)
    expect(s.selectedId.value).toBeNull()
    capturedEvents.onLightChange(id, { intensity: 42 })
    expect(s.state.value.lights[0].intensity).toBe(42)
  })
})

describe('useScene3dStage: environment, gizmo, animation, output', () => {
  it('updates environment and gizmo mode', async () => {
    const { s } = await withScene()
    s.updateEnvironment({ showRoom: true, background: '#222222' })
    expect(s.state.value.environment.showRoom).toBe(true)
    expect(s.state.value.environment.background).toBe('#222222')

    s.setGizmoMode('translate')
    expect(s.gizmoMode.value).toBe('translate')
    expect(viewport.setGizmoMode).toHaveBeenCalledWith('translate')
  })

  it('updates selected character animation and by id', async () => {
    const { s } = await withScene()
    await s.addCharacter('human')
    s.updateSelectedAnimation({ loop: false, speed: 2 })
    expect(s.state.value.characters[0].animation.loop).toBe(false)
    expect(s.state.value.characters[0].animation.speed).toBe(2)

    const id = s.state.value.characters[0].id
    s.updateCharacterAnimationById(id, { startOffset: 1 })
    expect(s.state.value.characters[0].animation.startOffset).toBe(1)
  })

  it('updates primitive color and light patch through selection', async () => {
    const { s } = await withScene()
    s.addPrimitive('cube')
    s.updateSelectedPrimitive({ color: '#ff0000' })
    expect(s.state.value.primitives[0].color).toBe('#ff0000')

    s.addLight('point')
    s.updateSelectedLight({ intensity: 9 })
    expect(s.state.value.lights[0].intensity).toBe(9)
  })

  it('writes output settings to the hidden widgets', async () => {
    const { node, s } = await withScene()
    s.setOutputSize(2048, 512)
    expect(s.outputWidth.value).toBe(2048)
    expect(s.outputHeight.value).toBe(512)
    expect(widgetVal(node, 'width')).toBe(2048)

    s.setChannel('depth')
    expect(s.channel.value).toBe('depth')
    expect(widgetVal(node, 'channel')).toBe('depth')

    s.setOutputFps(30)
    expect(s.state.value.output.fps).toBe(30)
    s.setOutputFrameCount(48)
    expect(s.state.value.output.frameCount).toBe(48)
    s.setOutputFps(null)
    s.setOutputSize(null, null)
    expect(s.state.value.output.fps).toBe(30)
  })
})

describe('useScene3dStage: capture, record, timeline', () => {
  it('captures a frame and stores the image url', async () => {
    const { node, s, onCaptured } = await withScene()
    await s.capture()
    expect(uploadBlobNamed).toHaveBeenCalled()
    expect(s.capturedImageUrl.value).toContain('/view/')
    expect(widgetVal(node, 'captured_image')).toContain('/view/')
    expect(onCaptured).toHaveBeenCalled()
  })

  it('records a video when there is recordable duration', async () => {
    const { node, s, onRecorded } = await withScene()
    s.setOutputFrameCount(24)
    expect(s.hasRecordableDuration.value).toBe(true)
    await s.record()
    expect(recordFn).toHaveBeenCalled()
    expect(s.capturedVideoUrl.value).toContain('/view/')
    expect(widgetVal(node, 'captured_video')).toContain('/view/')
    expect(onRecorded).toHaveBeenCalled()
  })

  it('builds timeline data from preset cameras and characters', async () => {
    const { s } = await withScene()
    s.addCamera()
    s.bindCameraPreset(s.state.value.cameras[0].id, 'p1')
    await s.addCharacter('human')
    const data = s.buildTimelineData()
    expect(data).not.toBeNull()
    expect(data!.cameras).toHaveLength(1)
    expect(data!.characters).toHaveLength(1)
    expect(data!.fps).toBe(24)
  })

  it('timeline handlers delegate to the controller', async () => {
    const { s } = await withScene()
    s.handleTimelineTogglePlay()
    expect(viewport.timelineController.togglePlayPause).toHaveBeenCalled()
    s.handleTimelineSeek(12)
    expect(viewport.timelineController.seekToFrame).toHaveBeenCalledWith(12)
    s.timelineLoop.value = false
    await Promise.resolve()
    expect(viewport.timelineController.setLoopPlayback).toHaveBeenCalledWith(
      false
    )
  })

  it('persists play state on timelineStateChange and tracks frame', async () => {
    const { node, s } = await withScene()
    listeners.timelineTimeUpdate({ frame: 9, time: 0.4 })
    expect(s.timelineFrame.value).toBe(9)

    listeners.timelineStateChange({ playing: false, loop: true })
    expect(s.timelinePlaying.value).toBe(false)
    expect(node.properties.comfytv_scene3d_editor.timelinePlaying).toBe(false)
    expect(viewport.setTimelinePlayIntent).toHaveBeenCalledWith(false)

    listeners.timelineDurationChange({})
    expect(s.timelineDataVersion.value).toBeGreaterThan(0)
  })
})

describe('useScene3dStage: edge cases', () => {
  it('buildTimelineData is null before the viewport exists', () => {
    const s = useScene3dStage(makeNode())
    expect(s.buildTimelineData()).toBeNull()
  })

  it('record is skipped with no recordable duration', async () => {
    const { s } = await withScene()
    expect(s.hasRecordableDuration.value).toBe(false)
    await s.record()
    expect(recordFn).not.toHaveBeenCalled()
  })

  it('capture failure is caught and clears the capturing flag', async () => {
    const { s } = await withScene()
    captureSceneImages.mockImplementationOnce(async () => {
      throw new Error('nope')
    })
    await s.capture()
    expect(s.capturing.value).toBe(false)
    expect(s.capturedImageUrl.value).toBe('')
  })

  it('multi-camera capture emits one shot per camera into captured_images', async () => {
    const { node, s } = await withScene()
    s.addCamera()
    s.addCamera()
    captureSceneImages.mockImplementationOnce(async () => [
      { cameraId: 'cam_1', blob: new Blob(['a']) },
      { cameraId: 'cam_2', blob: new Blob(['b']) }
    ])
    await s.capture()
    const batch = JSON.parse(widgetVal(node, 'captured_images'))
    expect(batch.images).toHaveLength(2)
  })

  it('selecting the same object is a no-op', async () => {
    const { s } = await withScene()
    s.addPrimitive('cube')
    const id = s.selectedId.value!
    viewport.setSelected.mockClear()
    s.selectObject(id)
    expect(viewport.setSelected).not.toHaveBeenCalled()
  })
})

describe('useScene3dStage: node lifecycle', () => {
  it('reloads on configure and reacts to external widget writes', async () => {
    const { node, s } = await withScene()
    s.addPrimitive('cube')
    expect(s.state.value.primitives).toHaveLength(1)

    const fresh = JSON.stringify({
      version: 1,
      characters: [],
      primitives: [{ id: 'prim_1', shape: 'sphere', color: '#9aa0a6' }],
      models: [],
      lights: [],
      cameras: [],
      environment: { showGrid: true, background: '', showRoom: false },
      output: { fps: 24, frameCount: 0, cameraId: '' }
    })
    const w = node.widgets.find((x: any) => x.name === 'scene_state')
    w.value = fresh
    w.callback(fresh)
    expect(s.state.value.primitives[0].shape).toBe('sphere')

    node.onConfigure({})
    expect(viewport.setPipCamera).toHaveBeenCalled()
  })

  it('handles mouse enter/leave and cleanup', async () => {
    const { s } = await withScene()
    s.handleMouseEnter()
    expect(viewport.updateStatusMouseOnScene).toHaveBeenCalledWith(true)
    s.handleMouseLeave()
    expect(viewport.updateStatusMouseOnScene).toHaveBeenCalledWith(false)
    s.cleanup()
    expect(viewport.remove).toHaveBeenCalled()
  })

  it('surfaces init failures without throwing', () => {
    createScene3dViewport.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const node = makeNode()
    const s = useScene3dStage(node)
    expect(() => s.initScene(document.createElement('div'))).not.toThrow()
  })
})
