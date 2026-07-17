import { onBeforeUnmount, ref, type Ref } from 'vue'
import { computeFit } from '@/composables/widgets/useVideoViewport'

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

export function frameFit(v: HTMLVideoElement): { dx: number; dy: number; dw: number; dh: number } {
  const mw = v.videoWidth || 16
  const mh = v.videoHeight || 9
  const f = computeFit(CHROMA_PREVIEW_W, CHROMA_PREVIEW_H, mw, mh)
  return { dx: f.offX, dy: f.offY, dw: mw * f.scale, dh: mh * f.scale }
}

export interface UseChromaKeyPickerOptions {
  videoEl: Ref<HTMLVideoElement | null>
  canvasEl: Ref<HTMLCanvasElement | null>
  keyColor: Ref<string>
  similarity: Ref<number>
  blend: Ref<number>
}

export function useChromaKeyPicker(opts: UseChromaKeyPickerOptions) {
  const picking = ref(false)
  const playing = ref(false)
  let rafId = 0

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
    const { dx, dy, dw, dh } = frameFit(v)
    ctx.drawImage(v, dx, dy, dw, dh)

    const img = ctx.getImageData(0, 0, CHROMA_PREVIEW_W, CHROMA_PREVIEW_H)
    applyChromaKey(img.data, opts.keyColor.value, opts.similarity.value, opts.blend.value)
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
    const tmp = document.createElement('canvas')
    tmp.width = CHROMA_PREVIEW_W
    tmp.height = CHROMA_PREVIEW_H
    const tctx = tmp.getContext('2d')!
    const { dx, dy, dw, dh } = frameFit(v)
    tctx.drawImage(v, dx, dy, dw, dh)
    const rect = c.getBoundingClientRect()
    const px = Math.floor((e.clientX - rect.left) * (CHROMA_PREVIEW_W / rect.width))
    const py = Math.floor((e.clientY - rect.top) * (CHROMA_PREVIEW_H / rect.height))
    const p = tctx.getImageData(px, py, 1, 1).data
    opts.keyColor.value = rgbToHex(p[0], p[1], p[2])
    picking.value = false
  }

  onBeforeUnmount(() => cancelAnimationFrame(rafId))

  return { picking, playing, startLoop, togglePlay, onCanvasClick }
}
