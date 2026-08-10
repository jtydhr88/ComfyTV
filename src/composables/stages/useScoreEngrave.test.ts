import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

const loadMock = vi.fn().mockResolvedValue(undefined)
const renderMock = vi.fn()
const clearMock = vi.fn()

const cursorTimestamps = [0, 1, 2, 3, 4, 5, 6, 7]
const cursorState = { idx: 0, shown: false, resets: 0 }
const cursorEl = document.createElement('img')

const cloneCalls = { count: 0, fail: false }

function makeIterator(idx: number) {
  return {
    idx,
    get EndReached() {
      return this.idx >= cursorTimestamps.length - 1
    },
    get CurrentEnrolledTimestamp() {
      return { RealValue: cursorTimestamps[this.idx] / 4 }
    },
    clone() {
      if (cloneCalls.fail) throw new Error('no clone')
      cloneCalls.count++
      return makeIterator(this.idx)
    },
    moveToNext() {
      this.idx = Math.min(this.idx + 1, cursorTimestamps.length - 1)
    },
  }
}

const cursorMock = {
  cursorElement: cursorEl,
  show: vi.fn(() => { cursorState.shown = true }),
  hide: vi.fn(() => { cursorState.shown = false }),
  reset: vi.fn(() => { cursorState.idx = 0; cursorState.resets++ }),
  next: vi.fn(() => {
    cursorState.idx = Math.min(cursorState.idx + 1,
      cursorTimestamps.length - 1)
  }),
  update: vi.fn(),
  get iterator() {
    return makeIterator(cursorState.idx)
  },
}

vi.mock('opensheetmusicdisplay', () => ({
  OpenSheetMusicDisplay: class {
    zoom = 1
    load = loadMock
    render = renderMock
    clear = clearMock
    cursor = cursorMock
  },
}))

import { useScoreEngrave } from './useScoreEngrave'

const XML = '<score-partwise version="4.0"><part/></score-partwise>'

function harness(xml: ReturnType<typeof ref<string>>) {
  let api: ReturnType<typeof useScoreEngrave> | null = null
  const scroller = document.createElement('div')
  const el = document.createElement('div')
  scroller.appendChild(el)
  Object.defineProperty(scroller, 'clientHeight', { value: 200 })
  const container = ref<HTMLElement | null>(el)
  const Comp = defineComponent({
    setup() {
      api = useScoreEngrave({ xml: xml as never, container, debounceMs: 1 })
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  return { wrapper, api: api!, container, scroller }
}

describe('useScoreEngrave', () => {
  beforeEach(() => {
    loadMock.mockClear()
    renderMock.mockClear()
    clearMock.mockClear()
    cloneCalls.fail = false
  })

  it('renders valid MusicXML through OSMD', async () => {
    const xml = ref(XML)
    const { api } = harness(xml)
    await api.renderNow()
    expect(loadMock).toHaveBeenCalledTimes(1)
    expect(renderMock).toHaveBeenCalledTimes(1)
    expect(api.empty.value).toBe(false)
    expect(api.error.value).toBe('')
  })

  it('stays empty for non-score text', async () => {
    const xml = ref('hello world')
    const { api } = harness(xml)
    await api.renderNow()
    expect(loadMock).not.toHaveBeenCalled()
    expect(api.empty.value).toBe(true)
  })

  it('reports load errors', async () => {
    loadMock.mockRejectedValueOnce(new Error('bad xml'))
    const xml = ref(XML)
    const { api } = harness(xml)
    await api.renderNow()
    expect(api.error.value).toContain('bad xml')
    expect(api.empty.value).toBe(true)
  })

  it('skips reload when xml unchanged, re-renders on zoom', async () => {
    const xml = ref(XML)
    const { api } = harness(xml)
    await api.renderNow()
    await api.renderNow()
    expect(loadMock).toHaveBeenCalledTimes(1)
    expect(renderMock).toHaveBeenCalledTimes(2)
  })

  it('zoomBy clamps range', async () => {
    const xml = ref(XML)
    const { api } = harness(xml)
    for (let i = 0; i < 30; i++) api.zoomBy(0.1)
    expect(api.zoom.value).toBe(1.6)
    for (let i = 0; i < 30; i++) api.zoomBy(-0.1)
    expect(api.zoom.value).toBe(0.25)
  })

  it('clears on unmount', async () => {
    const xml = ref(XML)
    const { wrapper, api } = harness(xml)
    await api.renderNow()
    wrapper.unmount()
    await nextTick()
    expect(clearMock).toHaveBeenCalled()
  })

  it('cursor sits on the sounding note, not the next one', async () => {
    cursorState.idx = 0
    cursorState.resets = 0
    const xml = ref(XML)
    const { api } = harness(xml)
    await api.renderNow()
    api.seekCursorToBeat(3.2)
    expect(cursorState.idx).toBe(3)
    const resetsAfterForward = cursorState.resets
    api.seekCursorToBeat(5.1)
    expect(cursorState.idx).toBe(5)
    expect(cursorState.resets).toBe(resetsAfterForward)
    api.seekCursorToBeat(0.05)
    expect(cursorState.resets).toBe(resetsAfterForward + 1)
    expect(cursorState.idx).toBe(0)
    api.seekCursorToBeat(1.0)
    expect(cursorState.idx).toBe(1)
  })

  it('hideCursor hides', async () => {
    const xml = ref(XML)
    const { api } = harness(xml)
    await api.renderNow()
    api.seekCursorToBeat(2)
    api.hideCursor()
    expect(cursorMock.hide).toHaveBeenCalled()
  })

  it('clones the shadow iterator only on reset, never per seek', async () => {
    cursorState.idx = 0
    cloneCalls.count = 0
    const xml = ref(XML)
    const { api } = harness(xml)
    await api.renderNow()
    for (let i = 0; i < 30; i++) api.seekCursorToBeat(i * 0.25)
    const afterForward = cloneCalls.count
    expect(afterForward).toBeLessThanOrEqual(2)
    api.seekCursorToBeat(0.1)
    expect(cloneCalls.count).toBeLessThanOrEqual(afterForward + 2)
  })

  it('debounced re-render fires after xml edits', async () => {
    const xml = ref(XML)
    const { api } = harness(xml)
    await api.renderNow()
    xml.value = XML.replace('4.0', '4.1')
    await nextTick()
    await new Promise((r) => setTimeout(r, 30))
    expect(loadMock).toHaveBeenCalledTimes(2)
  })

  it('re-renders when the container swaps and resizes past the threshold', async () => {
    let roCb: ((entries: Array<{ contentRect: { width: number } }>) => void)
      | null = null
    const observed: HTMLElement[] = []
    const disconnects = { count: 0 }
    class RO {
      constructor(cb: (entries: Array<{ contentRect: { width: number } }>) => void) {
        roCb = cb
      }
      observe(el: HTMLElement) { observed.push(el) }
      disconnect() { disconnects.count++ }
    }
    vi.stubGlobal('ResizeObserver', RO)
    try {
      const xml = ref(XML)
      const { api, container } = harness(xml)
      await api.renderNow()
      const el2 = document.createElement('div')
      container.value = el2
      await nextTick()
      await new Promise((r) => setTimeout(r, 20))
      expect(observed).toContain(el2)
      const renders = renderMock.mock.calls.length
      roCb!([])
      roCb!([{ contentRect: { width: 10 } }])
      roCb!([{ contentRect: { width: 300 } }])
      await new Promise((r) => setTimeout(r, 20))
      expect(renderMock.mock.calls.length).toBeGreaterThan(renders)
      container.value = null
      await nextTick()
      expect(disconnects.count).toBeGreaterThan(0)
      await api.renderNow()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('seeks by timestamp comparison when the iterator cannot clone', async () => {
    cursorState.idx = 0
    cloneCalls.fail = true
    const xml = ref(XML)
    const { api } = harness(xml)
    await api.renderNow()
    api.seekCursorToBeat(3.2)
    expect(cursorState.idx).toBe(4)
    api.seekCursorToBeat(3.2)
    expect(cursorState.idx).toBe(4)
  })

  it('warns when the cursor stalls far from the playhead', async () => {
    cursorState.idx = 0
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const xml = ref(XML)
      const { api } = harness(xml)
      await api.renderNow()
      for (let i = 0; i < 95; i++) api.seekCursorToBeat(20)
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0][0])).toContain('desync')
    } finally {
      warn.mockRestore()
    }
  })

  it('auto-scrolls the cursor into view', async () => {
    Object.defineProperty(cursorEl, 'offsetTop',
      { value: 900, configurable: true })
    Object.defineProperty(cursorEl, 'offsetHeight',
      { value: 60, configurable: true })
    const xml = ref(XML)
    const { api, scroller } = harness(xml)
    scroller.scrollTop = 0
    await api.renderNow()
    api.seekCursorToBeat(3)
    expect(scroller.scrollTop).toBeGreaterThan(700)
  })
})
