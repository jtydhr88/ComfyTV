import { describe, expect, it, vi } from 'vitest'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { guardOrbitControlsDragEnd } from './orbitControlsGuard'

interface FakeInternals {
  _pointers: number[]
  _onPointerMove: (event: PointerEvent) => void
  _onPointerUp: (event: PointerEvent) => void
}

function createFakeControls(): FakeInternals & { moves: number; ups: number } {
  const fake = {
    _pointers: [] as number[],
    moves: 0,
    ups: 0,
    _onPointerMove(_event: PointerEvent) {
      fake.moves += 1
    },
    _onPointerUp(_event: PointerEvent) {
      fake.ups += 1
      fake._pointers = []
    }
  }
  return fake
}

function pointerEvent(type: string): PointerEvent {
  return new Event(type, { bubbles: true }) as PointerEvent
}

describe('guardOrbitControlsDragEnd', () => {
  it('relays drag pointermove/pointerup at element level while dragging', () => {
    const element = document.createElement('div')
    const fake = createFakeControls()
    guardOrbitControlsDragEnd(fake as unknown as OrbitControls, element)

    fake._pointers = [1]
    element.dispatchEvent(pointerEvent('pointerdown'))

    element.dispatchEvent(pointerEvent('pointermove'))
    element.dispatchEvent(pointerEvent('pointermove'))
    expect(fake.moves).toBe(2)

    element.dispatchEvent(pointerEvent('pointerup'))
    expect(fake.ups).toBe(1)

    element.dispatchEvent(pointerEvent('pointermove'))
    expect(fake.moves).toBe(2)
  })

  it('removes the controls document-level drag listeners on pointerdown', () => {
    const element = document.createElement('div')
    document.body.appendChild(element)
    const fake = createFakeControls()

    element.addEventListener('pointerdown', () => {
      fake._pointers = [1]
      document.addEventListener('pointermove', fake._onPointerMove)
      document.addEventListener('pointerup', fake._onPointerUp)
    })
    guardOrbitControlsDragEnd(fake as unknown as OrbitControls, element)
    const removeSpy = vi.spyOn(document, 'removeEventListener')

    element.dispatchEvent(pointerEvent('pointerdown'))
    expect(removeSpy).toHaveBeenCalledWith('pointermove', fake._onPointerMove)
    expect(removeSpy).toHaveBeenCalledWith('pointerup', fake._onPointerUp)

    element.dispatchEvent(pointerEvent('pointermove'))
    expect(fake.moves).toBe(1)

    removeSpy.mockRestore()
    element.remove()
  })

  it('does nothing when the controls did not track the pointer (disabled)', () => {
    const element = document.createElement('div')
    const fake = createFakeControls()
    guardOrbitControlsDragEnd(fake as unknown as OrbitControls, element)

    element.dispatchEvent(pointerEvent('pointerdown'))
    element.dispatchEvent(pointerEvent('pointermove'))
    element.dispatchEvent(pointerEvent('pointerup'))
    expect(fake.moves).toBe(0)
    expect(fake.ups).toBe(0)
  })

  it('cleans up all listeners on dispose', () => {
    const element = document.createElement('div')
    const fake = createFakeControls()
    const dispose = guardOrbitControlsDragEnd(
      fake as unknown as OrbitControls,
      element
    )

    fake._pointers = [1]
    element.dispatchEvent(pointerEvent('pointerdown'))
    dispose()

    element.dispatchEvent(pointerEvent('pointermove'))
    expect(fake.moves).toBe(0)
  })
})
