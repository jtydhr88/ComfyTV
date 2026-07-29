import '@/tailwind.css'
import '@/style.css'

import { createPinia } from 'pinia'
import { createApp, h } from 'vue'

import ScoreEditorStageCard from '@/components/stages/ScoreEditorStageCard.vue'
import { i18n } from '@/i18n'

const NOTES = JSON.stringify({
  tempo: 120,
  beats_per_bar: 4,
  beat_type: 4,
  bars: 4,
  parts: [
    {
      name: 'Lead',
      program: 'acoustic_grand_piano',
      notes: [
        { midi: 72, start: 0, dur: 0.5, vel: 0.9 },
        { midi: 74, start: 0.5, dur: 0.5, vel: 0.8 },
        { midi: 76, start: 1, dur: 1, vel: 0.85 },
        { midi: 77, start: 2, dur: 0.5, vel: 0.8 },
        { midi: 76, start: 2.5, dur: 0.5, vel: 0.75 },
        { midi: 74, start: 3, dur: 1, vel: 0.8 },
        { midi: 72, start: 4, dur: 0.5, vel: 0.9 },
        { midi: 76, start: 4.5, dur: 0.5, vel: 0.8 },
        { midi: 79, start: 5, dur: 1, vel: 0.9 },
        { midi: 77, start: 6, dur: 0.5, vel: 0.8 },
        { midi: 76, start: 6.5, dur: 0.5, vel: 0.75 },
        { midi: 72, start: 7, dur: 1, vel: 0.85 },
      ],
    },
    {
      name: 'Bass',
      program: 'electric_bass_finger',
      notes: [
        { midi: 48, start: 0, dur: 2, vel: 0.7 },
        { midi: 53, start: 2, dur: 2, vel: 0.7 },
        { midi: 55, start: 4, dur: 2, vel: 0.7 },
        { midi: 48, start: 6, dur: 2, vel: 0.7 },
      ],
    },
  ],
})

function makeNode(): any {
  return {
    id: 1,
    widgets: [{ name: 'notes_json', value: NOTES, callback: undefined }],
    onConfigure: undefined,
  }
}

const container = document.querySelector('#app') as HTMLElement
container.style.cssText = [
  'width:100%', 'height:100%', 'display:flex', 'flex-direction:column',
  'align-items:stretch', 'background:#1e1e1e', 'color:#e0e0e0', 'font-size:12px',
].join(';')

const app = createApp({
  render: () =>
    h(ScoreEditorStageCard as any, {
      state: {
        kind: 'score', variant: 'default', outputType: 'string',
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

function scrollRollToContent(): void {
  const targetY = (127 - 66) * 12
  for (const s of Array.from(
    container.querySelectorAll<HTMLElement>('.ctv-scroll-thin'),
  )) {
    if (s.scrollHeight > s.clientHeight) {
      s.scrollTop = Math.max(0, targetY - s.clientHeight / 2)
    }
  }
}

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    scrollRollToContent()
    requestAnimationFrame(() => {
      scrollRollToContent()
      ;(window as unknown as { uiReady: boolean }).uiReady = true
    })
  })
})
