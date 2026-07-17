import { onMounted, ref, watch, type Ref } from 'vue'
import {
  BAND_COLORS,
  EQ_FMAX,
  EQ_FMIN,
  EQ_GMAX,
  EQ_H,
  EQ_W,
  bandDb,
  freqToX,
  gainToY,
  xToFreq,
  yToGain,
  type EqBand,
} from '@/composables/widgets/fx/eqMath'

export interface UseEqGraphOptions {
  canvasEl: Ref<HTMLCanvasElement | null>
  modelValue: Ref<EqBand[]>
  onChange: (v: EqBand[]) => void
}

export function useEqGraph(opts: UseEqGraphOptions) {
  const { canvasEl, modelValue, onChange } = opts

  const dragIdx = ref(-1)

  function draw() {
    const ctx = canvasEl.value?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, EQ_W, EQ_H)

    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.font = '8px monospace'
    for (const f of [100, 1000, 10000]) {
      const x = freqToX(f)
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, EQ_H); ctx.stroke()
      ctx.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x + 2, EQ_H - 3)
    }
    for (const g of [-12, 0, 12]) {
      const y = gainToY(g)
      ctx.strokeStyle = g === 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(EQ_W, y); ctx.stroke()
    }

    const bands = modelValue.value ?? []
    ctx.strokeStyle = '#7ec8ff'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let px = 0; px <= EQ_W; px += 2) {
      const f = xToFreq(px)
      let db = 0
      for (const b of bands) db += bandDb(b, f)
      db = Math.min(EQ_GMAX, Math.max(-EQ_GMAX, db))
      const y = gainToY(db)
      if (px === 0) ctx.moveTo(px, y)
      else ctx.lineTo(px, y)
    }
    ctx.stroke()

    bands.forEach((b, i) => {
      const x = freqToX(b.f)
      const y = b.type === 'highpass' || b.type === 'lowpass' ? EQ_H / 2 : gainToY(b.g)
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fillStyle = BAND_COLORS[i % BAND_COLORS.length]
      ctx.fill()
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 1
      ctx.stroke()
    })
  }

  function localXY(e: MouseEvent): [number, number] {
    const rect = canvasEl.value!.getBoundingClientRect()
    return [(e.clientX - rect.left) * (EQ_W / rect.width),
            (e.clientY - rect.top) * (EQ_H / rect.height)]
  }

  function hitIndex(e: MouseEvent): number {
    const [px, py] = localXY(e)
    const bands = modelValue.value ?? []
    for (let i = 0; i < bands.length; i++) {
      const b = bands[i]
      const x = freqToX(b.f)
      const y = b.type === 'highpass' || b.type === 'lowpass' ? EQ_H / 2 : gainToY(b.g)
      if (Math.hypot(x - px, y - py) < 9) return i
    }
    return -1
  }

  function onDown(e: PointerEvent) {
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragIdx.value = hitIndex(e)
  }

  function onMove(e: PointerEvent) {
    if (dragIdx.value < 0) return
    e.stopPropagation()
    const [px, py] = localXY(e)
    const bands = (modelValue.value ?? []).slice()
    const b = { ...bands[dragIdx.value] }
    b.f = Math.round(Math.min(EQ_FMAX, Math.max(EQ_FMIN, xToFreq(px))))
    if (b.type === 'peak' || b.type === 'lowshelf' || b.type === 'highshelf') {
      b.g = Math.round(Math.min(EQ_GMAX, Math.max(-EQ_GMAX, yToGain(py))) * 10) / 10
    }
    bands[dragIdx.value] = b
    onChange(bands)
  }

  function onUp(e: PointerEvent) {
    dragIdx.value = -1
    e.stopPropagation()
  }

  function onWheel(e: WheelEvent) {
    const idx = hitIndex(e)
    if (idx < 0) return
    const bands = (modelValue.value ?? []).slice()
    const b = { ...bands[idx] }
    b.q = Math.round(Math.min(20, Math.max(0.1, b.q * (e.deltaY > 0 ? 0.85 : 1.18))) * 100) / 100
    bands[idx] = b
    onChange(bands)
  }

  function onDbl(e: MouseEvent) {
    const idx = hitIndex(e)
    const bands = (modelValue.value ?? []).slice()
    if (idx >= 0) {
      bands.splice(idx, 1)
    } else {
      const [px, py] = localXY(e)
      bands.push({
        type: 'peak',
        f: Math.round(xToFreq(px)),
        g: Math.round(Math.min(EQ_GMAX, Math.max(-EQ_GMAX, yToGain(py))) * 10) / 10,
        q: 1.0,
      })
    }
    onChange(bands)
  }

  watch(modelValue, draw, { deep: true })
  onMounted(draw)

  return { dragIdx, draw, onDown, onMove, onUp, onWheel, onDbl }
}
