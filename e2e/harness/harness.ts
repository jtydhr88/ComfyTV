import {
  blendComposite,
  createEditor,
  createWebGLCompositor,
  defaultMode,
  emptyDocument,
  linearToSrgb,
  rasterKind,
  registerBuiltinKinds,
  registerBuiltinTools,
  resolveMode,
  srgbToLinear,
  type BlendFn,
  type CompositeInput,
  type RGBA,
} from '@/widgets/layerEditor/engine'

const W = 64
const H = 64
const RECT = { x: 0, y: 0, w: W, h: H }

type Px = [number, number, number, number]

function solid(color: Px): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.clearRect(0, 0, W, H)
  g.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${color[3] / 255})`
  g.fillRect(0, 0, W, H)
  return c
}

function topHalf(color: Px): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.clearRect(0, 0, W, H)
  g.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`
  g.fillRect(0, 0, W, H / 2)
  return c
}

const toLinear = (p: Px): RGBA => [srgbToLinear(p[0] / 255), srgbToLinear(p[1] / 255), srgbToLinear(p[2] / 255), p[3] / 255]

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

function encode(res: RGBA): Px {
  return [
    Math.round(linearToSrgb(clamp01(res[0])) * 255),
    Math.round(linearToSrgb(clamp01(res[1])) * 255),
    Math.round(linearToSrgb(clamp01(res[2])) * 255),
    Math.round(clamp01(res[3]) * 255),
  ]
}

function pixel(img: ImageData, x: number, y: number): Px {
  const i = (y * img.width + x) * 4
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]]
}

function maxDiff(a: Px, b: Px): number {
  return Math.max(...a.map((v, i) => Math.abs(v - b[i])))
}

function inputOf(canvas: HTMLCanvasElement, blend: BlendFn, opacity: number): CompositeInput {
  return { texture: { source: canvas, rect: RECT, linear: false }, opacity, mode: resolveMode(defaultMode(blend)) }
}

function run() {
  const comp = createWebGLCompositor()
  const glOk = comp.init({ width: W, height: H })
  if (!glOk) return { glOk: false }

  const BACKDROP: Px = [80, 140, 60, 255]
  const TOP: Px = [200, 60, 120, 255]
  const bd = solid(BACKDROP)
  const top = solid(TOP)

  const MODES: BlendFn[] = [
    'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
    'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference',
    'exclusion', 'hue', 'saturation', 'color', 'luminosity',
  ]

  const modes = MODES.map((blend) => {
    comp.composite([inputOf(bd, 'normal', 1), inputOf(top, blend, 1)], null)
    const got = pixel(comp.readback(), W / 2, H / 2)

    const expected = encode(blendComposite(resolveMode(defaultMode(blend)), toLinear(BACKDROP), toLinear(TOP), 1))
    return { blend, got, expected, maxDiff: maxDiff(got, expected) }
  })

  const topA = solid([TOP[0], TOP[1], TOP[2], 128])
  comp.composite([inputOf(bd, 'normal', 1), inputOf(topA, 'normal', 1)], null)
  const alphaGot = pixel(comp.readback(), W / 2, H / 2)
  const alphaExp = encode(blendComposite(resolveMode(defaultMode('normal')), toLinear(BACKDROP), toLinear([TOP[0], TOP[1], TOP[2], 128]), 1))
  const alphaDiff = maxDiff(alphaGot, alphaExp)

  const red = solid([220, 40, 40, 255])
  const greenTop = topHalf([40, 200, 40])
  comp.composite([inputOf(red, 'normal', 1), inputOf(greenTop, 'normal', 1)], null)
  const oimg = comp.readback()
  const upper = pixel(oimg, W / 2, Math.floor(H / 4))
  const lower = pixel(oimg, W / 2, Math.floor((3 * H) / 4))

  comp.dispose()
  return {
    glOk: true,
    modes,
    alpha: { got: alphaGot, expected: alphaExp, maxDiff: alphaDiff },
    orientation: {
      upper,
      lower,
      topIsGreen: upper[1] > upper[0] && upper[1] > upper[2],
      bottomIsRed: lower[0] > lower[1] && lower[0] > lower[2],
    },
  }
}

const ev = { pressure: 1, shiftKey: false } as unknown as PointerEvent

function paintEditorWith(base: HTMLCanvasElement) {
  registerBuiltinKinds()
  registerBuiltinTools()
  const comp = createWebGLCompositor()
  if (!comp.init({ width: W, height: H })) return null
  const editor = createEditor({ compositor: comp })
  editor.loadDocument(emptyDocument(W, H))
  const cid = editor.content.register(base)
  const layer = rasterKind.create({
    name: 'paint-target',
    contentId: cid,
    naturalWidth: W,
    naturalHeight: H,
    transform: { x: 0, y: 0, w: W, h: H, rotation: 0 },
  })
  editor.addNode(layer)
  editor.setActiveNode(layer.id)
  return { comp, editor }
}

function readCenterAndCorner(comp: ReturnType<typeof createWebGLCompositor>): {
  center: Px
  corner: Px
  edgeInside: Px
  edgeOutside: Px
} {
  const img = comp.readback()
  return {
    center: pixel(img, W / 2, H / 2),
    corner: pixel(img, 4, 4),
    edgeInside: pixel(img, W / 2, H / 2 - 9),
    edgeOutside: pixel(img, W / 2, H / 2 - 15),
  }
}

function runPaint() {
  const transparent = document.createElement('canvas')
  transparent.width = W
  transparent.height = H
  const setup = paintEditorWith(transparent)
  if (!setup) return { glOk: false }
  const { comp, editor } = setup

  editor.setBrush({ size: 24, hardness: 1, spacing: 0.1, opacity: 1, flow: 1, color: '#ff0000' })
  editor.setTool('brush')
  editor.pointerDown(ev, { x: W / 2 - 6, y: H / 2 })
  editor.pointerMove(ev, { x: W / 2 + 6, y: H / 2 })

  editor.render()
  const midStroke = readCenterAndCorner(comp)
  editor.pointerUp(ev, { x: W / 2 + 6, y: H / 2 })
  editor.render()
  const afterBrush = readCenterAndCorner(comp)

  editor.undo()
  editor.render()
  const afterUndo = readCenterAndCorner(comp)

  editor.redo()
  editor.render()
  const afterRedo = readCenterAndCorner(comp)
  comp.dispose()

  const opaque = document.createElement('canvas')
  opaque.width = W
  opaque.height = H
  const g = opaque.getContext('2d')!
  g.fillStyle = '#2244cc'
  g.fillRect(0, 0, W, H)
  const setup2 = paintEditorWith(opaque)
  if (!setup2) return { glOk: false }

  setup2.editor.setBrush({ size: 24, hardness: 1, spacing: 0.1, opacity: 1, flow: 1, color: '#ffffff' })
  setup2.editor.setTool('eraser')
  setup2.editor.pointerDown(ev, { x: W / 2, y: H / 2 })
  setup2.editor.pointerUp(ev, { x: W / 2, y: H / 2 })
  setup2.editor.render()
  const afterErase = readCenterAndCorner(setup2.comp)

  const json = JSON.stringify(setup2.editor.serialize())
  setup2.editor.loadJSON(json)
  const roundTripChildren = setup2.editor.document().root.children.length
  setup2.comp.dispose()

  return { glOk: true, midStroke, afterBrush, afterUndo, afterRedo, afterErase, roundTripChildren }
}

;(window as unknown as { runCompositorTests: () => unknown }).runCompositorTests = run
;(window as unknown as { runPaintTests: () => unknown }).runPaintTests = runPaint
document.getElementById('status')!.textContent = 'ready'
