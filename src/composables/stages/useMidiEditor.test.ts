import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { MIN_DUR, NOTE_HEIGHT, useMidiEditor } from './useMidiEditor'

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

  it('converts between seconds/midi and pixels', () => {
    const { roll } = make()
    roll.pxPerSec.value = 100
    expect(roll.secToX(2)).toBe(200)
    expect(roll.xToSec(200)).toBe(2)
    expect(roll.midiToY(127)).toBe(0)
    expect(roll.yToMidi(0)).toBe(127)
    expect(roll.yToMidi(NOTE_HEIGHT * 67 + 1)).toBe(60)
    expect(roll.yToMidi(NOTE_HEIGHT * 500)).toBe(0)
  })

  it('hydrate drops invalid events and defaults velocity', () => {
    const { roll } = make(JSON.stringify({
      events: [
        { t: -1, dur: 0.5, midi: 60 },
        { t: 0, dur: 0, midi: 60 },
        { t: 0, dur: 0.5, midi: 'x' },
        { t: 0.5, dur: 0.5, midi: 61 },
      ],
    }))
    expect(roll.current.value.notes.length).toBe(1)
    expect(roll.current.value.notes[0].midi).toBe(61)
    expect(roll.current.value.notes[0].vel).toBe(100)
  })

  it('selectOne toggles additively and clearSelection empties', () => {
    const { roll } = make()
    const a = roll.addNote(60, 0)
    const b = roll.addNote(62, 1)
    roll.selectOne(a)
    expect([...roll.selection.value]).toEqual([a])
    roll.selectOne(b, true)
    expect(roll.selection.value.size).toBe(2)
    roll.selectOne(b, true)
    expect(roll.selection.value.has(b)).toBe(false)
    roll.clearSelection()
    expect(roll.selection.value.size).toBe(0)
  })

  it('clearChannel wipes the active channel and is undoable', () => {
    const { roll } = make()
    roll.addNote(60, 0)
    roll.clearChannel()
    expect(roll.current.value.notes.length).toBe(0)
    roll.undo()
    expect(roll.current.value.notes.length).toBe(1)
  })

  it('left-edge resize moves the start and keeps the end fixed', () => {
    const { roll } = make()
    const id = roll.addNote(60, 2, 2)
    roll.beginResize(id)
    roll.resizeLeftBy(id, -1)
    const n = roll.findNote(id)!
    expect(n.start).toBeCloseTo(1)
    expect(n.dur).toBeCloseTo(3)
    roll.resizeLeftBy(id, 10)
    expect(n.start).toBeCloseTo(4 - MIN_DUR)
    expect(n.dur).toBeCloseTo(MIN_DUR)
    roll.endDrag()
    roll.resizeLeftBy(id, -1)
    expect(n.start).toBeCloseTo(4 - MIN_DUR)
  })

  it('left-edge resize respects the snap grid minimum', () => {
    const { roll } = make()
    roll.snap.value = '250ms'
    const id = roll.addNote(60, 2, 1)
    roll.beginResize(id)
    roll.resizeLeftBy(id, 5)
    const n = roll.findNote(id)!
    expect(n.start).toBeCloseTo(2.75)
    expect(n.dur).toBeCloseTo(0.25)
    roll.endDrag()
  })

  it('beginVelocityEdit pushes history for undo', () => {
    const { roll } = make()
    const id = roll.addNote(60, 0)
    roll.beginVelocityEdit()
    roll.setNoteVelocity(id, 30)
    expect(roll.findNote(id)!.vel).toBe(30)
    roll.undo()
    expect(roll.current.value.notes[0].vel).toBe(100)
    roll.setNoteVelocity(999, 50)
  })

  it('addChannel is a no-op once every melodic channel is used', () => {
    const { roll } = make()
    for (let i = 0; i < 20; i++) roll.addChannel(false)
    expect(roll.channels.length).toBe(15)
    expect(roll.channels.some((c) => c.ch === 9)).toBe(false)
  })

  it('removeChannel keeps at least one channel and clamps the active index', () => {
    const { roll } = make()
    roll.removeChannel(0)
    expect(roll.channels.length).toBe(1)
    roll.addChannel(false)
    roll.addChannel(false)
    roll.setActiveChannel(2)
    roll.removeChannel(2)
    expect(roll.channels.length).toBe(2)
    expect(roll.activeChannel.value).toBe(1)
  })

  it('setProgram clamps and ignores unknown indices', () => {
    const { roll } = make()
    roll.setProgram(0, 200)
    expect(roll.channels[0].program).toBe(127)
    roll.setProgram(0, -5)
    expect(roll.channels[0].program).toBe(0)
    roll.setProgram(9, 10)
    expect(roll.channels.length).toBe(1)
  })

  it('loadEditorState replaces content and is undoable', () => {
    const { roll } = make()
    roll.addNote(60, 0)
    roll.loadEditorState({ events: [{ t: 1, dur: 1, midi: 70 }] })
    expect(roll.current.value.notes[0].midi).toBe(70)
    roll.undo()
    expect(roll.current.value.notes[0].midi).toBe(60)
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
