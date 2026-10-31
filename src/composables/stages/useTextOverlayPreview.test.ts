import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { useTextOverlayPreview, type TextOverlayStyle } from './useTextOverlayPreview'

function fakeCanvas() {
  const calls: string[] = []
  const ctx: any = {
    calls,
    font: '',
    measureText: (s: string) => ({
      width: Array.from(s).length * 10,
      fontBoundingBoxAscent: 10,
      fontBoundingBoxDescent: 2,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
    }),
    setTransform: vi.fn(),
    fillRect: (...a: number[]) => calls.push(`box:${a.join(',')}:${ctx.globalAlpha}:${ctx.fillStyle}`),
    strokeText: vi.fn(),
    fillText: (s: string) => calls.push(`text:${s}`),
  }
  const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement
  return { canvas, calls }
}

async function settle() {
  for (let i = 0; i < 5; i++) {
    await nextTick()
    await new Promise(r => setTimeout(r, 0))
  }
}

describe('useTextOverlayPreview', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
  })

  async function setup(style: TextOverlayStyle, textAt = (t: number) => ({ text: `at ${t}`, opacity: 1 })) {
    const { canvas, calls } = fakeCanvas()
    const video = document.createElement('video')
    Object.defineProperty(video, 'videoWidth', { value: 0, configurable: true })
    Object.defineProperty(video, 'videoHeight', { value: 0, configurable: true })
    const styleRef = ref(style)
    const scope = effectScope()
    scope.run(() => useTextOverlayPreview({
      canvas: ref(canvas),
      video: ref(video),
      style: () => styleRef.value,
      textAt,
    }))
    await settle()
    Object.defineProperty(video, 'videoWidth', { value: 1000 })
    Object.defineProperty(video, 'videoHeight', { value: 500 })
    video.dispatchEvent(new Event('loadedmetadata'))
    await settle()
    return { video, styleRef, calls, stop: () => scope.stop() }
  }

  const base = { font: 'f', size: 40, color: '#fff', stroke: 0, strokeColor: '#000', anchor: 'bottom' }

  it('keeps following time after the metadata arrives late', async () => {
    const { video, calls, stop } = await setup(base)
    expect(calls.at(-1)).toBe('text:at 0')
    video.currentTime = 3
    video.dispatchEvent(new Event('seeked'))
    await settle()
    expect(calls.at(-1)).toBe('text:at 3')
    stop()
  })

  it('redraws when the style changes while paused', async () => {
    const { styleRef, calls, stop } = await setup(base)
    calls.length = 0
    styleRef.value = { ...base, boxOpacity: 0.5, boxColor: '#123456' }
    await settle()
    expect(calls.some(c => c.startsWith('box:'))).toBe(true)
    stop()
  })

  it('draws the box behind the text with the padding and margin the render uses', async () => {
    const { calls, stop } = await setup({ ...base, boxOpacity: 0.5, boxColor: '#123456', margin: 0.2 })
    const box = calls.find(c => c.startsWith('box:'))!
    const [x, y, w, h] = box.slice(4).split(':')[0].split(',').map(Number)
    expect(box.endsWith(':0.5:#123456')).toBe(true)
    expect(w).toBe(40 + 4 + 2 * 10)
    expect(y + h).toBe(500 - 100)
    expect(x).toBe(Math.floor((1000 - w) / 2))
    expect(calls.indexOf(box)).toBeLessThan(calls.findIndex(c => c.startsWith('text:')))
    stop()
  })

  it('draws no box at zero opacity', async () => {
    const { calls, stop } = await setup({ ...base, boxOpacity: 0 })
    expect(calls.some(c => c.startsWith('box:'))).toBe(false)
    stop()
  })

  it('leaves room for the padding when wrapping', async () => {
    const seen: string[] = []
    const { stop } = await setup(
      { ...base, boxOpacity: 0.5 },
      (_t, wrap?: any) => {
        const text = wrap('x'.repeat(89))
        seen.push(text)
        return { text, opacity: 1 }
      },
    )
    expect(seen.at(-1)).toContain('\n')
    stop()
  })
})
