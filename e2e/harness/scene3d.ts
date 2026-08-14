import '@/tailwind.css'
import '@/style.css'

import { createPinia } from 'pinia'
import { createApp, h } from 'vue'

import Scene3DStageCard from '@/components/stages/Scene3DStageCard.vue'
import { i18n } from '@/i18n'
import { buildPathActionJson } from '@/widgets/three/scene3d/pathStrip'

const SCENE = JSON.stringify({
  version: 2,
  characters: [
    {
      id: 'char_1',
      model: 'regular_f',
      name: 'Walker',
      color: '#e84a6f',
      animation: { clip: 'Walk_Loop', speed: 1, loop: true, startOffset: 0 },
      path: {
        action: buildPathActionJson(
          [
            [-3, 0, 2.5],
            [1.5, 0, 2.2],
            [2.6, 0, -1.8],
            [-2.2, 0, -2.4],
          ],
          [0, 4, 9, 15]
        ),
        range: { start: 0, end: 480 },
        syncSpeed: 1.4,
      },
      transform: {
        position: { x: 0, y: 0, z: 0 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    },
  ],
  primitives: [
    {
      id: 'prim_1',
      shape: 'cube',
      color: '#6aa0ff',
      name: 'Hero Cube',
      transform: {
        position: { x: -1, y: 0.5, z: 0 },
        quaternion: { x: 0, y: 0.2, z: 0, w: 0.98 },
        scale: { x: 1, y: 1, z: 1 },
      },
    },
    {
      id: 'prim_2',
      shape: 'sphere',
      color: '#ff8f5a',
      name: 'Accent Sphere',
      transform: {
        position: { x: 1.1, y: 0.6, z: 0.4 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1.2, y: 1.2, z: 1.2 },
      },
    },
    {
      id: 'prim_3',
      shape: 'cylinder',
      color: '#8fe08f',
      name: 'Pillar',
      transform: {
        position: { x: 0.1, y: 0.7, z: -1.4 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 0.6, y: 1.4, z: 0.6 },
      },
    },
  ],
  models: [],
  lights: [
    {
      id: 'light_1',
      type: 'directional',
      name: 'Key',
      color: '#fff2d8',
      intensity: 2.4,
      position: { x: 3, y: 5, z: 3 },
      target: { x: 0, y: 0, z: 0 },
    },
    {
      id: 'light_2',
      type: 'point',
      name: 'Fill',
      color: '#88aaff',
      intensity: 6,
      position: { x: -3, y: 2, z: 2 },
      range: 0,
    },
  ],
  cameras: [
    {
      id: 'cam_1',
      name: 'Shot Cam',
      fov: 45,
      transform: {
        position: { x: 4, y: 2.6, z: 4.4 },
        quaternion: { x: -0.06, y: 0.38, z: 0.02, w: 0.92 },
      },
      preset: null,
    },
    {
      id: 'cam_2',
      name: 'High Cam',
      fov: 40,
      transform: {
        position: { x: -3, y: 5, z: -3 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
      },
      preset: null,
    },
  ],
  shots: [
    { id: 'shot_1', name: 'Wide', durFrames: 48, cameraId: 'cam_1' },
    {
      id: 'shot_2',
      name: 'High Lock',
      durFrames: 480,
      cameraId: 'cam_2',
      lock: 'char_1',
    },
  ],
  promptTrack: [
    {
      id: 'prompt_1',
      range: { start: 0, end: 48 },
      text: 'a lone figure crosses a quiet plaza at dusk',
    },
  ],
  environment: { showGrid: true, background: '#1b1f2a', showRoom: false },
  output: { fps: 24, frameCount: 0, cameraId: 'cam_1' },
})

function makeNode(): any {
  return {
    id: 5,
    properties: {},
    widgets: [
      { name: 'scene_state', value: SCENE, callback: undefined },
      { name: 'channel', value: 'color', callback: undefined },
      { name: 'width', value: 768, callback: undefined },
      { name: 'height', value: 432, callback: undefined },
      { name: 'captured_image', value: '', callback: undefined },
      { name: 'captured_images', value: '', callback: undefined },
      { name: 'captured_video', value: '', callback: undefined },
    ],
    onConfigure: undefined,
  }
}

const container = document.querySelector('#app') as HTMLElement
container.style.cssText = [
  'width:100%', 'height:100%', 'display:flex', 'flex-direction:column',
  'align-items:stretch', 'background:#141414', 'color:#e0e0e0', 'font-size:12px',
].join(';')

const app = createApp({
  render: () =>
    h(Scene3DStageCard as any, {
      state: {
        kind: 'scene3d', variant: 'default', outputType: 'string',
        output: null, outputs: [], running: false, inputs: [], mainPrompt: '',
      },
      node: makeNode(),
      onRunRequest: () => {},
      onCancelRequest: () => {},
      onDisconnect: () => {},
      onAction: () => {},
    }),
})
app.use(createPinia())
app.use(i18n)
app.mount(container)

function markReady(): void {
  ;(window as unknown as { uiReady: boolean }).uiReady = true
}
requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(markReady, 1200)))
