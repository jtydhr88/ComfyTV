import { useEventListener, useRafFn } from '@vueuse/core'
import { ref, watch, watchEffect, type Ref } from 'vue'

import {
  cmapCoverage,
  opszDefault,
  placeBlock,
  wrapText,
  type OverlayText,
  type WrapText,
} from '@/composables/stages/textOverlayLayout'

export interface TextOverlayStyle {
  font: string
  size: number
  color: string
  stroke: number
  strokeColor: string
  anchor: string
}

interface LoadedFont {
  family: string
  opsz: number | null
  covers: Set<number>
}

const FALLBACK_FONT = 'NotoSansSC-Regular'
const LINE_GAP = 4
const MAX_SIDE = 1920

const loadedFonts = new Map<string, Promise<LoadedFont>>()

function loadFont(name: string): Promise<LoadedFont> {
  let font = loadedFonts.get(name)
  if (!font) {
    const family = `ctv-text-${loadedFonts.size}`
    font = fetch(`/comfytv/text_font?name=${encodeURIComponent(name)}`)
      .then((r) => r.arrayBuffer())
      .then(async (buf) => {
        document.fonts.add(await new FontFace(family, buf).load())
        return { family, opsz: opszDefault(buf), covers: cmapCoverage(buf) }
      })
      .catch(() => ({ family: 'sans-serif', opsz: null, covers: new Set<number>() }))
    loadedFonts.set(name, font)
  }
  return font
}

export function useTextOverlayPreview(opts: {
  canvas: Ref<HTMLCanvasElement | null>
  video: Ref<HTMLVideoElement | null>
  style: () => TextOverlayStyle
  textAt: (t: number, wrap: WrapText) => OverlayText | null
}) {
  const fonts = ref<[LoadedFont, LoadedFont] | null>(null)
  const time = ref(0)

  watch(() => opts.style().font, async (font) => {
    fonts.value = null
    const loaded = await Promise.all([loadFont(font), loadFont(FALLBACK_FONT)])
    if (font === opts.style().font) fonts.value = loaded
  }, { immediate: true })

  function draw(): void {
    const canvas = opts.canvas.value
    const video = opts.video.value
    if (!canvas || !video) return
    const vw = video.videoWidth
    const vh = video.videoHeight
    const k = Math.min(1, MAX_SIDE / Math.max(vw, vh, 1))
    canvas.width = Math.round(vw * k)
    canvas.height = Math.round(vh * k)
    const ctx = canvas.getContext('2d')
    if (!ctx || !vw || !vh || !fonts.value) return

    const [main, fallback] = fonts.value
    const st = opts.style()
    const stroke = Math.max(0, Math.round(st.stroke))
    const base = main.opsz ?? st.size
    const f = st.size / base
    const stack = `${base}px ${main.family}, ${fallback.family}`
    const item = opts.textAt(time.value, (text) => {
      ctx.font = stack
      return wrapText(text, (s) => ctx.measureText(s).width * f, vw * 0.9 - 2 * (2 + stroke))
    })
    if (!item) return

    const measure = (family: string, text: string) => {
      ctx.font = `${st.size}px ${family}`
      return ctx.measureText(text)
    }
    const ascent = (font: LoadedFont) => Math.ceil(measure(font.family, 'A').fontBoundingBoxAscent)
    const descent = (font: LoadedFont) => Math.ceil(measure(font.family, 'A').fontBoundingBoxDescent)
    const missing = (s: string) => main !== fallback
      && Array.from(s).some((ch) => ch.trim() && !main.covers.has(ch.codePointAt(0)!))

    const lines = item.text.split('\n')
    ctx.font = stack
    const widths = lines.map((l) => ctx.measureText(l).width * f)
    const tw = Math.ceil(Math.max(...widths)) + 4 + 2 * stroke

    let th: number
    let baselines: number[]
    if (missing(item.text)) {
      let y = 2 + stroke
      baselines = lines.map((l) => {
        const used = missing(l) ? [main, fallback] : [main]
        const asc = Math.max(...used.map(ascent))
        const b = y + asc
        y += asc + Math.max(...used.map(descent)) + LINE_GAP
        return b
      })
      th = y - LINE_GAP + 2 + stroke
    } else {
      const asc = ascent(main)
      const spacing = asc + Math.ceil(measure(main.family, 'A').actualBoundingBoxDescent) + 2 * stroke + LINE_GAP
      const ink = lines.map((l) => measure(main.family, l))
      const top = Math.min(...ink.map((m, i) => i * spacing + asc - Math.ceil(m.actualBoundingBoxAscent))) - stroke
      const bottom = Math.max(...ink.map((m, i) => i * spacing + asc + Math.ceil(m.actualBoundingBoxDescent))) + stroke
      th = bottom - top + 4
      baselines = lines.map((_, i) => 2 - top + i * spacing + asc)
    }
    const [x, y] = placeBlock(st.anchor, vw, vh, tw, th)

    ctx.font = stack
    ctx.globalAlpha = item.opacity
    ctx.textAlign = 'center'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2 * stroke / f
    ctx.strokeStyle = st.strokeColor
    ctx.fillStyle = st.color
    lines.forEach((l, i) => {
      ctx.setTransform(k * f, 0, 0, k * f, k * (x + tw / 2), k * (y + baselines[i]))
      if (stroke > 0) ctx.strokeText(l, 0, 0)
      ctx.fillText(l, 0, 0)
    })
  }

  const syncTime = () => { time.value = opts.video.value?.currentTime ?? 0 }
  const playing = useRafFn(syncTime, { immediate: false })
  useEventListener(opts.video, ['timeupdate', 'seeked'], syncTime)
  useEventListener(opts.video, 'loadedmetadata', () => { syncTime(); draw() })
  useEventListener(opts.video, 'play', playing.resume)
  useEventListener(opts.video, ['pause', 'ended'], playing.pause)
  watchEffect(draw, { flush: 'post' })
}
