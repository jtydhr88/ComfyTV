import type { VueWrapper } from '@vue/test-utils'

export const imageSizes = new Map<string, { w: number; h: number }>()

export class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  crossOrigin = ''
  naturalWidth = 0
  naturalHeight = 0
  width = 0
  height = 0
  set src(v: string) {
    const size = imageSizes.get(v) ?? { w: 64, h: 64 }
    queueMicrotask(() => {
      if (v.includes('bad')) {
        this.onerror?.()
        return
      }
      this.naturalWidth = this.width = size.w
      this.naturalHeight = this.height = size.h
      this.onload?.()
    })
  }
}

export async function flushMicro(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve()
}

export function makeNode(layerState = '{}', capturedImage = '') {
  return {
    id: 3,
    widgets: [
      { name: 'layer_state', value: layerState, callback: undefined },
      { name: 'width', value: 1024, callback: undefined },
      { name: 'height', value: 1024, callback: undefined },
      { name: 'captured_image', value: capturedImage, callback: undefined },
      { name: 'captured_images', value: '', callback: undefined },
    ],
    onConfigure: undefined as undefined | ((i: unknown) => void),
  } as any
}

export function widgetVal(node: any, name: string) {
  return node.widgets.find((w: any) => w.name === name).value
}

export function setWidgetVal(node: any, name: string, value: unknown) {
  node.widgets.find((w: any) => w.name === name).value = value
}

export function nodeStorage(node: any) {
  return {
    subfolder: 'comfytv/layer-editor',
    readState: () => String(widgetVal(node, 'layer_state') ?? '{}'),
    writeState: (json: string, width: number, height: number) => {
      setWidgetVal(node, 'layer_state', json)
      setWidgetVal(node, 'width', width)
      setWidgetVal(node, 'height', height)
    },
    readCapturedImage: () => String(widgetVal(node, 'captured_image') ?? ''),
    beginCapture: () => (url: string, stale: boolean) => {
      if (!stale) setWidgetVal(node, 'captured_image', url)
    },
    commitBatch: (json: string) => setWidgetVal(node, 'captured_images', json),
  }
}

export const V1_STATE = JSON.stringify({
  version: 1,
  width: 512,
  height: 256,
  layers: [
    {
      id: 'r1', type: 'raster', name: 'Photo', visible: true, locked: true, opacity: 0.5,
      blendMode: 'multiply', transform: { x: 10, y: 20, w: 100, h: 80, rotation: 0 },
      contentId: 'c-r1', url: 'http://x/r1.png', naturalWidth: 100, naturalHeight: 80,
      mask: { contentId: 'c-m1', url: 'http://x/m1.png', enabled: true },
    },
    {
      id: 't1', type: 'text', name: 'Title', visible: false, locked: false, opacity: 1,
      blendMode: 'source-over', transform: { x: 0, y: 0, w: 200, h: 60, rotation: 0 },
      text: 'hello', fontRef: { kind: 'builtin', id: 'inter' }, fontSize: 48,
      color: '#ffffff', letterSpacing: 0, lineHeight: 1.2, align: 'left',
    },
  ],
})

export function make2dStub(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  return {
    canvas,
    fillStyle: '',
    drawImage: () => {},
    fillRect: () => {},
    fillText: () => {},
    clearRect: () => {},
    putImageData: () => {},
    getImageData: (_x: number, _y: number, w: number, h: number) => new ImageData(w, h),
    createImageData: (w: number, h: number) => new ImageData(w, h),
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
  } as unknown as CanvasRenderingContext2D
}
