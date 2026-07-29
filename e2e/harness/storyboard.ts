import '@/tailwind.css'
import '@/style.css'

import { createPinia } from 'pinia'
import { createApp, h } from 'vue'

import StoryboardEditorStageCard from '@/components/stages/StoryboardEditorStageCard.vue'
import { i18n } from '@/i18n'

function sketch(kind: number, title: string): string {
  const c = document.createElement('canvas')
  c.width = 640
  c.height = 360
  const g = c.getContext('2d')!
  const skies = ['#8fb8d8', '#f2c48b', '#3a4b6b', '#c98a6b']
  const grounds = ['#4a6741', '#8a6b3a', '#22303f', '#5a3b2a']
  const sky = g.createLinearGradient(0, 0, 0, 240)
  sky.addColorStop(0, skies[kind % skies.length])
  sky.addColorStop(1, '#f7e6c8')
  g.fillStyle = sky
  g.fillRect(0, 0, 640, 240)
  g.fillStyle = '#f6e7bd'
  g.beginPath()
  g.arc(500 - kind * 60, 80, 40, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = grounds[kind % grounds.length]
  g.beginPath()
  g.moveTo(0, 240)
  g.lineTo(180 - kind * 20, 120)
  g.lineTo(340, 240)
  g.closePath()
  g.fill()
  g.beginPath()
  g.moveTo(220, 240)
  g.lineTo(420 + kind * 20, 100)
  g.lineTo(640, 240)
  g.closePath()
  g.fill()
  g.fillStyle = '#2e4a3d'
  g.fillRect(0, 240, 640, 120)
  g.fillStyle = '#111'
  const fx = 120 + kind * 90
  g.beginPath()
  g.arc(fx, 250, 16, 0, Math.PI * 2)
  g.fill()
  g.fillRect(fx - 12, 262, 24, 60)
  g.fillStyle = 'rgba(0,0,0,0.55)'
  g.fillRect(0, 320, 640, 40)
  g.fillStyle = '#fff'
  g.font = '22px sans-serif'
  g.fillText(title, 14, 348)
  return c.toDataURL('image/png')
}

const DOC = {
  version: 1 as const,
  width: 1280,
  height: 720,
  defaultBoardTimingMs: 2000,
  boards: [
    {
      uid: 'SHOT1',
      newShot: true,
      durationMs: 3000,
      dialogue: 'The city wakes beneath a copper sky.',
      action: 'Wide establishing shot, camera pushes in slowly.',
      notes: 'Golden hour',
      scenePurpose: 'Establish mood',
      character: 'Narrator',
      shotSize: 'WS',
      imagePrompt: 'wide cityscape at dawn, copper sky',
      motionPrompt: 'slow dolly in',
      refUrl: null,
      layerState: null,
      compositeUrl: sketch(0, '1A · Wide'),
    },
    {
      uid: 'SHOT2',
      newShot: true,
      durationMs: 2500,
      dialogue: 'She steps into the light.',
      action: 'Medium shot on the hero as she turns.',
      notes: 'Track left',
      scenePurpose: 'Introduce hero',
      character: 'Mira',
      shotSize: 'MS',
      imagePrompt: 'medium shot, hero in warm light',
      motionPrompt: 'track left',
      refUrl: null,
      layerState: null,
      compositeUrl: sketch(1, '1B · Medium'),
    },
    {
      uid: 'SHOT3',
      newShot: true,
      durationMs: 2000,
      dialogue: 'A shadow moves across the hills.',
      action: 'Cut to the ridge line, something approaches.',
      notes: 'Tension beat',
      scenePurpose: 'Raise stakes',
      character: '—',
      shotSize: 'WS',
      imagePrompt: 'silhouette on ridge at dusk',
      motionPrompt: 'static, hold',
      refUrl: null,
      layerState: null,
      compositeUrl: sketch(2, '1C · Ridge'),
    },
    {
      uid: 'SHOT4',
      newShot: true,
      durationMs: 1800,
      dialogue: 'And the chase begins.',
      action: 'Tight close-up, eyes widen.',
      notes: 'Whip pan out',
      scenePurpose: 'Kick off action',
      character: 'Mira',
      shotSize: 'CU',
      imagePrompt: 'extreme close up, determined eyes',
      motionPrompt: 'whip pan',
      refUrl: null,
      layerState: null,
      compositeUrl: sketch(3, '1D · Close'),
    },
  ],
}

function makeNode(): any {
  return {
    id: 7,
    title: 'Storyboard',
    properties: {},
    widgets: [
      { name: 'board_state', value: JSON.stringify(DOC), callback: undefined },
      { name: 'width', value: 1280, callback: undefined },
      { name: 'height', value: 720, callback: undefined },
      { name: 'captured_image', value: '', callback: undefined },
      { name: 'captured_images', value: '', callback: undefined },
      { name: 'animatic_video', value: '', callback: undefined },
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
    h(StoryboardEditorStageCard as any, {
      state: {
        kind: 'storyboard', variant: 'default', outputType: 'string',
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
requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(markReady, 400)))
