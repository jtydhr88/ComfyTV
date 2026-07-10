import { describe, expect, it } from 'vitest'

import { exceedsClickThreshold, useClickDragGuard } from './useClickDragGuard'

describe('exceedsClickThreshold', () => {
  it('is false within the threshold and true beyond it', () => {
    expect(exceedsClickThreshold({ x: 0, y: 0 }, { x: 3, y: 4 }, 5)).toBe(false)
    expect(exceedsClickThreshold({ x: 0, y: 0 }, { x: 3, y: 4 }, 4)).toBe(true)
    expect(exceedsClickThreshold({ x: 10, y: 10 }, { x: 10, y: 10 }, 0)).toBe(
      false
    )
  })
})

describe('useClickDragGuard', () => {
  it('reports a drag only after the pointer moves past the threshold', () => {
    const guard = useClickDragGuard(5)
    expect(guard.wasDragged({ clientX: 100, clientY: 100 })).toBe(false)

    guard.recordStart({ clientX: 0, clientY: 0 })
    expect(guard.wasDragged({ clientX: 2, clientY: 2 })).toBe(false)
    expect(guard.wasDragged({ clientX: 20, clientY: 0 })).toBe(true)

    guard.reset()
    expect(guard.wasDragged({ clientX: 20, clientY: 0 })).toBe(false)
  })

  it('defaults the threshold to 5', () => {
    const guard = useClickDragGuard()
    guard.recordStart({ clientX: 0, clientY: 0 })
    expect(guard.wasDragged({ clientX: 5, clientY: 0 })).toBe(false)
    expect(guard.wasDragged({ clientX: 6, clientY: 0 })).toBe(true)
  })
})
