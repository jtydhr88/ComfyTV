import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export function guardOrbitControlsDragEnd(
  controls: OrbitControls,
  element: HTMLElement
): () => void {
  const internals = controls as unknown as {
    _pointers?: unknown[]
    _onPointerMove?: (event: PointerEvent) => void
    _onPointerUp?: (event: PointerEvent) => void
  }
  const doc = element.ownerDocument

  const onMove = (event: PointerEvent): void => {
    if (internals._pointers?.length) internals._onPointerMove?.(event)
  }

  const detachDragListeners = (): void => {
    element.removeEventListener('pointermove', onMove)
    element.removeEventListener('pointerup', onUp)
    element.removeEventListener('pointercancel', onUp)
  }

  const onUp = (event: PointerEvent): void => {
    if (internals._pointers?.length) internals._onPointerUp?.(event)
    if (!internals._pointers?.length) detachDragListeners()
  }

  const onDown = (): void => {
    if (!internals._pointers?.length) return
    if (internals._onPointerMove) {
      doc.removeEventListener('pointermove', internals._onPointerMove)
    }
    if (internals._onPointerUp) {
      doc.removeEventListener('pointerup', internals._onPointerUp)
    }
    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerup', onUp)
    element.addEventListener('pointercancel', onUp)
  }

  element.addEventListener('pointerdown', onDown)
  return () => {
    element.removeEventListener('pointerdown', onDown)
    detachDragListeners()
  }
}
