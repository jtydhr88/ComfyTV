import { onMounted, ref, watch, type Ref } from 'vue'
import { offsetsToPuck, puckToOffsets, type RgbOffsets } from '@/composables/widgets/fx/colorWheelMath'

export interface UseColorWheelOptions {
  canvasEl: Ref<HTMLCanvasElement | null>
  modelValue: Ref<RgbOffsets>
  size: Ref<number>
  onChange: (v: RgbOffsets) => void
}

export function useColorWheel(opts: UseColorWheelOptions) {
  const { canvasEl, modelValue, size, onChange } = opts

  const dragging = ref(false)

  function draw() {
    const c = canvasEl.value
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const s = size.value
    const r = s / 2
    ctx.clearRect(0, 0, s, s)

    const conic = (ctx as any).createConicGradient
      ? (ctx as any).createConicGradient(-Math.PI / 2, r, r)
      : null
    if (conic) {
      for (let i = 0; i <= 12; i++) {
        conic.addColorStop(i / 12, `hsl(${-i * 30}, 80%, 55%)`)
      }
      ctx.fillStyle = conic
    } else {
      ctx.fillStyle = '#666'
    }
    ctx.beginPath()
    ctx.arc(r, r, r - 1, 0, Math.PI * 2)
    ctx.fill()
    const fade = ctx.createRadialGradient(r, r, 0, r, r, r - 1)
    fade.addColorStop(0, 'rgba(30,30,30,1)')
    fade.addColorStop(1, 'rgba(30,30,30,0)')
    ctx.fillStyle = fade
    ctx.beginPath()
    ctx.arc(r, r, r - 1, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(r, 3); ctx.lineTo(r, s - 3)
    ctx.moveTo(3, r); ctx.lineTo(s - 3, r)
    ctx.stroke()

    const p = offsetsToPuck(modelValue.value)
    const px = r + p.x * (r - 6)
    const py = r + p.y * (r - 6)
    ctx.beginPath()
    ctx.arc(px, py, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.strokeStyle = '#000'
    ctx.stroke()
  }

  function apply(e: PointerEvent) {
    const c = canvasEl.value
    if (!c) return
    const rect = c.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const s = size.value
    const r = s / 2
    const cx = (e.clientX - rect.left) / rect.width * s
    const cy = (e.clientY - rect.top) / rect.height * s
    const x = (cx - r) / (r - 6)
    const y = (cy - r) / (r - 6)
    onChange(puckToOffsets(x, y))
  }

  function onDown(e: PointerEvent) {
    dragging.value = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    apply(e)
    e.stopPropagation()
  }
  function onMove(e: PointerEvent) {
    if (dragging.value) { apply(e); e.stopPropagation() }
  }
  function onUp(e: PointerEvent) {
    dragging.value = false
    e.stopPropagation()
  }

  watch(modelValue, draw, { deep: true })
  onMounted(draw)

  return { dragging, draw, onDown, onMove, onUp }
}
