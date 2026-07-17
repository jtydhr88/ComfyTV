import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('@/i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))

const setOutputSlot = vi.hoisted(() => vi.fn())
vi.mock('@/stores/stageStore', () => ({
  useStageStore: () => ({ setOutputSlot })
}))

import { CAMERA_COLORS, TRACK_COLORS } from '@/widgets/three/scene3d/timelineTracks'
import {
  FREE_CAMERA_VALUE,
  useScene3dFullscreen,
  useScene3dOutputSlots,
  useScene3dPanels,
  type Scene3dStage
} from './useScene3dPanels'

function emptyScene() {
  return {
    characters: [] as any[],
    primitives: [] as any[],
    models: [] as any[],
    lights: [] as any[],
    cameras: [] as any[],
    environment: { showGrid: true, background: '', showRoom: false },
    output: { fps: 24, frameCount: 0, cameraId: '' }
  }
}

function makeStage(scene = emptyScene()) {
  return {
    state: ref(scene),
    selectedCharacter: ref(null),
    selectedPrimitive: ref(null),
    selectedLight: ref(null),
    selectedModel: ref(null),
    selectedCamera: ref(null),
    availableModels: ref([{ id: 'human', name: 'Human' }]),
    modelAssets: ref([] as any[]),
    cameraPresets: ref([
      { id: 'p1', name: 'Pan', category: 'Basic', file: 'basic/pan.json' }
    ]),
    lookThroughId: ref<string | null>(null),
    recordProgress: ref<any>(null),
    recordingSupported: true,
    hasRecordableDuration: ref(true),
    buildTimelineData: vi.fn(() => ({ fps: 24, cameras: [], characters: [] })),
    timelineDataVersion: ref(0),
    addCharacter: vi.fn(async () => {}),
    addPrimitive: vi.fn(),
    addModelFromAsset: vi.fn(async () => {}),
    addLight: vi.fn(),
    applyLightPreset: vi.fn(),
    setOutputCamera: vi.fn(),
    updateEnvironment: vi.fn()
  }
}

function panels(stage: ReturnType<typeof makeStage>) {
  return useScene3dPanels(stage as unknown as Scene3dStage)
}

function camera(id: string, presetId: string | null = null, name = '') {
  return {
    id,
    name,
    fov: 50,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 }
    },
    preset: presetId
      ? { presetId, file: 'f.json', tuning: {}, speed: 1 }
      : null
  }
}

function selectEvent(value: string) {
  const target = { value } as HTMLSelectElement
  return { event: { target } as unknown as Event, target }
}

describe('useScene3dFullscreen', () => {
  it('toggles and closes on Escape only while fullscreen', () => {
    const f = useScene3dFullscreen()
    expect(f.fullscreen.value).toBe(false)
    f.toggleFullscreen()
    expect(f.fullscreen.value).toBe(true)

    const stop = vi.fn()
    f.onFullscreenKeydown({ key: 'a', stopPropagation: stop } as unknown as KeyboardEvent)
    expect(f.fullscreen.value).toBe(true)

    f.onFullscreenKeydown({ key: 'Escape', stopPropagation: stop } as unknown as KeyboardEvent)
    expect(f.fullscreen.value).toBe(false)
    expect(stop).toHaveBeenCalledTimes(1)

    f.onFullscreenKeydown({ key: 'Escape', stopPropagation: stop } as unknown as KeyboardEvent)
    expect(stop).toHaveBeenCalledTimes(1)
  })
})

describe('useScene3dOutputSlots', () => {
  function makeNode() {
    return {
      widgets: [
        { name: 'captured_image', value: '/view/img.png' },
        { name: 'captured_video', value: '' },
        { name: 'captured_images', value: '{"images":[]}' }
      ],
      onConfigure: null as unknown
    } as any
  }

  it('mirrors widget values into output slots', () => {
    setOutputSlot.mockClear()
    const node = makeNode()
    const stageState = { id: 's1' } as any
    const { syncOutputSlots } = useScene3dOutputSlots(node, stageState)
    syncOutputSlots()
    expect(setOutputSlot).toHaveBeenNthCalledWith(1, stageState, 0, '/view/img.png')
    expect(setOutputSlot).toHaveBeenNthCalledWith(2, stageState, 1, null)
    expect(setOutputSlot).toHaveBeenNthCalledWith(3, stageState, 2, '{"images":[]}')
  })

  it('prefers explicit urls over widget values', () => {
    setOutputSlot.mockClear()
    const { syncOutputSlots } = useScene3dOutputSlots(makeNode(), {} as any)
    syncOutputSlots('/view/new.png', '/view/new.webm')
    expect(setOutputSlot.mock.calls[0][2]).toBe('/view/new.png')
    expect(setOutputSlot.mock.calls[1][2]).toBe('/view/new.webm')
  })

  it('re-syncs on node configure', () => {
    setOutputSlot.mockClear()
    const node = makeNode()
    useScene3dOutputSlots(node, {} as any)
    node.onConfigure({})
    expect(setOutputSlot).toHaveBeenCalledTimes(3)
  })
})

describe('useScene3dPanels: labels + colors', () => {
  it('derives display labels with name overrides and i18n fallbacks', () => {
    const stage = makeStage()
    const p = panels(stage)

    expect(p.characterDisplayLabel({ name: ' Hero ', model: 'human' } as any)).toBe('Hero')
    expect(p.characterDisplayLabel({ name: '', model: 'human' } as any)).toBe('Human')
    expect(p.characterDisplayLabel({ model: 'unknown' } as any)).toBe('unknown')

    expect(p.primitiveDisplayLabel({ name: '', shape: 'cube' } as any)).toBe('scene3d.cube')
    expect(p.lightDisplayLabel({ name: 'Key', type: 'point' } as any)).toBe('Key')
    expect(p.lightDisplayLabel({ type: 'spot' } as any)).toBe('scene3d.spot')
  })

  it('labels cameras with their preset names', () => {
    const p = panels(makeStage())
    expect(p.cameraLabel(camera('cam_1') as any)).toBe('cam_1')
    expect(p.cameraLabel(camera('cam_1', 'p1') as any)).toBe('cam_1 · Pan')
    expect(p.cameraLabel(camera('cam_1', 'missing') as any)).toBe('cam_1 · missing')
    expect(p.cameraDisplayLabel(camera('cam_1', 'p1', 'My Cam') as any)).toBe('My Cam')
  })

  it('cycles track and camera colors', () => {
    const scene = emptyScene()
    scene.characters = [{ id: 'c1' }, { id: 'c2' }]
    const p = panels(makeStage(scene))
    expect(p.characterColor(0)).toBe(TRACK_COLORS[0])
    expect(p.characterColor(TRACK_COLORS.length)).toBe(TRACK_COLORS[0])
    expect(p.modelColor(0)).toBe(TRACK_COLORS[2])
    expect(p.cameraColor(1)).toBe(CAMERA_COLORS[1])
  })
})

describe('useScene3dPanels: timeline', () => {
  it('recomputes timelineData from the stage builder', () => {
    const stage = makeStage()
    const p = panels(stage)
    expect(p.timelineData.value).toEqual({ fps: 24, cameras: [], characters: [] })
    expect(stage.buildTimelineData).toHaveBeenCalled()
  })

  it('builds the legend from preset cameras, characters, and animated models', () => {
    const scene = emptyScene()
    scene.cameras = [camera('cam_1'), camera('cam_2', 'p1')]
    scene.characters = [{ id: 'char_1', name: '', model: 'human', animation: { clip: 'Walk' } }]
    scene.models = [
      { id: 'model_1', name: 'Robot', animation: { clip: 'Idle' } },
      { id: 'model_2', name: 'Static', animation: { clip: '' } }
    ]
    const p = panels(makeStage(scene))
    expect(p.timelineLegend.value).toEqual([
      { id: 'cam_2', label: 'cam_2 · Pan', color: CAMERA_COLORS[1] },
      { id: 'char_1', label: 'Human', color: TRACK_COLORS[0] },
      { id: 'model_1', label: 'Robot', color: TRACK_COLORS[1] }
    ])
  })
})

describe('useScene3dPanels: gizmo guards', () => {
  it('disables all gizmos for lights and look-through cameras', () => {
    const stage = makeStage()
    const p = panels(stage)
    expect(p.allGizmoDisabled.value).toBe(false)
    expect(p.gizmoModeDisabled('translate')).toBe(false)
    expect(p.gizmoDisabledHint.value).toBeUndefined()

    stage.selectedLight.value = { id: 'light_1' } as any
    expect(p.allGizmoDisabled.value).toBe(true)
    expect(p.gizmoModeDisabled('translate')).toBe(true)
    expect(p.gizmoDisabledHint.value).toBe('scene3d.lightGizmoHint')
  })

  it('restricts camera gizmos by mode, preset, and look-through', () => {
    const stage = makeStage()
    const p = panels(stage)
    stage.selectedCamera.value = camera('cam_1', 'p1') as any

    expect(p.gizmoModeDisabled('scale')).toBe(true)
    expect(p.gizmoModeDisabled('rotate')).toBe(true)
    expect(p.gizmoModeDisabled('translate')).toBe(false)
    expect(p.gizmoDisabledHint.value).toBe('scene3d.cameraPresetGizmoHint')

    stage.selectedCamera.value = camera('cam_1') as any
    expect(p.gizmoModeDisabled('rotate')).toBe(false)

    stage.lookThroughId.value = 'cam_1'
    expect(p.gizmoModeDisabled('translate')).toBe(true)
    expect(p.allGizmoDisabled.value).toBe(true)
    expect(p.gizmoDisabledHint.value).toBe('scene3d.lookThroughGizmoHint')
  })
})

describe('useScene3dPanels: output camera + summary', () => {
  it('offers the free camera plus scene cameras', () => {
    const scene = emptyScene()
    scene.cameras = [camera('cam_1', 'p1')]
    const stage = makeStage(scene)
    const p = panels(stage)
    expect(p.outputCameraOptions.value).toEqual([
      { value: FREE_CAMERA_VALUE, label: 'scene3d.freeCamera' },
      { value: 'cam_1', label: 'cam_1 · Pan' }
    ])
    p.onSetOutputCamera(FREE_CAMERA_VALUE)
    expect(stage.setOutputCamera).toHaveBeenCalledWith('')
    p.onSetOutputCamera('cam_1')
    expect(stage.setOutputCamera).toHaveBeenCalledWith('cam_1')
  })

  it('summarizes the current selection by priority', () => {
    const stage = makeStage()
    const p = panels(stage)
    expect(p.objectsSummary.value).toBe('scene3d.noSelection')

    stage.selectedCamera.value = camera('cam_1') as any
    expect(p.objectsSummary.value).toBe('cam_1')

    stage.selectedModel.value = { id: 'model_1', name: 'Robot' } as any
    expect(p.objectsSummary.value).toBe('Robot')

    stage.selectedLight.value = { type: 'point' } as any
    expect(p.objectsSummary.value).toBe('scene3d.point')

    stage.selectedPrimitive.value = { shape: 'cube' } as any
    expect(p.objectsSummary.value).toBe('scene3d.cube')

    stage.selectedCharacter.value = { name: 'Hero', model: 'human' } as any
    expect(p.objectsSummary.value).toBe('Hero')
  })
})

describe('useScene3dPanels: record labels', () => {
  it('shows frame progress while rendering', () => {
    const stage = makeStage()
    const p = panels(stage)
    expect(p.recordingLabel.value).toBe('scene3d.recording')
    stage.recordProgress.value = { status: 'rendering', frame: 4, totalFrames: 48 }
    expect(p.recordingLabel.value).toBe('5 / 48')
    stage.recordProgress.value = { status: 'encoding' }
    expect(p.recordingLabel.value).toBe('scene3d.recording')
  })

  it('explains why recording is unavailable', () => {
    const stage = makeStage()
    const p = panels(stage)
    expect(p.recordTitle.value).toBe('scene3d.record')
    stage.hasRecordableDuration.value = false
    expect(p.recordTitle.value).toBe('scene3d.noDurationToRecord')

    const unsupported = makeStage()
    ;(unsupported as any).recordingSupported = false
    expect(panels(unsupported).recordTitle.value).toBe('scene3d.webcodecsUnsupported')
  })
})

describe('useScene3dPanels: add handlers', () => {
  it('adds a character and resets the select', () => {
    const stage = makeStage()
    const p = panels(stage)
    const { event, target } = selectEvent('human')
    p.onAddCharacter(event)
    expect(stage.addCharacter).toHaveBeenCalledWith('human')
    expect(target.value).toBe('')

    p.onAddCharacter(selectEvent('').event)
    expect(stage.addCharacter).toHaveBeenCalledTimes(1)
  })

  it('adds a model by asset id', () => {
    const stage = makeStage()
    const asset = { id: 3, name: 'Robot' }
    stage.modelAssets.value = [asset]
    const p = panels(stage)
    p.onAddModel(selectEvent('3').event)
    expect(stage.addModelFromAsset).toHaveBeenCalledWith(asset)

    p.onAddModel(selectEvent('99').event)
    expect(stage.addModelFromAsset).toHaveBeenCalledTimes(1)
  })

  it('adds primitives, lights, and presets', () => {
    const stage = makeStage()
    const p = panels(stage)
    p.onAddPrimitive(selectEvent('cube').event)
    expect(stage.addPrimitive).toHaveBeenCalledWith('cube')
    p.onAddPrimitive(selectEvent('').event)
    expect(stage.addPrimitive).toHaveBeenCalledTimes(1)

    p.onAddLight(selectEvent('spot').event)
    expect(stage.addLight).toHaveBeenCalledWith('spot')

    p.onApplyLightPreset(selectEvent('studio').event)
    expect(stage.applyLightPreset).toHaveBeenCalledWith('studio')
    p.onApplyLightPreset(selectEvent('').event)
    expect(stage.applyLightPreset).toHaveBeenCalledTimes(1)
  })

  it('forwards background color input to the environment', () => {
    const stage = makeStage()
    const p = panels(stage)
    p.onBackgroundInput({ target: { value: '#ff0000' } } as unknown as Event)
    expect(stage.updateEnvironment).toHaveBeenCalledWith({ background: '#ff0000' })
  })
})
