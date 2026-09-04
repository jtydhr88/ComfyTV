import { withHydrateGate } from '../hydrateGate'
import { waitForBudgetHeadroom } from '../../engine/impl/hybridContentStore'
import { measureText, type TextStyle } from '../../textRender'
import { textToPathData } from '../../textPath'
import { rasterKind, textKind, transformPath, vectorKind, type TextData } from '../../engine'
import { loadImageElement, MAX_CONTENT_DIM, newCanvas, type StageCtx } from './stageContext'

export function createStageImport(ctx: StageCtx) {
  const { editor, content, engineNode, activeId, fontStore, t, toastError } = ctx

  async function addImageFromUrl(url: string, name: string): Promise<void> {
    try {
      const img = await loadImageElement(url)
      const scale = Math.min(1, MAX_CONTENT_DIM / Math.max(img.width, img.height))
      const nw = Math.max(1, Math.round(img.width * scale))
      const nh = Math.max(1, Math.round(img.height * scale))
      const c = newCanvas(nw, nh)
      c.getContext('2d')!.drawImage(img, 0, 0, nw, nh)
      const keepUrl = scale === 1 && !/^(data|blob):/i.test(url)
      const cid = content.register(c, keepUrl ? { uploadedUrl: url } : undefined)
      const d = editor.document()
      const hasRaster = d.root.children.some((n) => n.kind === 'raster')
      if (!hasRaster) {
        editor.addNode(rasterKind.create({
          name, contentId: cid, url: keepUrl ? url : undefined, naturalWidth: nw, naturalHeight: nh,
          transform: { x: (d.width - nw) / 2, y: (d.height - nh) / 2, w: nw, h: nh, rotation: 0 },
        }))
        return
      }
      editor.startFloating(cid, nw, nh, name)
    } catch {
      toastError(t('pentrado.loadImageFailed'))
    }
  }
  function addEmptyLayer(): void {
    const d = editor.document()
    let cid: string
    if (content.registerUniform) {
      cid = content.registerUniform(d.width, d.height, [0, 0, 0, 0])
    } else {
      const c = newCanvas(d.width, d.height)
      c.getContext('2d')?.clearRect(0, 0, d.width, d.height)
      cid = content.register(c, { uniform: [0, 0, 0, 0] })
    }
    const count = d.root.children.length + 1
    editor.addNode(rasterKind.create({
      name: `Layer ${count}`, contentId: cid, naturalWidth: d.width, naturalHeight: d.height,
      transform: { x: 0, y: 0, w: d.width, h: d.height, rotation: 0 },
    }))
  }
  function addImageFromFile(file: File): void {
    const reader = new FileReader()
    reader.onload = () => void addImageFromUrl(String(reader.result), file.name.replace(/\.[^.]+$/, ''))
    reader.readAsDataURL(file)
  }
  function addTextLayerAt(at: { x: number; y: number }): string {
    const layer = textKind.create({ text: '', transform: { x: at.x, y: at.y, w: 200, h: 64, rotation: 0 } })
    editor.addNode(layer)
    return layer.id
  }
  function pathToSelection(id: string, op: 'replace' | 'add' | 'subtract' | 'intersect' = 'replace'): boolean {
    return editor.pathToSelection(id, op)
  }
  function strokePathBrush(id: string): boolean {
    ctx.syncEngineTool()
    const active = activeId.value ? engineNode(activeId.value) : null
    if (!active || active.kind !== 'raster') addEmptyLayer()
    return editor.strokePathWithBrush(id)
  }
  function textToPath(id: string): boolean {
    const n = engineNode(id)
    if (!n || n.kind !== 'text') return false
    const tn = n as TextData
    const font = fontStore.getFontSyncWithFallback(tn.fontRef)
    if (!font) return false
    const style: TextStyle = {
      id: tn.id, text: tn.text, fontRef: tn.fontRef, fontSize: tn.fontSize, color: tn.color,
      letterSpacing: tn.letterSpacing, lineHeight: tn.lineHeight, align: tn.align,
    }
    const local = textToPathData(style, font)
    if (!local.strokes.length) return false
    const metrics = measureText(style, font)
    const tf = tn.transform
    const sx = (tf.w || metrics.w) / metrics.w
    const sy = (tf.h || metrics.h) / metrics.h
    const cx = tf.x + tf.w / 2
    const cy = tf.y + tf.h / 2
    const cos = Math.cos(tf.rotation)
    const sin = Math.sin(tf.rotation)
    const docPath = transformPath(local, (p) => {
      const lx = p.x * sx - tf.w / 2
      const ly = p.y * sy - tf.h / 2
      return { x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos }
    })
    const node = vectorKind.create({
      name: `${tn.name} path`,
      path: docPath,
      fill: { color: tn.color, rule: 'nonzero' },
    })
    editor.addNode(node)
    return true
  }
  function loadUrlToCanvas(url: string): Promise<HTMLCanvasElement> {
    return withHydrateGate(() => waitForBudgetHeadroom().then(() => loadImageElement(url)).then((img) => {
      const c = newCanvas(img.width, img.height)
      c.getContext('2d')!.drawImage(img, 0, 0)
      return c
    }))
  }
  async function hydrate(): Promise<void> {
    try {
      await editor.hydrate(loadUrlToCanvas)
    } catch (e) {
      console.warn('[pentrado] hydrate failed', e)
    }
  }
  return { addImageFromUrl, addEmptyLayer, addImageFromFile, addTextLayerAt, pathToSelection, strokePathBrush, textToPath, hydrate }
}
