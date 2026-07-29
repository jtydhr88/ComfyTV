import '@/tailwind.css'
import '@/style.css'

import { createPinia } from 'pinia'
import { createApp, h } from 'vue'

import MaterialStageCard from '@/components/stages/MaterialStageCard.vue'
import { i18n } from '@/i18n'

const MATERIAL = JSON.stringify({
  version: 1,
  color: '#c8794a',
  metalness: 1,
  roughness: 0.18,
  transmission: 0,
  opacity: 1,
  clearcoat: 0.4,
  clearcoatRoughness: 0.08,
  ior: 1.5,
  emissive: '#000000',
  emissiveIntensity: 0,
})

function makeNode(): any {
  return {
    id: 3,
    properties: {},
    widgets: [
      { name: 'material_state', value: MATERIAL, callback: undefined },
      { name: 'captured_image', value: '', callback: undefined },
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
    h(MaterialStageCard as any, {
      state: {
        kind: 'material', variant: 'default', outputType: 'string',
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
requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(markReady, 900)))
