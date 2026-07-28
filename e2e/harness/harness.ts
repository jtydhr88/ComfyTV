import { readPsd, writePsd } from 'ag-psd'

import {
  blendComposite,
  createEditor,
  createWebGLCompositor,
  defaultMode,
  deriveVectorTransform,
  emptyDocument,
  generateId,
  linearToSrgb,
  adjustmentKind,
  pendingUploads,
  rasterKind,
  rectPath,
  registerBuiltinKinds,
  registerBuiltinTools,
  resolveMode,
  srgbToLinear,
  fillKind,
  vectorKind,
  type BlendFn,
  type CompositeInput,
  type RGBA,
  type SceneNode,
  type VectorData,
} from '@jtydhr88/pictor'
import {
  buildPsdFromEditor,
  bufferedContentRegistry,
  decodePngBytes,
  psdToNodes,
} from '@jtydhr88/pictor'
import { uploadBlob } from '@/utils/uploadCanvas'

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

  const big = 160
  comp.resize(big, big)
  const bigSolid = document.createElement('canvas')
  bigSolid.width = big
  bigSolid.height = big
  const bg = bigSolid.getContext('2d')!
  bg.fillStyle = 'rgb(30,180,90)'
  bg.fillRect(0, 0, big, big)
  comp.composite([
    { texture: { source: bigSolid, rect: { x: 0, y: 0, w: big, h: big }, linear: false }, opacity: 1, mode: resolveMode(defaultMode('normal')) },
  ], null)
  const bigImg = comp.readback()
  const bigCorner = pixel(bigImg, big - 8, big - 8)
  const resizeOk = bigImg.width === big && bigImg.height === big && bigCorner[1] > 120 && bigCorner[3] > 200

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
    resize: { width: bigImg.width, height: bigImg.height, corner: bigCorner, ok: resizeOk },
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

  const blank = document.createElement('canvas')
  blank.width = W
  blank.height = H
  const s3 = paintEditorWith(blank)
  if (!s3) return { glOk: false }
  s3.editor.setRectSelection({ x: 0, y: 0, w: W / 2, h: H })
  s3.editor.setBrush({ size: 24, hardness: 1, spacing: 0.1, opacity: 1, flow: 1, color: '#ff0000' })
  s3.editor.setTool('brush')
  s3.editor.pointerDown(ev, { x: W / 2 - 12, y: H / 2 })
  s3.editor.pointerMove(ev, { x: W / 2 + 12, y: H / 2 })
  s3.editor.pointerUp(ev, { x: W / 2 + 12, y: H / 2 })
  s3.editor.render()
  const simg = s3.comp.readback()
  const selInside = pixel(simg, W / 2 - 8, H / 2)
  const selOutside = pixel(simg, W / 2 + 8, H / 2)
  s3.comp.dispose()

  return { glOk: true, midStroke, afterBrush, afterUndo, afterRedo, afterErase, roundTripChildren, selInside, selOutside }
}

function solidSized(w: number, h: number, css: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = css
  g.fillRect(0, 0, w, h)
  return c
}

function runLayers() {
  registerBuiltinKinds()
  registerBuiltinTools()
  const comp = createWebGLCompositor()
  if (!comp.init({ width: W, height: H })) return { glOk: false }
  const editor = createEditor({ compositor: comp })
  editor.loadDocument(emptyDocument(W, H))

  const baseId = editor.content.register(solidSized(32, 32, 'rgb(200,40,40)'))
  const base = rasterKind.create({
    name: 'base', contentId: baseId, naturalWidth: 32, naturalHeight: 32,
    transform: { x: 0, y: 0, w: 32, h: 32, rotation: 0 },
  })
  editor.addNode(base)
  editor.setActiveNode(base.id)

  const floatId = editor.content.register(solidSized(16, 16, 'rgb(40,200,60)'))
  editor.startFloating(floatId, 16, 16)
  const f = editor.floating()!
  f.transform.x = 40
  f.transform.y = 40
  editor.render()
  const midFloat = pixel(comp.readback(), 47, 47)

  editor.anchorFloating('active')
  editor.render()
  const img = comp.readback()
  const anchoredFloat = pixel(img, 47, 47)
  const anchoredBase = pixel(img, 8, 8)
  const layer = editor.document().root.children[0] as {
    naturalWidth: number
    naturalHeight: number
    transform: { x: number; y: number; w: number; h: number; rotation: number }
  }
  const grown = { w: layer.naturalWidth, h: layer.naturalHeight, tw: layer.transform.w, rot: layer.transform.rotation }

  editor.undo()
  editor.render()
  const undone = pixel(comp.readback(), 47, 47)
  editor.redo()
  editor.render()
  const redone = pixel(comp.readback(), 47, 47)

  const layerCount = editor.document().root.children.length

  const blueId = editor.content.register(solidSized(20, 20, 'rgb(40,60,220)'))
  const blue = rasterKind.create({
    name: 'blue', contentId: blueId, naturalWidth: 20, naturalHeight: 20,
    transform: { x: 8, y: 8, w: 20, h: 20, rotation: 0 },
  })
  editor.addNode(blue)
  const mergeOk = editor.mergeDown(blue.id)
  editor.render()
  const mimg = comp.readback()
  const mergedBlue = pixel(mimg, 14, 14)
  const mergedGreen = pixel(mimg, 47, 47)
  const mergedCount = editor.document().root.children.length

  editor.undo()
  const mergeUndoCount = editor.document().root.children.length
  editor.redo()

  const flattenOk = editor.flattenImage()
  editor.render()
  const fimg = comp.readback()
  const flatCorner = pixel(fimg, 62, 2)
  const flatBlue = pixel(fimg, 14, 14)
  const flatCount = editor.document().root.children.length

  comp.dispose()
  return {
    glOk: true, midFloat, anchoredFloat, anchoredBase, grown, undone, redone, layerCount,
    mergeOk, mergedBlue, mergedGreen, mergedCount, mergeUndoCount,
    flattenOk, flatCorner, flatBlue, flatCount,
  }
}

function runAdjust() {
  registerBuiltinKinds()
  registerBuiltinTools()
  const comp = createWebGLCompositor()
  if (!comp.init({ width: W, height: H })) return { glOk: false }
  const editor = createEditor({ compositor: comp })
  editor.loadDocument(emptyDocument(W, H))

  const redId = editor.content.register(solidSized(W, H, 'rgb(255,0,0)'))
  editor.addNode(rasterKind.create({
    name: 'red', contentId: redId, naturalWidth: W, naturalHeight: H,
    transform: { x: 0, y: 0, w: W, h: H, rotation: 0 },
  }))

  const adj = adjustmentKind.create({ op: 'invert' })
  editor.addNode(adj)
  editor.render()
  const inverted = pixel(comp.readback(), W / 2, H / 2)

  adj.opacity = 0.5
  editor.invalidate()
  editor.render()
  const half = pixel(comp.readback(), W / 2, H / 2)

  adj.opacity = 1
  ;(adj as { op: string }).op = 'brightness-contrast'
  ;(adj as { params: Record<string, number> }).params = { brightness: 0.5, contrast: 0 }
  editor.invalidate()
  editor.render()
  const brightened = pixel(comp.readback(), W / 2, H / 2)

  adj.visible = false
  editor.invalidate()
  editor.render()
  const hidden = pixel(comp.readback(), W / 2, H / 2)

  comp.dispose()
  return { glOk: true, inverted, half, brightened, hidden }
}

function runVector() {
  registerBuiltinKinds()
  registerBuiltinTools()
  const comp = createWebGLCompositor()
  if (!comp.init({ width: W, height: H })) return { glOk: false }
  const editor = createEditor({ compositor: comp })
  editor.loadDocument(emptyDocument(W, H))

  editor.setTool('shape')
  editor.setShapeOptions({ shape: 'rect', fill: { color: '#ff0000' }, stroke: null })
  editor.pointerDown(ev, { x: 8, y: 8 })
  editor.pointerMove(ev, { x: 40, y: 40 })
  editor.pointerUp(ev, { x: 40, y: 40 })
  editor.render()
  let img = comp.readback()
  const rectInside = pixel(img, 20, 20)
  const rectOutside = pixel(img, 4, 4)

  editor.setShapeOptions({ shape: 'ellipse', fill: { color: '#00ff00' }, stroke: null })
  editor.pointerDown(ev, { x: 44, y: 8 })
  editor.pointerUp(ev, { x: 60, y: 24 })
  editor.render()
  img = comp.readback()
  const ellipseCenter = pixel(img, 52, 16)
  const ellipseCorner = pixel(img, 45, 9)

  editor.setShapeOptions({
    shape: 'line',
    fill: null,
    stroke: { color: '#ffffff', width: 4, cap: 'butt', join: 'miter' },
  })
  editor.pointerDown(ev, { x: 8, y: 56 })
  editor.pointerUp(ev, { x: 56, y: 56 })
  editor.render()
  img = comp.readback()
  const lineOn = pixel(img, 32, 56)
  const lineOff = pixel(img, 32, 48)

  const kinds = editor.document().root.children.map((n) => n.kind)

  const rectNode = editor.document().root.children[0] as VectorData
  const before = { ...rectNode.transform }
  rectNode.transform = { x: 8, y: 8, w: 48, h: 48, rotation: 0 }
  const cmd = vectorKind.onTransformCommitted!(rectNode, before, { content: editor.content })
  if (cmd) editor.history.push(cmd)
  editor.render()
  img = comp.readback()
  const scaledInside = pixel(img, 50, 44)
  const scaledEdgeIn = pixel(img, 54, 30)
  const scaledEdgeOut = pixel(img, 58, 30)
  const anchorAfterScale = { ...rectNode.path.strokes[0].anchors[1].pos }

  editor.undo()
  editor.render()
  img = comp.readback()
  const unscaled = pixel(img, 50, 44)

  const json = JSON.stringify(editor.serialize())
  editor.loadJSON(json)
  editor.render()
  img = comp.readback()
  const roundTripKinds = editor.document().root.children.map((n) => n.kind)
  const reloadedRect = pixel(img, 20, 20)

  comp.dispose()
  return {
    glOk: true,
    rectInside, rectOutside,
    ellipseCenter, ellipseCorner,
    lineOn, lineOff,
    kinds,
    scaledInside, scaledEdgeIn, scaledEdgeOut, anchorAfterScale,
    unscaled,
    roundTripKinds, reloadedRect,
  }
}

function runFill() {
  registerBuiltinKinds()
  registerBuiltinTools()
  const comp = createWebGLCompositor()
  if (!comp.init({ width: W, height: H })) return { glOk: false }
  const editor = createEditor({ compositor: comp })
  editor.loadDocument(emptyDocument(W, H))

  const solid = fillKind.create({ fill: { type: 'solid', color: '#2266cc' } })
  editor.addNode(solid)
  editor.render()
  let img = comp.readback()
  const solidCenter = pixel(img, W / 2, H / 2)
  const solidCorner = pixel(img, 1, 1)

  ;(solid as { fill: unknown }).fill = {
    type: 'linear',
    angle: 0,
    stops: [
      { offset: 0, color: '#000000' },
      { offset: 1, color: '#ffffff' },
    ],
  }
  editor.invalidate()
  editor.render()
  img = comp.readback()
  const linLeft = pixel(img, 2, H / 2)
  const linRight = pixel(img, W - 3, H / 2)
  const linMid = pixel(img, W / 2, H / 2)

  ;(solid as { fill: unknown }).fill = {
    type: 'radial',
    cx: 0.5,
    cy: 0.5,
    radius: 0.5,
    stops: [
      { offset: 0, color: '#ffffff' },
      { offset: 1, color: '#000000' },
    ],
  }
  editor.invalidate()
  editor.render()
  img = comp.readback()
  const radCenter = pixel(img, W / 2, H / 2)
  const radCorner = pixel(img, 2, 2)

  const redId = editor.content.register(solidSized(W, H, 'rgb(255,0,0)'))
  const red = rasterKind.create({
    name: 'red', contentId: redId, naturalWidth: W, naturalHeight: H,
    transform: { x: 0, y: 0, w: W, h: H, rotation: 0 },
  })
  editor.addNode(red, 0)
  ;(solid as { fill: unknown }).fill = { type: 'solid', color: '#00ff00' }
  solid.opacity = 0.5
  editor.invalidate()
  editor.render()
  img = comp.readback()
  const mixed = pixel(img, W / 2, H / 2)

  solid.opacity = 1
  const mergeOk = editor.mergeDown(solid.id)
  editor.render()
  img = comp.readback()
  const merged = pixel(img, W / 2, H / 2)
  const mergedCount = editor.document().root.children.length

  const json = JSON.stringify(editor.serialize())
  editor.loadJSON(json)
  const roundTripKinds = editor.document().root.children.map((n) => n.kind)

  comp.dispose()
  return {
    glOk: true,
    solidCenter, solidCorner,
    linLeft, linRight, linMid,
    radCenter, radCorner,
    mixed,
    mergeOk, merged, mergedCount,
    roundTripKinds,
  }
}

async function runContextLoss() {
  registerBuiltinKinds()
  registerBuiltinTools()
  const comp = createWebGLCompositor()
  let restoredCalls = 0
  if (!comp.init({ width: W, height: H, onContextRestored: () => restoredCalls++ })) return { glOk: false }
  const editor = createEditor({ compositor: comp })
  editor.loadDocument(emptyDocument(W, H))
  const redId = editor.content.register(solidSized(W, H, 'rgb(255,0,0)'))
  editor.addNode(rasterKind.create({
    name: 'red', contentId: redId, naturalWidth: W, naturalHeight: H,
    transform: { x: 0, y: 0, w: W, h: H, rotation: 0 },
  }))
  editor.render()
  const before = pixel(comp.readback(), W / 2, H / 2)

  const glCanvas = comp.getCanvas() as HTMLCanvasElement
  const deadGl = glCanvas.getContext('webgl2') as WebGL2RenderingContext
  deadGl.getExtension('WEBGL_lose_context')?.loseContext()
  const lostImmediately = deadGl.isContextLost()

  await new Promise((r) => setTimeout(r, 300))

  editor.invalidate()
  editor.render()
  const after = pixel(comp.readback(), W / 2, H / 2)
  const swappedCanvas = comp.getCanvas() !== glCanvas

  comp.dispose()
  return { glOk: true, before, after, lostImmediately, restoredCalls, swappedCanvas }
}

function coverageOf(img: ImageData): number {
  let opaque = 0
  for (let i = 3; i < img.data.length; i += 4) {
    if (img.data[i] > 8) opaque++
  }
  return opaque / (img.data.length / 4)
}

function diffStats(a: ImageData, b: ImageData, step = 8): { maxDiff: number; avgDiff: number; samples: number } {
  if (a.width !== b.width || a.height !== b.height) return { maxDiff: 255, avgDiff: 255, samples: 0 }
  let maxDiff = 0
  let sum = 0
  let samples = 0
  for (let y = 0; y < a.height; y += step) {
    for (let x = 0; x < a.width; x += step) {
      const i = (y * a.width + x) * 4
      for (let c = 0; c < 4; c++) {
        const d = Math.abs(a.data[i + c] - b.data[i + c])
        maxDiff = Math.max(maxDiff, d)
        sum += d
      }
      samples++
    }
  }
  return { maxDiff, avgDiff: sum / Math.max(1, samples * 4), samples }
}

function canvasFromUrl(url: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      c.getContext('2d')!.drawImage(img, 0, 0)
      resolve(c)
    }
    img.onerror = () => reject(new Error(`load failed: ${url}`))
    img.src = url
  })
}

interface PsdEditorSetup {
  comp: ReturnType<typeof createWebGLCompositor>
  editor: ReturnType<typeof createEditor>
}

function makeEditor(w: number, h: number): PsdEditorSetup | null {
  registerBuiltinKinds()
  registerBuiltinTools()
  const comp = createWebGLCompositor()
  if (!comp.init({ width: w, height: h })) return null
  const editor = createEditor({ compositor: comp })
  editor.loadDocument(emptyDocument(w, h))
  return { comp, editor }
}

interface LayerReport {
  name: string
  kind: string
  coverage: number
}

function analyzeEditor(setup: PsdEditorSetup): { composite: number; layers: LayerReport[] } {
  const { comp, editor } = setup
  editor.render()
  const composite = coverageOf(comp.readback())
  const children = editor.document().root.children
  const saved = children.map((n) => n.visible)
  const layers: LayerReport[] = []
  for (let i = 0; i < children.length; i++) {
    if (children[i].kind === 'adjustment') {
      layers.push({ name: children[i].name, kind: children[i].kind, coverage: -1 })
      continue
    }
    children.forEach((n, j) => (n.visible = j === i))
    editor.render()
    layers.push({ name: children[i].name, kind: children[i].kind, coverage: coverageOf(comp.readback()) })
  }
  children.forEach((n, j) => (n.visible = saved[j]))
  editor.render()
  return { composite, layers }
}

async function importPsdIntoEditor(psdBytes: ArrayBuffer) {
  const psd = readPsd(psdBytes, { skipThumbnail: true })
  const setup = makeEditor(psd.width, psd.height)
  if (!setup) return null
  const registry = bufferedContentRegistry()
  const result = await psdToNodes(psd, {
    registerContent: registry.registerContent,
    matchFont: () => ({ kind: 'builtin', id: 'inter' }),
    decodePng: decodePngBytes,
  })
  for (const node of result.nodes) setup.editor.addNode(node)
  registry.commit((canvas, id) => setup.editor.content.register(canvas, { id }))
  setup.editor.invalidate()
  setup.editor.render()
  return { setup, result, psd }
}

async function persistReload(setup: PsdEditorSetup) {
  const { editor } = setup
  const doc = editor.document()
  const jobs = pendingUploads(doc, editor.content)
  for (const job of jobs) {
    const blob = await new Promise<Blob>((res, rej) =>
      job.canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob null'))), 'image/png')
    )
    const url = await uploadBlob(blob, { subfolder: 'e2e' })
    job.commitUrl(url)
    editor.content.markUploaded(job.contentId, url)
  }
  const json = JSON.stringify(editor.serialize())
  const fresh = makeEditor(doc.width, doc.height)
  if (!fresh) return null
  fresh.editor.loadJSON(json)
  await fresh.editor.hydrate(canvasFromUrl)
  fresh.editor.render()
  return { fresh, uploadedJobs: jobs.length }
}

function solidCanvas(w: number, h: number, css: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = css
  g.fillRect(0, 0, w, h)
  return c
}

async function runPsdRoundTrip() {
  const W2 = 128
  const H2 = 128
  const source = makeEditor(W2, H2)
  if (!source) return { glOk: false }
  const { comp, editor } = source

  const redId = editor.content.register(solidCanvas(64, 64, 'rgb(220,40,40)'))
  editor.addNode(rasterKind.create({
    name: 'red', contentId: redId, naturalWidth: 64, naturalHeight: 64,
    transform: { x: 10, y: 10, w: 64, h: 64, rotation: 0 },
  }))

  const blueId = editor.content.register(solidCanvas(W2, H2, 'rgb(40,60,220)'))
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = W2
  maskCanvas.height = H2
  const mg = maskCanvas.getContext('2d')!
  mg.fillStyle = '#000000'
  mg.fillRect(0, 0, W2, H2)
  mg.fillStyle = '#ffffff'
  mg.fillRect(0, 0, W2 / 2, H2)
  const maskId = editor.content.register(maskCanvas)
  const masked = rasterKind.create({
    name: 'masked-blue', contentId: blueId, naturalWidth: W2, naturalHeight: H2,
    transform: { x: 0, y: 0, w: W2, h: H2, rotation: 0 },
  })
  masked.mask = { id: generateId('mask'), role: 'mask', contentId: maskId, enabled: true }
  editor.addNode(masked)

  editor.addNode(fillKind.create({
    name: 'green-fill',
    fill: { type: 'solid', color: '#22cc44' },
    opacity: 0.6,
  }))

  const path = rectPath(70, 70, 40, 30)
  editor.addNode(vectorKind.create({
    name: 'yellow-rect',
    path,
    fill: { color: '#ffee00', rule: 'nonzero', opacity: 1 },
    transform: deriveVectorTransform(path, 0),
  }))

  const overflowId = editor.content.register(solidCanvas(64, 64, 'rgb(255,140,0)'))
  editor.addNode(rasterKind.create({
    name: 'overflow', contentId: overflowId, naturalWidth: 64, naturalHeight: 64,
    transform: { x: 96, y: 96, w: 64, h: 64, rotation: 0 },
  }))

  editor.addNode(adjustmentKind.create({ name: 'invert', op: 'invert' }))

  editor.render()
  const beforeImg = comp.readback()
  const before = analyzeEditor(source)

  const psd = await buildPsdFromEditor(
    {
      document: () => editor.document(),
      render: () => editor.render(),
      readbackCanvas: () => {
        const img = comp.readback()
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        c.getContext('2d')!.putImageData(img, 0, 0)
        return c
      },
    },
    editor.content
  )
  const bytes = writePsd(psd)

  const imported = await importPsdIntoEditor(bytes)
  if (!imported) return { glOk: false }
  const after = analyzeEditor(imported.setup)
  imported.setup.editor.render()
  const afterImg = imported.setup.comp.readback()
  const diff = diffStats(beforeImg, afterImg)

  const reload = await persistReload(imported.setup)
  if (!reload) return { glOk: false }
  const reloaded = analyzeEditor(reload.fresh)
  reload.fresh.editor.render()
  const reloadImg = reload.fresh.comp.readback()
  const reloadDiff = diffStats(beforeImg, reloadImg)

  comp.dispose()
  imported.setup.comp.dispose()
  reload.fresh.comp.dispose()

  return {
    glOk: true,
    before,
    after,
    diff,
    warnings: imported.result.warnings,
    importedKinds: imported.result.nodes.map((n: SceneNode) => n.kind),
    importedTransforms: imported.result.nodes.map((n: SceneNode) => ({ name: n.name, transform: n.transform })),
    reloaded,
    reloadDiff,
    uploadedJobs: reload.uploadedJobs,
  }
}

async function runPsdFixture(url: string) {
  const resp = await fetch(url)
  if (!resp.ok) return { ok: false, error: `fetch ${resp.status}` }
  const bytes = await resp.arrayBuffer()
  const imported = await importPsdIntoEditor(bytes)
  if (!imported) return { ok: false, error: 'gl init failed' }

  const nodes = imported.result.nodes.map((n: SceneNode) => ({
    name: n.name,
    kind: n.kind,
    visible: n.visible,
    transform: n.transform,
  }))
  const analysis = analyzeEditor(imported.setup)

  const reload = await persistReload(imported.setup)
  if (!reload) return { ok: false, error: 'reload gl init failed' }
  const reloadAnalysis = analyzeEditor(reload.fresh)

  imported.setup.comp.dispose()
  reload.fresh.comp.dispose()

  return {
    ok: true,
    width: imported.psd.width,
    height: imported.psd.height,
    warnings: imported.result.warnings,
    nodes,
    composite: analysis.composite,
    layers: analysis.layers,
    reloadComposite: reloadAnalysis.composite,
    reloadLayers: reloadAnalysis.layers,
    uploadedJobs: reload.uploadedJobs,
  }
}

;(window as unknown as { runCompositorTests: () => unknown }).runCompositorTests = run
;(window as unknown as { runPaintTests: () => unknown }).runPaintTests = runPaint
;(window as unknown as { runLayerTests: () => unknown }).runLayerTests = runLayers
;(window as unknown as { runAdjustTests: () => unknown }).runAdjustTests = runAdjust
;(window as unknown as { runVectorTests: () => unknown }).runVectorTests = runVector
;(window as unknown as { runFillTests: () => unknown }).runFillTests = runFill
;(window as unknown as { runContextLossTests: () => unknown }).runContextLossTests = runContextLoss
;(window as unknown as { runPsdRoundTrip: () => unknown }).runPsdRoundTrip = runPsdRoundTrip
;(window as unknown as { runPsdFixture: (url: string) => unknown }).runPsdFixture = runPsdFixture
document.getElementById('status')!.textContent = 'ready'
