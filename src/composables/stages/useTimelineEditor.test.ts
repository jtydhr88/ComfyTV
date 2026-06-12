import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'

import type { ResolvedInput, StageState } from '@/stores/stageStore'

import { useTimelineEditor } from './useTimelineEditor'

function makeWidget(name: string, value: any = '') {
  return { name, value, callback: vi.fn() }
}

function makeNode(widgets: any[] = []): any {
  return { widgets, onConfigure: null as any }
}

function makeState(inputs: ResolvedInput[] = []): StageState {
  return reactive({
    kind: 'timeline',
    variant: 'generator',
    outputType: 'COMFYTV_TIMELINE',
    output: null,
    outputs: [null],
    running: false,
    inputs,
    mainPrompt: '',
  }) as StageState
}

function imageInput(slot: string, url: string): ResolvedInput {
  return { slot, type: 'COMFYTV_IMAGE', source: 'upstream', content: url }
}

describe('useTimelineEditor', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('exposes keyframes derived from upstream image inputs', () => {
    const state = makeState([
      imageInput('image0', '/u/1'),
      imageInput('image1', '/u/2'),
      { slot: 'audio', type: 'COMFYTV_AUDIO', source: 'upstream', content: '/a' },
    ])
    const { keyframes, audioUrl } = useTimelineEditor(makeNode([makeWidget('timeline_data', '')]), state, ref(null))
    expect(keyframes.value).toEqual(['/u/1', '/u/2'])
    expect(audioUrl.value).toBe('/a')
  })

  it('addSegment uses the picked keyframe as imageUrl and selects it', () => {
    const state = makeState([imageInput('image0', '/u/A'), imageInput('image1', '/u/B')])
    const node = makeNode([makeWidget('timeline_data', '')])
    const { segments, selectedId, addSegment } = useTimelineEditor(node, state, ref(null))
    addSegment(1)
    expect(segments.value).toHaveLength(1)
    expect(segments.value[0].imageUrl).toBe('/u/B')
    expect(segments.value[0].sourceIndex).toBe(1)
    expect(selectedId.value).toBe(segments.value[0].id)
  })

  it('setLength clamps to [1, 600]', () => {
    const state = makeState([imageInput('image0', '/u')])
    const { segments, addSegment, setLength } = useTimelineEditor(
      makeNode([makeWidget('timeline_data', '')]), state, ref(null),
    )
    addSegment(0)
    const id = segments.value[0].id
    setLength(id, 0)
    expect(segments.value[0].length).toBe(1)
    setLength(id, 9999)
    expect(segments.value[0].length).toBe(600)
  })

  it('setFrameRate clamps to [1, 120] and propagates to frame_rate widget', () => {
    const fw = makeWidget('frame_rate', 24)
    const { frameRate, setFrameRate } = useTimelineEditor(
      makeNode([makeWidget('timeline_data', ''), fw]),
      makeState(), ref(null),
    )
    setFrameRate(0)
    expect(frameRate.value).toBe(1)
    expect(fw.value).toBe(1)
    setFrameRate(999)
    expect(frameRate.value).toBe(120)
    expect(fw.value).toBe(120)
  })

  it('totalFrames sums segment lengths', () => {
    const state = makeState([imageInput('image0', '/a'), imageInput('image1', '/b')])
    const { totalFrames, addSegment, setLength, segments } = useTimelineEditor(
      makeNode([makeWidget('timeline_data', '')]), state, ref(null),
    )
    addSegment(0); addSegment(1)
    setLength(segments.value[0].id, 30)
    setLength(segments.value[1].id, 45)
    expect(totalFrames.value).toBe(75)
  })

  it('serialize/restore roundtrips segments + audioSeg + frameRate', () => {
    const dataW = makeWidget('timeline_data', '')
    const frW = makeWidget('frame_rate', 24)
    const state = makeState([
      imageInput('image0', '/k'),
      { slot: 'audio', type: 'COMFYTV_AUDIO', source: 'upstream', content: '/audio' },
    ])
    const node = makeNode([dataW, frW])
    const { addSegment, segments, addAudio, setFrameRate } = useTimelineEditor(node, state, ref(null))

    setFrameRate(30)
    addSegment(0)
    addAudio()
    const segId = segments.value[0].id

    const dataW2 = makeWidget('timeline_data', dataW.value)
    const frW2  = makeWidget('frame_rate', frW.value)
    const node2 = makeNode([dataW2, frW2])
    const ed2 = useTimelineEditor(node2, makeState([imageInput('image0', '/k')]), ref(null))
    expect(ed2.frameRate.value).toBe(30)
    expect(ed2.segments.value).toHaveLength(1)
    expect(ed2.segments.value[0].id).toBe(segId)
    expect(ed2.audioSeg.value?.audioUrl).toBe('/audio')
  })

  it('removeSegment clears selection if removing the selected one', () => {
    const state = makeState([imageInput('image0', '/x')])
    const { segments, selectedId, addSegment, removeSegment } = useTimelineEditor(
      makeNode([makeWidget('timeline_data', '')]), state, ref(null),
    )
    addSegment(0)
    const id = segments.value[0].id
    removeSegment(id)
    expect(segments.value).toHaveLength(0)
    expect(selectedId.value).toBeNull()
  })

  it('watch on keyframes re-syncs segment thumbnails when upstream image changes', async () => {
    const state = makeState([imageInput('image0', '/old')])
    const { segments, addSegment } = useTimelineEditor(
      makeNode([makeWidget('timeline_data', '')]), state, ref(null),
    )
    addSegment(0)
    expect(segments.value[0].imageUrl).toBe('/old')

    state.inputs = [imageInput('image0', '/new')]
    await nextTick()
    expect(segments.value[0].imageUrl).toBe('/new')
  })

  function makePointer(type: string, clientX: number, pointerId = 1): PointerEvent {
    const e = new Event(type, { bubbles: true }) as any
    e.clientX = clientX
    e.clientY = 0
    e.pointerId = pointerId
    return e as PointerEvent
  }

  function pointerHostEl(): HTMLElement {
    const el = document.createElement('div')
    document.body.appendChild(el)
    return el
  }

  it('drag reorders segments: drop past the next segment center swaps order', () => {
    const state = makeState([imageInput('image0', '/a'), imageInput('image1', '/b')])
    const rootEl = ref<HTMLElement | null>(pointerHostEl())
    const { segments, addSegment, setLength, onSegPointerDown, drag } = useTimelineEditor(
      makeNode([makeWidget('timeline_data', '')]), state, rootEl,
    )
    addSegment(0); addSegment(1)
    setLength(segments.value[0].id, 24)
    setLength(segments.value[1].id, 24)
    const [first, second] = [segments.value[0].id, segments.value[1].id]

    onSegPointerDown(makePointer('pointerdown', 0), segments.value[0], 0)
    expect(drag.value?.id).toBe(first)
    rootEl.value!.dispatchEvent(makePointer('pointermove', 90))
    expect(segments.value.map(s => s.id)).toEqual([second, first])
    rootEl.value!.dispatchEvent(makePointer('pointerup', 90))
    expect(drag.value).toBeNull()
  })

  it('segment resize drag extends length proportional to dx / PPF', () => {
    const state = makeState([imageInput('image0', '/a')])
    const rootEl = ref<HTMLElement | null>(pointerHostEl())
    const { segments, addSegment, setLength, onResizePointerDown } = useTimelineEditor(
      makeNode([makeWidget('timeline_data', '')]), state, rootEl,
    )
    addSegment(0)
    setLength(segments.value[0].id, 24)
    onResizePointerDown(makePointer('pointerdown', 100), segments.value[0])
    rootEl.value!.dispatchEvent(makePointer('pointermove', 130))
    expect(segments.value[0].length).toBe(34)
    rootEl.value!.dispatchEvent(makePointer('pointerup', 130))
  })

  it('audio segment drag moves start in frames; resize extends length', () => {
    const state = makeState([
      imageInput('image0', '/img'),
      { slot: 'audio', type: 'COMFYTV_AUDIO', source: 'upstream', content: '/audio' },
    ])
    const rootEl = ref<HTMLElement | null>(pointerHostEl())
    const { audioSeg, addAudio, onAudioPointerDown, onAudioResizePointerDown, audioDrag } =
      useTimelineEditor(makeNode([makeWidget('timeline_data', '')]), state, rootEl)
    addAudio()
    const startLen = audioSeg.value!.length

    onAudioPointerDown(makePointer('pointerdown', 50))
    expect(audioDrag.value).toBe(true)
    rootEl.value!.dispatchEvent(makePointer('pointermove', 110))
    expect(audioSeg.value!.start).toBe(20)
    rootEl.value!.dispatchEvent(makePointer('pointerup', 110))
    expect(audioDrag.value).toBe(false)

    onAudioResizePointerDown(makePointer('pointerdown', 0))
    rootEl.value!.dispatchEvent(makePointer('pointermove', 30))
    expect(audioSeg.value!.length).toBe(startLen + 10)
    rootEl.value!.dispatchEvent(makePointer('pointerup', 30))
  })
})
