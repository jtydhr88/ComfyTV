import '@/tailwind.css'
import '@/style.css'

import { createApp, defineComponent, h } from 'vue'

import LayerEditorCanvas from '@/components/widgets/LayerEditorCanvas.vue'
import LayerEditorToolBar from '@/components/widgets/LayerEditorToolBar.vue'
import LayerEditorToolStrip from '@/components/widgets/LayerEditorToolStrip.vue'
import LayerListPanel from '@/components/widgets/LayerListPanel.vue'
import { useLayerEditorStage, type LayerEditorController } from '@/composables/widgets/useLayerEditorStage'
import { i18n } from '@/i18n'

function makeNode(): any {
  return {
    id: 1,
    widgets: [
      { name: 'layer_state', value: '{}', callback: undefined },
      { name: 'width', value: 1024, callback: undefined },
      { name: 'height', value: 1024, callback: undefined },
      { name: 'captured_image', value: '', callback: undefined },
      { name: 'captured_images', value: '', callback: undefined },
    ],
    onConfigure: undefined,
  }
}

function demoPhoto(): string {
  const c = document.createElement('canvas')
  c.width = 560
  c.height = 380
  const g = c.getContext('2d')!
  const sky = g.createLinearGradient(0, 0, 0, 250)
  sky.addColorStop(0, '#7ec8e3')
  sky.addColorStop(1, '#f7d9a0')
  g.fillStyle = sky
  g.fillRect(0, 0, 560, 250)
  g.fillStyle = '#f4e3b1'
  g.beginPath()
  g.arc(430, 90, 46, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#4a6741'
  g.beginPath()
  g.moveTo(0, 250)
  g.lineTo(130, 130)
  g.lineTo(260, 250)
  g.closePath()
  g.fill()
  g.fillStyle = '#38503a'
  g.beginPath()
  g.moveTo(160, 250)
  g.lineTo(330, 100)
  g.lineTo(520, 250)
  g.closePath()
  g.fill()
  g.fillStyle = '#2e4a5d'
  g.fillRect(0, 250, 560, 130)
  return c.toDataURL('image/png')
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function buildDemo(editor: LayerEditorController): Promise<void> {
  editor.setArtboardSize(1024, 640)

  editor.addFillLayer({
    type: 'linear',
    angle: 90,
    stops: [
      { offset: 0, color: '#20304f' },
      { offset: 1, color: '#c2603a' },
    ],
  })
  const fillId = editor.activeId.value
  if (fillId) editor.renameLayer(fillId, '渐变背景')

  await editor.addImageFromUrl(demoPhoto(), '风景照片')
  await wait(80)
  const photo = editor.layers.value.find((r) => r.node.kind === 'raster')
  if (photo) editor.addMask(photo.node.id)
  editor.paintTarget.value = 'content'

  editor.tool.value = 'shape'
  editor.shapeKind.value = 'ellipse'
  editor.shapeFillEnabled.value = true
  editor.shapeFillColor.value = '#e8b04b'
  await nextFrame()
  const handler = editor.activeToolHandler()
  const ev = { shiftKey: false, pressure: 1 } as unknown as PointerEvent
  handler.onPointerDown(ev, { x: 96, y: 96 })
  handler.onPointerMove(ev, { x: 260, y: 260 })
  handler.onPointerUp(ev, { x: 260, y: 260 })

  const textId = editor.addTextLayerAt({ x: 330, y: 60 })
  editor.updateTextLayer(textId, { text: 'ComfyTV Studio', fontSize: 72, color: '#ffffff' })

  editor.setActiveLayer(textId)
  editor.groupActiveLayer()
  const groupId = editor.activeId.value
  if (groupId) editor.renameLayer(groupId, '标题组')
  const shape = editor.layers.value.find((r) => r.node.kind === 'vector')
  if (shape) {
    editor.moveLayer(shape.node.id, 1)
    editor.setActiveLayer(shape.node.id)
    editor.setOpacity(shape.node.id, 0.85)
  }
  await nextFrame()
  editor.fitView()
  await nextFrame()
}

const Root = defineComponent({
  setup() {
    const editor = useLayerEditorStage(makeNode())
    ;(window as unknown as { editorCtl: LayerEditorController }).editorCtl = editor
    void (async () => {
      await nextFrame()
      try {
        await buildDemo(editor)
      } finally {
        ;(window as unknown as { uiReady: boolean }).uiReady = true
      }
    })()
    return () =>
      h('div', { class: 'ctv:flex ctv:h-full ctv:flex-col ctv:gap-1 ctv:text-xs ctv:text-base-foreground' }, [
        h(LayerEditorToolBar, { editor }),
        h('div', { class: 'ctv:flex ctv:min-h-0 ctv:flex-1 ctv:gap-1' }, [
          h(LayerEditorToolStrip, { editor }),
          h('div', { class: 'ctv:relative ctv:min-w-0 ctv:flex-1' }, [h(LayerEditorCanvas, { editor })]),
          h(LayerListPanel, { editor }),
        ]),
      ])
  },
})

const app = createApp(Root)
app.use(i18n)
app.mount('#app')
