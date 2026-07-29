import '@/tailwind.css'
import '@/style.css'

import { createApp, h } from 'vue'

import MidiEditorStageCard from '@/components/stages/MidiEditorStageCard.vue'
import { i18n } from '@/i18n'

const EVENTS = JSON.stringify({
  tempo_map: [{ beat: 0, t: 0, bpm: 120 }],
  programs: { '0': 0, '2': 33, '9': 0 },
  events: [
    { t: 0, dur: 0.5, midi: 72, vel: 104, ch: 0 },
    { t: 0.5, dur: 0.5, midi: 76, vel: 96, ch: 0 },
    { t: 1, dur: 0.5, midi: 79, vel: 100, ch: 0 },
    { t: 1.5, dur: 0.5, midi: 84, vel: 110, ch: 0 },
    { t: 2, dur: 0.5, midi: 81, vel: 92, ch: 0 },
    { t: 2.5, dur: 0.5, midi: 79, vel: 90, ch: 0 },
    { t: 3, dur: 1, midi: 76, vel: 96, ch: 0 },
    { t: 0, dur: 1, midi: 60, vel: 88, ch: 2 },
    { t: 1, dur: 1, midi: 64, vel: 84, ch: 2 },
    { t: 2, dur: 1, midi: 67, vel: 86, ch: 2 },
    { t: 3, dur: 1, midi: 60, vel: 88, ch: 2 },
    { t: 0, dur: 0.1, midi: 36, vel: 120, ch: 9 },
    { t: 0.5, dur: 0.1, midi: 42, vel: 90, ch: 9 },
    { t: 1, dur: 0.1, midi: 38, vel: 118, ch: 9 },
    { t: 1.5, dur: 0.1, midi: 42, vel: 90, ch: 9 },
    { t: 2, dur: 0.1, midi: 36, vel: 120, ch: 9 },
    { t: 2.5, dur: 0.1, midi: 42, vel: 90, ch: 9 },
    { t: 3, dur: 0.1, midi: 38, vel: 118, ch: 9 },
    { t: 3.5, dur: 0.1, midi: 42, vel: 90, ch: 9 },
  ],
})

function makeNode(): any {
  return {
    id: 1,
    widgets: [{ name: 'events_json', value: EVENTS, callback: undefined }],
    onConfigure: undefined,
  }
}

const lgNode = document.createElement('div')
lgNode.id = 'lgnode'
lgNode.style.cssText =
  'display:flex;flex-direction:column;align-items:stretch;width:900px;'

const wrapper = document.createElement('div')
wrapper.id = 'domwidget-wrapper'
wrapper.style.cssText = 'display:flex;flex-direction:column;flex:1 1 auto;'

const container = document.createElement('div')
container.className = 'comfytv-root'
container.style.cssText = [
  'width:100%', 'height:100%', 'min-height:640px', 'overflow:auto',
  'background:#1e1e1e', 'color:#e0e0e0', 'font-size:12px',
  'display:flex', 'flex-direction:column', 'align-items:stretch',
  'flex:1 1 0%',
].join(';')

wrapper.appendChild(container)
lgNode.appendChild(wrapper)
document.querySelector('#app')!.appendChild(lgNode)

const app = createApp({
  render: () =>
    h(MidiEditorStageCard as any, {
      state: { inputs: [] },
      node: makeNode(),
      onRunRequest: () => {},
      onCancelRequest: () => {},
      onDisconnect: () => {},
      onAction: () => {},
    }),
})
app.use(i18n)
app.mount(container)

function scrollRollToContent(): void {
  const targetY = (127 - 66) * 12
  const scrollers = Array.from(
    container.querySelectorAll<HTMLElement>('.ctv-scroll-thin'),
  )
  for (const s of scrollers) {
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
