import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useMidiEditor } from './useMidiEditor'

function make(initial = '') {
  const widget = ref(initial)
  const roll = useMidiEditor({ widget })
  return { widget, roll }
}

const STATE = JSON.stringify({
  tempo_map: [{ beat: 0, t: 0, bpm: 120 }],
  programs: { '0': 33, '2': 48 },
  events: [
    { t: 0, dur: 0.5, midi: 60, vel: 100, ch: 0 },
    { t: 1, dur: 0.1, midi: 38, vel: 120, ch: 9 },
    { t: 2, dur: 0.5, midi: 55, vel: 80, ch: 2 },
  ],
})

describe('useMidiEditor', () => {
  it('hydrates channels sorted by ch with programs', () => {
    const { roll } = make(STATE)
    expect(roll.channels.map((c) => c.ch)).toEqual([0, 2, 9])
    expect(roll.channels[0].program).toBe(33)
    expect(roll.channels[1].program).toBe(48)
    expect(roll.channels[2].notes[0].midi).toBe(38)
    expect(roll.contentEnd.value).toBeCloseTo(2.5)
  })

  it('starts with a single empty channel when widget is empty', () => {
    const { roll } = make()
    expect(roll.channels.length).toBe(1)
    expect(roll.channels[0].ch).toBe(0)
    expect(roll.channels[0].notes).toEqual([])
  })

  it('snapshot roundtrips through hydrate', () => {
    const { roll } = make(STATE)
    const snap = JSON.parse(roll.snapshot())
    expect(snap.events.length).toBe(3)
    expect(snap.events[0]).toMatchObject({ t: 0, midi: 60, ch: 0 })
    expect(snap.programs).toEqual({ '0': 33, '2': 48 })
    expect(snap.tempo_map[0].bpm).toBe(120)
    const second = make(JSON.stringify(snap))
    expect(second.roll.snapshot()).toBe(roll.snapshot())
  })

  it('add, drag, resize and delete in seconds', () => {
    const { roll } = make()
    const id = roll.addNote(60, 1.234)
    const n = roll.findNote(id)!
    expect(n.start).toBeCloseTo(1.234)
    roll.beginDrag()
    roll.dragBy(2, 0.5)
    roll.endDrag()
    expect(n.midi).toBe(62)
    expect(n.start).toBeCloseTo(1.734)
    roll.beginResize(id)
    roll.resizeBy(id, 0.4)
    roll.endDrag()
    expect(n.dur).toBeCloseTo(0.65)
    roll.deleteSelected()
    expect(roll.current.value.notes.length).toBe(0)
  })

  it('snap quantizes when enabled and undo restores', () => {
    const { roll } = make()
    roll.snap.value = '250ms'
    const id = roll.addNote(60, 1.13)
    expect(roll.findNote(id)!.start).toBeCloseTo(1.25)
    roll.undo()
    expect(roll.current.value.notes.length).toBe(0)
  })

  it('addChannel picks free channels and skips the drum channel', () => {
    const { roll } = make()
    roll.addChannel(false)
    expect(roll.channels.map((c) => c.ch)).toEqual([0, 1])
    roll.addChannel(true)
    expect(roll.channels.map((c) => c.ch)).toEqual([0, 1, 9])
    roll.addChannel(true)
    expect(roll.channels.map((c) => c.ch)).toEqual([0, 1, 9])
    roll.addChannel(false)
    expect(roll.channels.map((c) => c.ch)).toEqual([0, 1, 2, 9])
  })

  it('drum channel is excluded from programs in snapshot', () => {
    const { roll } = make()
    roll.addChannel(true)
    roll.setActiveChannel(roll.channels.findIndex((c) => c.ch === 9))
    roll.addNote(38, 0)
    const snap = JSON.parse(roll.snapshot())
    expect(snap.programs['9']).toBeUndefined()
    expect(snap.events[0].ch).toBe(9)
  })

  it('marquee selection is bounded by time and pitch', () => {
    const { roll } = make(STATE)
    roll.selectInRect(0, 1.5, 30, 70)
    expect(roll.selection.value.size).toBe(1)
    roll.selectAll()
    expect(roll.selection.value.size).toBe(1)
  })

  it('velocity clamps to 1..127', () => {
    const { roll } = make()
    const id = roll.addNote(60, 0)
    roll.setNoteVelocity(id, 500)
    expect(roll.findNote(id)!.vel).toBe(127)
    roll.setNoteVelocity(id, -3)
    expect(roll.findNote(id)!.vel).toBe(1)
  })

  it('persists to the widget after edits (debounced)', async () => {
    vi.useFakeTimers()
    try {
      const { widget, roll } = make()
      roll.addNote(60, 0.5)
      await vi.advanceTimersByTimeAsync(400)
      const persisted = JSON.parse(widget.value)
      expect(persisted.events.length).toBe(1)
      expect(persisted.events[0].midi).toBe(60)
    } finally {
      vi.useRealTimers()
    }
  })
})
