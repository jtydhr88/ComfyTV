import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { parseSrt, secToSrtTime, serializeSrt, useSubtitleCues, type Cue } from './useSubtitleCues'

const SRT = [
  '1',
  '00:00:01,500 --> 00:00:03,000',
  'Hello',
  '',
  '2',
  '00:01:00.250 --> 00:01:02.750',
  'line one',
  'line two',
].join('\n')

describe('secToSrtTime', () => {
  it('formats zero-padded h:m:s,ms', () => {
    expect(secToSrtTime(0)).toBe('00:00:00,000')
    expect(secToSrtTime(3661.25)).toBe('01:01:01,250')
  })
  it('clamps negatives to zero', () => {
    expect(secToSrtTime(-4)).toBe('00:00:00,000')
  })
})

describe('parseSrt', () => {
  it('parses comma and dot millisecond separators', () => {
    const cues = parseSrt(SRT)
    expect(cues).toEqual([
      { start: 1.5, end: 3, text: 'Hello' },
      { start: 60.25, end: 62.75, text: 'line one\nline two' },
    ])
  })

  it('pads short millisecond fields', () => {
    const cues = parseSrt('00:00:00,5 --> 00:00:01,25\nx')
    expect(cues[0].start).toBe(0.5)
    expect(cues[0].end).toBe(1.25)
  })

  it('ignores text lines outside a cue and returns [] for empty input', () => {
    expect(parseSrt('stray text\nmore')).toEqual([])
    expect(parseSrt('')).toEqual([])
  })

  it('blank line closes the current cue', () => {
    const cues = parseSrt('00:00:00,000 --> 00:00:01,000\na\n\nignored tail')
    expect(cues).toEqual([{ start: 0, end: 1, text: 'a' }])
  })
})

describe('serializeSrt', () => {
  it('round-trips through parseSrt', () => {
    const cues: Cue[] = [
      { start: 1.5, end: 3, text: 'Hello' },
      { start: 60.25, end: 62.75, text: 'line one\nline two' },
    ]
    expect(parseSrt(serializeSrt(cues))).toEqual(cues)
  })

  it('numbers cues sequentially', () => {
    const out = serializeSrt([
      { start: 0, end: 1, text: 'a' },
      { start: 1, end: 2, text: 'b' },
    ])
    expect(out.startsWith('1\n00:00:00,000 --> 00:00:01,000\na\n\n2\n')).toBe(true)
  })
})

function evt(value: string): Event {
  return { target: { value } } as unknown as Event
}

describe('useSubtitleCues', () => {
  function setup(initial = '') {
    const subs = ref(initial)
    const api = useSubtitleCues(subs)
    return { subs, api }
  }

  it('derives cues from the raw widget text', () => {
    const { api } = setup(SRT)
    expect(api.cues.value).toHaveLength(2)
  })

  it('addCue starts at 0 on an empty list', () => {
    const { api, subs } = setup()
    api.addCue()
    expect(api.cues.value).toEqual([{ start: 0, end: 2, text: '' }])
    expect(subs.value).toContain('00:00:00,000 --> 00:00:02,000')
  })

  it('addCue chains after the last cue end', () => {
    const { api } = setup('00:00:00,000 --> 00:00:03,000\nx')
    api.addCue()
    expect(api.cues.value[1]).toEqual({ start: 3, end: 5, text: '' })
  })

  it('onCueNum clamps to >= 0 and ignores NaN', () => {
    const { api } = setup('00:00:01,000 --> 00:00:02,000\nx')
    api.onCueNum(0, 'start', evt('-5'))
    expect(api.cues.value[0].start).toBe(0)
    api.onCueNum(0, 'end', evt('4.5'))
    expect(api.cues.value[0].end).toBe(4.5)
    api.onCueNum(0, 'end', evt('abc'))
    expect(api.cues.value[0].end).toBe(4.5)
  })

  it('onCueText replaces the cue text', () => {
    const { api } = setup('00:00:00,000 --> 00:00:01,000\nold')
    api.onCueText(0, evt('new'))
    expect(api.cues.value[0].text).toBe('new')
  })

  it('updateCue leaves cues alone for out-of-range indices', () => {
    const { api } = setup('00:00:00,000 --> 00:00:01,000\nx')
    api.updateCue(9, { text: 'y' })
    expect(api.cues.value).toEqual([{ start: 0, end: 1, text: 'x' }])
  })

  it('removeCue deletes one cue; removing the last clears the widget', () => {
    const { api, subs } = setup(SRT)
    api.removeCue(0)
    expect(api.cues.value).toHaveLength(1)
    api.removeCue(0)
    expect(subs.value).toBe('')
  })
})
