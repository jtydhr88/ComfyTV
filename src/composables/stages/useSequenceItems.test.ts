import { describe, it, expect, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { VideoClip } from './videoClipInputs'
import {
  parseSegments,
  reconcileSegments,
  TRANSITIONS,
  useSequenceItems,
  type Segment,
} from './useSequenceItems'

function seg(slot: string, patch: Partial<Segment> = {}): Segment {
  return { slot, in_s: 0, out_s: 0, transition: 'cut', trans_dur: 0.5, ...patch }
}

describe('parseSegments', () => {
  it('parses a JSON array of segments', () => {
    expect(parseSegments(JSON.stringify([seg('video0')]))).toEqual([seg('video0')])
  })
  it('returns [] for empty, invalid JSON, or non-arrays', () => {
    expect(parseSegments('')).toEqual([])
    expect(parseSegments('oops')).toEqual([])
    expect(parseSegments('{"slot":"video0"}')).toEqual([])
  })
  it('drops entries without a string slot', () => {
    expect(parseSegments('[{"slot":1},null,{"slot":"video0"}]')).toEqual([{ slot: 'video0' }])
  })
})

describe('reconcileSegments', () => {
  it('keeps saved segments for connected slots', () => {
    const saved = [seg('video1', { in_s: 2 }), seg('video0')]
    expect(reconcileSegments(saved, ['video0', 'video1'])).toEqual(saved)
  })
  it('drops disconnected slots and appends new ones with defaults', () => {
    const saved = [seg('video1', { transition: 'fade' })]
    expect(reconcileSegments(saved, ['video1', 'video2'])).toEqual([
      seg('video1', { transition: 'fade' }),
      seg('video2'),
    ])
  })
  it('builds defaults from scratch', () => {
    expect(reconcileSegments([], ['video0'])).toEqual([seg('video0')])
  })
})

function makeWidget(name: string, value: unknown = '') {
  return { name, value, callback: vi.fn() }
}

function makeNode(segments = '') {
  return { id: 1, widgets: [makeWidget('segments', segments)], onConfigure: null as any } as any
}

function clip(n: number): VideoClip {
  return { key: `video${n}`, url: `/v${n}.mp4`, color: '#fff' }
}

function setup(segments = '', clipList: VideoClip[] = []) {
  const node = makeNode(segments)
  const clips = ref<VideoClip[]>(clipList)
  const api = useSequenceItems(node, clips)
  return { node, clips, api }
}

function evt(value: string): Event {
  return { target: { value } } as unknown as Event
}

describe('useSequenceItems', () => {
  it('exposes cut plus the ffmpeg transitions', () => {
    expect(TRANSITIONS[0]).toBe('cut')
    expect(TRANSITIONS).toContain('dissolve')
  })

  it('creates default rows for connected clips and persists them', () => {
    const { api, node } = setup('', [clip(0), clip(1)])
    expect(api.rows.value).toEqual([seg('video0'), seg('video1')])
    expect(node.widgets[0].value).toBe(JSON.stringify([seg('video0'), seg('video1')]))
  })

  it('keeps saved settings while reconciling to the connected clips', async () => {
    const saved = [seg('video1', { in_s: 3, transition: 'fade' })]
    const { api, clips } = setup(JSON.stringify(saved), [clip(1)])
    expect(api.rows.value).toEqual(saved)
    clips.value = [clip(1), clip(2)]
    await nextTick()
    expect(api.rows.value).toEqual([...saved, seg('video2')])
  })

  it('moveRow swaps adjacent rows and ignores out-of-range moves', () => {
    const { api } = setup('', [clip(0), clip(1)])
    api.moveRow(0, 1)
    expect(api.rows.value.map(s => s.slot)).toEqual(['video1', 'video0'])
    api.moveRow(0, -1)
    api.moveRow(5, 1)
    expect(api.rows.value.map(s => s.slot)).toEqual(['video1', 'video0'])
  })

  it('updateRow patches a row and ignores bad indices', () => {
    const { api } = setup('', [clip(0)])
    api.updateRow(0, { in_s: 4 })
    expect(api.rows.value[0].in_s).toBe(4)
    api.updateRow(9, { in_s: 1 })
    expect(api.rows.value).toHaveLength(1)
  })

  it('onTimeInput clamps into [0, 3600] and ignores NaN', () => {
    const { api } = setup('', [clip(0)])
    api.onTimeInput(0, 'in_s', evt('5000'))
    expect(api.rows.value[0].in_s).toBe(3600)
    api.onTimeInput(0, 'out_s', evt('-3'))
    expect(api.rows.value[0].out_s).toBe(0)
    api.onTimeInput(0, 'in_s', evt('abc'))
    expect(api.rows.value[0].in_s).toBe(3600)
  })

  it('onTransitionChange writes the chosen transition', () => {
    const { api } = setup('', [clip(0), clip(1)])
    api.onTransitionChange(1, evt('fade'))
    expect(api.rows.value[1].transition).toBe('fade')
  })

  it('onDurInput clamps into [0.1, 5] and ignores NaN', () => {
    const { api } = setup('', [clip(0), clip(1)])
    api.onDurInput(1, evt('9'))
    expect(api.rows.value[1].trans_dur).toBe(5)
    api.onDurInput(1, evt('0'))
    expect(api.rows.value[1].trans_dur).toBe(0.1)
    api.onDurInput(1, evt('x'))
    expect(api.rows.value[1].trans_dur).toBe(0.1)
  })

  it('clears the widget when every clip disconnects', async () => {
    const { node, clips } = setup('', [clip(0)])
    clips.value = []
    await nextTick()
    expect(node.widgets[0].value).toBe('')
  })
})
