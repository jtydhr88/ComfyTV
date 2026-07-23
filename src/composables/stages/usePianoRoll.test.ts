import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { usePianoRoll, NOTE_HEIGHT } from './usePianoRoll'

function harness(widgetJson = '') {
  const widget = ref(widgetJson)
  let api: ReturnType<typeof usePianoRoll> | null = null
  const Comp = defineComponent({
    setup() {
      api = usePianoRoll({ widget })
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  return { wrapper, api: api!, widget }
}

describe('usePianoRoll', () => {
  it('adds a snapped note and selects it', () => {
    const { api } = harness()
    api.snap.value = '1/8'
    const id = api.addNote(60, 1.13)
    const n = api.findNote(id)!
    expect(n.start).toBe(1.0)
    expect(n.dur).toBe(0.5)
    expect(api.selection.value.has(id)).toBe(true)
  })

  it('moves selected notes with snap and clamps to grid range', () => {
    const { api } = harness()
    const id = api.addNote(60, 0)
    api.moveSelected(3, 1.5)
    const n = api.findNote(id)!
    expect(n.midi).toBe(63)
    expect(n.start).toBe(1.5)
    api.moveSelected(200, 0)
    expect(api.findNote(id)!.midi).toBe(127)
    api.moveSelected(0, -99)
    expect(api.findNote(id)!.start).toBe(0)
  })

  it('resizes with snap and enforces a minimum length', () => {
    const { api } = harness()
    const id = api.addNote(60, 0, 1)
    api.resizeNote(id, 1.3)
    expect(api.findNote(id)!.dur).toBe(1.5)
    api.resizeNote(id, 0.01)
    expect(api.findNote(id)!.dur).toBe(0.5)
  })

  it('left-edge resize moves the start and keeps the end fixed', () => {
    const { api } = harness()
    const id = api.addNote(60, 2, 2)
    api.beginResize(id)
    api.resizeLeftBy(id, -1)
    const n = api.findNote(id)!
    expect(n.start).toBe(1)
    expect(n.dur).toBe(3)
    api.resizeLeftBy(id, 10)
    expect(api.findNote(id)!.start).toBe(3.5)
    expect(api.findNote(id)!.dur).toBe(0.5)
    api.endDrag()
  })

  it('deletes selection and supports undo', () => {
    const { api } = harness()
    api.addNote(60, 0)
    api.addNote(64, 1)
    expect(api.current.value.notes.length).toBe(2)
    api.deleteSelected()
    expect(api.current.value.notes.length).toBe(1)
    api.undo()
    expect(api.current.value.notes.length).toBe(2)
  })

  it('keeps parts independent and caps at four', () => {
    const { api } = harness()
    api.addNote(60, 0)
    api.addPart()
    expect(api.activePart.value).toBe(1)
    expect(api.current.value.notes.length).toBe(0)
    api.addNote(40, 0)
    api.setActivePart(0)
    expect(api.current.value.notes.length).toBe(1)
    api.addPart()
    api.addPart()
    api.addPart()
    expect(api.parts.length).toBe(4)
  })

  it('selectInRect picks intersecting notes, selectAll picks everything', () => {
    const { api } = harness()
    api.addNote(60, 0, 1)
    api.addNote(64, 2, 1)
    api.addNote(70, 5, 1)
    api.selectInRect(0, 3, 58, 66)
    expect(api.selection.value.size).toBe(2)
    api.selectAll()
    expect(api.selection.value.size).toBe(3)
  })

  it('duplicateSelected clones a bar-quantized span after the selection', () => {
    const { api } = harness()
    api.addNote(60, 0, 1)
    api.addNote(64, 1, 1)
    api.selectAll()
    api.duplicateSelected()
    expect(api.current.value.notes.length).toBe(4)
    const starts = api.current.value.notes.map((n) => n.start).sort((a, b) => a - b)
    expect(starts).toEqual([0, 1, 4, 5])
    expect(api.selection.value.size).toBe(2)
  })

  it('quantizeSelected snaps starts to the grid', () => {
    const { api } = harness()
    api.snap.value = 'free'
    const id = api.addNote(60, 1.13, 1)
    api.snap.value = '1/16'
    api.selectOne(id)
    api.quantizeSelected()
    expect(api.findNote(id)!.start).toBe(1.25)
  })

  it('velocity edits clamp and persist, hydrate restores them', async () => {
    vi.useFakeTimers()
    const { api, widget } = harness()
    const id = api.addNote(60, 0)
    api.beginVelocityEdit()
    api.setNoteVelocity(id, 1.7)
    expect(api.findNote(id)!.vel).toBe(1)
    api.setNoteVelocity(id, 0.4)
    await Promise.resolve()
    vi.advanceTimersByTime(400)
    const saved = JSON.parse(widget.value)
    expect(saved.parts[0].notes[0].vel).toBe(0.4)
    vi.useRealTimers()
    const second = harness(widget.value)
    expect(second.api.parts[0].notes[0].vel).toBe(0.4)
  })

  it('part program persists and hydrates', async () => {
    vi.useFakeTimers()
    const { api, widget } = harness()
    api.current.value.program = 'saw_lead'
    api.addNote(60, 0)
    await Promise.resolve()
    vi.advanceTimersByTime(400)
    expect(JSON.parse(widget.value).parts[0].program).toBe('saw_lead')
    vi.useRealTimers()
    const second = harness(widget.value)
    expect(second.api.parts[0].program).toBe('saw_lead')
  })

  it('renamePart trims and applies', () => {
    const { api } = harness()
    api.renamePart(0, '  Bass Line  ')
    expect(api.parts[0].name).toBe('Bass Line')
  })

  it('persists and hydrates the percussion flag per part', async () => {
    vi.useFakeTimers()
    const { api, widget } = harness()
    api.current.value.percussion = true
    api.addNote(36, 0)
    await Promise.resolve()
    vi.advanceTimersByTime(400)
    const saved = JSON.parse(widget.value)
    expect(saved.parts[0].percussion).toBe(true)
    vi.useRealTimers()
    const second = harness(widget.value)
    expect(second.api.parts[0].percussion).toBe(true)
  })

  it('hydrates from widget JSON and grows bars to fit notes', () => {
    const { api } = harness(JSON.stringify({
      tempo: 90,
      beats_per_bar: 3,
      bars: 2,
      parts: [{ name: 'Lead', notes: [
        { midi: 72, start: 0, dur: 1 },
        { midi: 74, start: 10, dur: 2 },
      ] }],
    }))
    expect(api.tempo.value).toBe(90)
    expect(api.beatsPerBar.value).toBe(3)
    expect(api.parts[0].notes.length).toBe(2)
    expect(api.bars.value).toBe(4)
  })

  it('persists state back to the widget after edits', async () => {
    vi.useFakeTimers()
    const { api, widget } = harness()
    api.addNote(60, 0)
    await Promise.resolve()
    vi.advanceTimersByTime(400)
    const saved = JSON.parse(widget.value)
    expect(saved.parts[0].notes)
      .toEqual([{ midi: 60, start: 0, dur: 0.5, vel: 0.8 }])
    vi.useRealTimers()
  })

  it('converts between beats/midi and pixels', () => {
    const { api } = harness()
    api.pxPerBeat.value = 30
    expect(api.beatToX(2)).toBe(60)
    expect(api.xToBeat(60)).toBe(2)
    expect(api.midiToY(127)).toBe(0)
    expect(api.yToMidi(0)).toBe(127)
    expect(api.yToMidi(NOTE_HEIGHT * 67 + 1)).toBe(60)
  })

  it('step input enters notes duration-first and advances the cursor', () => {
    const { api } = harness()
    api.stepDur.value = 1
    const id1 = api.stepInsert('c')!
    expect(api.findNote(id1)!.midi).toBe(60)
    expect(api.stepCursor.value).toBe(1)
    api.stepDur.value = 0.5
    const id2 = api.stepInsert('e')!
    expect(api.findNote(id2)!.midi).toBe(64)
    expect(api.findNote(id2)!.start).toBe(1)
    expect(api.stepCursor.value).toBe(1.5)
  })

  it('step input picks the octave closest to the previous note', () => {
    const { api } = harness()
    api.stepInsert('c')
    const idB = api.stepInsert('b')!
    expect(api.findNote(idB)!.midi).toBe(59)
    const idF = api.stepInsert('f')!
    expect(api.findNote(idF)!.midi).toBe(65)
  })

  it('step rest advances without adding, dot scales duration', () => {
    const { api } = harness()
    api.stepDur.value = 1
    api.stepDotted.value = true
    api.stepRest()
    expect(api.stepCursor.value).toBe(1.5)
    expect(api.current.value.notes.length).toBe(0)
  })

  it('step backspace removes the note ending at the cursor', () => {
    const { api } = harness()
    api.stepInsert('c')
    api.stepInsert('d')
    expect(api.current.value.notes.length).toBe(2)
    api.stepBackspace()
    expect(api.current.value.notes.length).toBe(1)
    expect(api.stepCursor.value).toBe(1)
  })

  it('step transpose shifts the last entered note and future octaves', () => {
    const { api } = harness()
    const id = api.stepInsert('c')!
    api.stepTranspose(1)
    expect(api.findNote(id)!.midi).toBe(61)
  })

  it('step entry grows bars past the end of the grid', () => {
    const { api } = harness()
    api.bars.value = 1
    api.stepDur.value = 4
    api.stepInsert('c')
    api.stepInsert('d')
    expect(api.bars.value).toBe(2)
  })

  it('loadEditorState replaces content and is undoable', () => {
    const { api } = harness()
    api.addNote(60, 0)
    api.loadEditorState({
      tempo: 124,
      beats_per_bar: 4,
      parts: [{ name: 'Imported', notes: [{ midi: 65, start: 2, dur: 1 }] }],
    })
    expect(api.tempo.value).toBe(124)
    expect(api.parts[0].name).toBe('Imported')
    expect(api.parts[0].notes[0].midi).toBe(65)
    api.undo()
    expect(api.parts[0].notes[0].midi).toBe(60)
  })
})
