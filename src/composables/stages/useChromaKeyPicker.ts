import { onBeforeUnmount, ref, type Ref } from 'vue'
import { registerPreviewSource } from '@/composables/stages/previewBus'
import {
  createChainCompositor,
  type ChainCompositor,
} from '@/composables/stages/useChainedFxPreview'
import { computeFit } from '@/composables/widgets/useVideoViewport'
import type { FxPreviewSource } from '@/widgets/glsl/fxPreviewSource'

export const CHROMA_PREVIEW_W = 320
export const CHROMA_PREVIEW_H = 180

export type Rgb = [number, number, number]

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16) || 0,
          parseInt(h.slice(2, 4), 16) || 0,
          parseInt(h.slice(4, 6), 16) || 0]
}

export function rgbToUv(r: number, g: number, b: number): [number, number] {
  return [
    -0.168736 * r - 0.331264 * g + 0.5 * b + 128,
    0.5 * r - 0.418688 * g - 0.081312 * b + 128,
  ]
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()
}

export function applyChromaKey(
  d: Uint8ClampedArray,
  keyHex: string,
  similarity: number,
  blend: number,
): void {
  const [kr, kg, kb] = hexToRgb(keyHex)
  const [ku, kv] = rgbToUv(kr, kg, kb)
  const sim = similarity * 255 * Math.SQRT2
  const bl = blend * 255 * Math.SQRT2
  for (let i = 0; i < d.length; i += 4) {
    const [u, vv] = rgbToUv(d[i], d[i + 1], d[i + 2])
    const dist = Math.hypot(u - ku, vv - kv)
    let a = 255
    if (dist < sim) a = 0
    else if (bl > 0 && dist < sim + bl) a = Math.round(((dist - sim) / bl) * 255)
    d[i + 3] = Math.min(d[i + 3], a)
  }
}

export function applyDespill(
  d: Uint8ClampedArray,
  keyHex: string,
  mix: number,
  expand: number,
): void {
  if (mix <= 0) return
  const key = hexToRgb(keyHex)
  const blueScreen = key[2] > key[1]
  const m = Math.min(Math.max(mix, 0), 1)
  const factor = (1 - m) * (1 - Math.min(Math.max(expand, 0), 1))
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255
    const g = d[i + 1] / 255
    const b = d[i + 2] / 255
    const spill = blueScreen
      ? Math.max(b - (r * m + g * factor), 0)
      : Math.max(g - (r * m + b * factor), 0)
    d[i + 1] = Math.min(255, Math.max(0, Math.round((g - spill) * 255)))
  }
}

export function applyMatte(d: Uint8ClampedArray): void {
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]
    d[i] = a
    d[i + 1] = a
    d[i + 2] = a
    d[i + 3] = 255
  }
}

export function frameFit(src: FxPreviewSource): { dx: number; dy: number; dw: number; dh: number } {
  const v = src as HTMLVideoElement
  const isVideo = typeof v.videoWidth === 'number'
  const w = isVideo ? v.videoWidth : (src as HTMLCanvasElement).width
  const h = isVideo ? v.videoHeight : (src as HTMLCanvasElement).height
  const mw = w || 16
  const mh = h || 9
  const f = computeFit(CHROMA_PREVIEW_W, CHROMA_PREVIEW_H, mw, mh)
  return { dx: f.offX, dy: f.offY, dw: mw * f.scale, dh: mh * f.scale }
}

export interface UseChromaKeyPickerOptions {
  videoEl: Ref<HTMLVideoElement | null>
  canvasEl: Ref<HTMLCanvasElement | null>
  nodeId?: string
  node?: unknown
  keyColor: Ref<string>
  similarity: Ref<number>
  blend: Ref<number>
  despillMix?: Ref<number>
  despillExpand?: Ref<number>
  outputMode?: Ref<string>
}

export function useChromaKeyPicker(opts: UseChromaKeyPickerOptions) {
  const picking = ref(false)
  const playing = ref(false)
  const unregister = opts.nodeId != null
    ? registerPreviewSource(opts.nodeId, () => opts.canvasEl.value)
    : null
  const compositor: ChainCompositor | null = opts.node != null
    ? createChainCompositor(opts.node)
    : null
  let rafId = 0

  function composedSource(): FxPreviewSource | null {
    const v = opts.videoEl.value
    if (!v || v.readyState < 2) return null
    if (compositor == null) return v
    return compositor.render(v) ?? v
  }

  function renderFrame(): void {
    const v = opts.videoEl.value
    const c = opts.canvasEl.value
    const ctx = c?.getContext('2d', { willReadFrequently: true })
    if (!v || !c || !ctx || v.readyState < 2) {
      rafId = requestAnimationFrame(renderFrame)
      return
    }
    if (c.width !== CHROMA_PREVIEW_W) { c.width = CHROMA_PREVIEW_W; c.height = CHROMA_PREVIEW_H }
    ctx.clearRect(0, 0, CHROMA_PREVIEW_W, CHROMA_PREVIEW_H)
    const src = composedSource() ?? v
    const { dx, dy, dw, dh } = frameFit(src)
    ctx.drawImage(src as CanvasImageSource, dx, dy, dw, dh)

    const img = ctx.getImageData(0, 0, CHROMA_PREVIEW_W, CHROMA_PREVIEW_H)
    applyChromaKey(img.data, opts.keyColor.value, opts.similarity.value, opts.blend.value)
    if (opts.outputMode?.value === 'matte') {
      applyMatte(img.data)
    } else {
      applyDespill(img.data, opts.keyColor.value,
                   opts.despillMix?.value ?? 0, opts.despillExpand?.value ?? 0)
    }
    ctx.putImageData(img, 0, 0)
    rafId = requestAnimationFrame(renderFrame)
  }

  function startLoop(): void {
    cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(renderFrame)
  }

  function togglePlay(): void {
    const v = opts.videoEl.value
    if (!v) return
    if (v.paused) { void v.play(); playing.value = true }
    else { v.pause(); playing.value = false }
  }

  function onCanvasClick(e: MouseEvent): void {
    if (!picking.value) { togglePlay(); return }
    const c = opts.canvasEl.value
    const v = opts.videoEl.value
    if (!c || !v || v.readyState < 2) return
    const src = composedSource() ?? v
    const tmp = document.createElement('canvas')
    tmp.width = CHROMA_PREVIEW_W
    tmp.height = CHROMA_PREVIEW_H
    const tctx = tmp.getContext('2d')!
    const { dx, dy, dw, dh } = frameFit(src)
    tctx.drawImage(src as CanvasImageSource, dx, dy, dw, dh)
    const rect = c.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const fit = computeFit(rect.width, rect.height, CHROMA_PREVIEW_W, CHROMA_PREVIEW_H)
    const px = Math.floor((e.clientX - rect.left - fit.offX) / fit.scale)
    const py = Math.floor((e.clientY - rect.top - fit.offY) / fit.scale)
    if (px < 0 || py < 0 || px >= CHROMA_PREVIEW_W || py >= CHROMA_PREVIEW_H) return
    const p = tctx.getImageData(px, py, 1, 1).data
    opts.keyColor.value = rgbToHex(p[0], p[1], p[2])
    picking.value = false
  }

  onBeforeUnmount(() => {
    unregister?.()
    cancelAnimationFrame(rafId)
    compositor?.dispose()
  })

  return { picking, playing, startLoop, togglePlay, onCanvasClick }
}
