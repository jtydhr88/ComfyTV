import { onBeforeUnmount, watch, type Ref } from 'vue'

export interface UseImagePanZoomOptions {
  minZoom?: number
  maxZoom?: number
  resetKey?: Ref<unknown>
}

export function useImagePanZoom(
  containerEl: Ref<HTMLElement | null>,
  imgEl: Ref<HTMLImageElement | null>,
  options: UseImagePanZoomOptions = {},
) {
  const minZoom = options.minZoom ?? 1
  const maxZoom = options.maxZoom ?? 6

  let zoom = 1
  let pan = { x: 0, y: 0 }
  let drag: { sx: number; sy: number; ox: number; oy: number } | null = null
  let bound: HTMLElement | null = null

  function apply() {
    const img = imgEl.value
    if (!img) return
    img.style.transformOrigin = '0 0'
    img.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
    img.style.transition = drag ? 'none' : 'transform .12s ease-out'
  }

  function reset() {
    zoom = 1
    pan = { x: 0, y: 0 }
    drag = null
    containerEl.value?.classList.remove('is-panning')
    apply()
  }

  function onWheel(e: WheelEvent) {
    const container = containerEl.value
    if (!container) return
    e.preventDefault()
    e.stopPropagation()
    const rect = container.getBoundingClientRect()
    const lx = e.clientX - rect.left
    const ly = e.clientY - rect.top
    const before = { x: (lx - pan.x) / zoom, y: (ly - pan.y) / zoom }
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    const nz = Math.max(minZoom, Math.min(maxZoom, zoom * factor))
    zoom = nz
    pan = nz <= 1.001
      ? { x: 0, y: 0 }
      : { x: lx - before.x * nz, y: ly - before.y * nz }
    apply()
  }

  function onDown(e: MouseEvent) {
    if (e.button !== 0 || zoom <= 1.001) return
    if ((e.target as HTMLElement)?.closest('[data-no-pan], button, a, input, textarea')) return
    drag = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y }
    containerEl.value?.classList.add('is-panning')
    e.preventDefault()
    e.stopPropagation()
  }

  function onMove(e: MouseEvent) {
    if (!drag) return
    pan = { x: drag.ox + e.clientX - drag.sx, y: drag.oy + e.clientY - drag.sy }
    apply()
  }

  function onUp() {
    if (!drag) return
    drag = null
    containerEl.value?.classList.remove('is-panning')
    apply()
  }

  function onDblClick(e: MouseEvent) {
    if (zoom <= 1.001) return
    e.preventDefault()
    e.stopPropagation()
    reset()
  }

  function onEnter() {
    bound?.focus?.({ preventScroll: true })
  }

  function bind(el: HTMLElement) {
    el.setAttribute('data-capture-wheel', 'true')
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
    el.style.outline = 'none'
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('mousedown', onDown)
    el.addEventListener('dblclick', onDblClick)
    el.addEventListener('pointerenter', onEnter)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    bound = el
  }

  function unbind() {
    if (!bound) return
    bound.removeEventListener('wheel', onWheel)
    bound.removeEventListener('mousedown', onDown)
    bound.removeEventListener('dblclick', onDblClick)
    bound.removeEventListener('pointerenter', onEnter)
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    bound = null
  }

  watch(containerEl, (el) => {
    unbind()
    if (el) bind(el)
  }, { immediate: true })

  if (options.resetKey) {
    watch(options.resetKey, () => reset())
  }

  onBeforeUnmount(unbind)

  return { reset }
}
