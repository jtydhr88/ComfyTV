import { describe, it, expect } from 'vitest'
import {
  registerPreviewSource,
  getPreviewSource,
  previewBusRevision,
} from './previewBus'

function makeCanvas(): HTMLCanvasElement {
  return document.createElement('canvas')
}

describe('previewBus', () => {
  it('registers a source retrievable by node id', () => {
    const c = makeCanvas()
    const off = registerPreviewSource('n1', () => c)
    expect(getPreviewSource('n1')!()).toBe(c)
    off()
  })

  it('returns null for unknown ids', () => {
    expect(getPreviewSource('nope')).toBeNull()
  })

  it('unregister removes the source', () => {
    const off = registerPreviewSource('n2', () => null)
    expect(getPreviewSource('n2')).not.toBeNull()
    off()
    expect(getPreviewSource('n2')).toBeNull()
  })

  it('unregister is idempotent', () => {
    const off = registerPreviewSource('n3', () => null)
    off()
    const rev = previewBusRevision.value
    off()
    expect(previewBusRevision.value).toBe(rev)
  })

  it('bumps the revision on register and unregister', () => {
    const before = previewBusRevision.value
    const off = registerPreviewSource('n4', () => null)
    expect(previewBusRevision.value).toBe(before + 1)
    off()
    expect(previewBusRevision.value).toBe(before + 2)
  })

  it('later registration for the same id wins and stale unregister is a no-op', () => {
    const c1 = makeCanvas()
    const c2 = makeCanvas()
    const g1 = () => c1
    const g2 = () => c2
    const off1 = registerPreviewSource('n5', g1)
    const off2 = registerPreviewSource('n5', g2)
    expect(getPreviewSource('n5')).toBe(g2)
    off1()
    expect(getPreviewSource('n5')).toBe(g2)
    off2()
    expect(getPreviewSource('n5')).toBeNull()
  })
})
