import { computed, reactive, ref, watch, type Ref } from 'vue'

export interface RollNote {
  id: number
  midi: number
  start: number
  dur: number
  vel: number
}

export interface RollPart {
  name: string
  notes: RollNote[]
  percussion?: boolean
  program?: string
}

export const NOTE_HEIGHT = 12
export const KEY_WIDTH = 48
export const MAX_PARTS = 4

export type SnapChoice = '1/4' | '1/8' | '1/16' | '1/32' | 'free'

const SNAP_BEATS: Record<SnapChoice, number> = {
  '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125, free: 0,
}

export interface PianoRollOptions {
  widget: Ref<string>
}

interface PersistedNote {
  midi: number
  start: number
  dur: number
  vel?: number
}

interface PersistedState {
  tempo?: number
  beats_per_bar?: number
  beat_type?: number
  bars?: number
  parts?: Array<{
    name?: string
    notes?: PersistedNote[]
    percussion?: boolean
    program?: string
  }>
}

const DEFAULT_VEL = 0.8

export function usePianoRoll(opts: PianoRollOptions) {
  const tempo = ref(120)
  const beatsPerBar = ref(4)
  const beatType = ref(4)
  const bars = ref(16)
  const parts = reactive<RollPart[]>([{ name: 'Part 1', notes: [] }])
  const activePart = ref(0)
  const selection = ref<Set<number>>(new Set())
  const snap = ref<SnapChoice>('1/8')
  const pxPerBeat = ref(28)

  let nextId = 1
  let history: string[] = []
  let hydrating = false

  const snapBeats = computed(() => SNAP_BEATS[snap.value])
  const totalBeats = computed(() => bars.value * beatsPerBar.value)
  const current = computed<RollPart>(() =>
    parts[Math.min(activePart.value, parts.length - 1)])

  function snapBeat(beat: number): number {
    const s = snapBeats.value
    if (s <= 0) return Math.max(0, beat)
    return Math.max(0, Math.round(beat / s) * s)
  }

  function beatToX(beat: number): number {
    return beat * pxPerBeat.value
  }

  function xToBeat(x: number): number {
    return x / pxPerBeat.value
  }

  function midiToY(midi: number): number {
    return (127 - midi) * NOTE_HEIGHT
  }

  function yToMidi(y: number): number {
    return Math.max(0, Math.min(127, 127 - Math.floor(y / NOTE_HEIGHT)))
  }

  function snapshot(): string {
    return JSON.stringify({
      tempo: tempo.value,
      beats_per_bar: beatsPerBar.value,
      beat_type: beatType.value,
      bars: bars.value,
      parts: parts.map((p) => ({
        name: p.name,
        percussion: !!p.percussion,
        program: p.program || undefined,
        notes: p.notes.map((n) => ({
          midi: n.midi, start: n.start, dur: n.dur, vel: n.vel,
        })),
      })),
    })
  }

  function pushHistory(): void {
    history.push(snapshot())
    if (history.length > 50) history = history.slice(-50)
  }

  function hydrate(state: PersistedState): void {
    hydrating = true
    tempo.value = Math.min(400, Math.max(20, Number(state.tempo) || 120))
    beatsPerBar.value = Math.min(12, Math.max(1,
      Math.round(Number(state.beats_per_bar) || 4)))
    const bt = Math.round(Number(state.beat_type) || 4)
    beatType.value = [1, 2, 4, 8, 16].includes(bt) ? bt : 4
    const inParts = Array.isArray(state.parts) && state.parts.length
      ? state.parts.slice(0, MAX_PARTS)
      : [{ name: 'Part 1', notes: [] }]
    parts.splice(0, parts.length, ...inParts.map((p, i) => ({
      name: String(p?.name || `Part ${i + 1}`),
      percussion: !!p?.percussion,
      program: typeof p?.program === 'string' ? p.program : undefined,
      notes: (Array.isArray(p?.notes) ? p.notes : [])
        .filter((n) => Number.isFinite(n?.midi) && Number.isFinite(n?.start)
          && Number.isFinite(n?.dur) && n.dur > 0 && n.start >= 0)
        .map((n) => ({
          id: nextId++,
          midi: Math.max(0, Math.min(127, Math.round(n.midi))),
          start: n.start,
          dur: n.dur,
          vel: Number.isFinite(n.vel)
            ? Math.max(0.05, Math.min(1, Number(n.vel)))
            : DEFAULT_VEL,
        })),
    })))
    let maxEnd = 0
    for (const p of parts) {
      for (const n of p.notes) maxEnd = Math.max(maxEnd, n.start + n.dur)
    }
    bars.value = Math.min(256, Math.max(
      Math.round(Number(state.bars) || 16),
      Math.ceil(maxEnd / beatsPerBar.value) || 1))
    activePart.value = 0
    selection.value = new Set()
    hydrating = false
  }

  function undo(): void {
    const prev = history.pop()
    if (!prev) return
    try {
      hydrate(JSON.parse(prev) as PersistedState)
    } catch {}
  }

  function clampNote(n: RollNote): void {
    n.midi = Math.max(0, Math.min(127, n.midi))
    n.start = Math.max(0, Math.min(totalBeats.value - 0.0625, n.start))
    n.dur = Math.max(0.0625, Math.min(totalBeats.value - n.start, n.dur))
  }

  function addNote(midi: number, start: number, dur?: number): number {
    pushHistory()
    const note: RollNote = {
      id: nextId++,
      midi,
      start: snapBeat(start),
      dur: dur ?? (snapBeats.value || 1),
      vel: DEFAULT_VEL,
    }
    clampNote(note)
    current.value.notes.push(note)
    selection.value = new Set([note.id])
    return note.id
  }

  function findNote(id: number): RollNote | undefined {
    return current.value.notes.find((n) => n.id === id)
  }

  function moveSelected(dMidi: number, dBeat: number): void {
    if (!selection.value.size) return
    for (const id of selection.value) {
      const n = findNote(id)
      if (!n) continue
      n.midi += dMidi
      n.start = snapBeat(n.start + dBeat)
      clampNote(n)
    }
  }

  function resizeNote(id: number, dur: number): void {
    const n = findNote(id)
    if (!n) return
    const s = snapBeats.value
    n.dur = s > 0 ? Math.max(s, Math.round(dur / s) * s) : Math.max(0.0625, dur)
    clampNote(n)
  }

  function deleteSelected(): void {
    if (!selection.value.size) return
    pushHistory()
    const p = current.value
    p.notes = p.notes.filter((n) => !selection.value.has(n.id))
    selection.value = new Set()
  }

  function selectOne(id: number, additive = false): void {
    const next = additive ? new Set(selection.value) : new Set<number>()
    if (additive && next.has(id)) next.delete(id)
    else next.add(id)
    selection.value = next
  }

  function clearSelection(): void {
    selection.value = new Set()
  }

  function clearAll(): void {
    pushHistory()
    current.value.notes = []
    selection.value = new Set()
  }

  function selectAll(): void {
    selection.value = new Set(current.value.notes.map((n) => n.id))
  }

  function selectInRect(
    beat0: number, beat1: number, midi0: number, midi1: number,
    additive = false,
  ): void {
    const bLo = Math.min(beat0, beat1)
    const bHi = Math.max(beat0, beat1)
    const mLo = Math.min(midi0, midi1)
    const mHi = Math.max(midi0, midi1)
    const next = additive ? new Set(selection.value) : new Set<number>()
    for (const n of current.value.notes) {
      if (n.start < bHi && n.start + n.dur > bLo
        && n.midi >= mLo && n.midi <= mHi) next.add(n.id)
    }
    selection.value = next
  }

  function duplicateSelected(): void {
    if (!selection.value.size) return
    pushHistory()
    const picked = current.value.notes
      .filter((n) => selection.value.has(n.id))
    const minStart = Math.min(...picked.map((n) => n.start))
    const maxEnd = Math.max(...picked.map((n) => n.start + n.dur))
    const span = Math.max(1, Math.ceil((maxEnd - minStart)
      / beatsPerBar.value)) * beatsPerBar.value
    ensureBars(maxEnd + span)
    const clones = picked.map((n) => ({
      id: nextId++, midi: n.midi, start: n.start + span, dur: n.dur,
      vel: n.vel,
    }))
    for (const c of clones) clampNote(c)
    current.value.notes.push(...clones)
    selection.value = new Set(clones.map((c) => c.id))
  }

  function quantizeSelected(): void {
    if (!selection.value.size || snapBeats.value <= 0) return
    pushHistory()
    for (const id of selection.value) {
      const n = findNote(id)
      if (!n) continue
      n.start = snapBeat(n.start)
      clampNote(n)
    }
  }

  function renamePart(index: number, name: string): void {
    const p = parts[index]
    if (!p) return
    const trimmed = name.trim().slice(0, 40)
    if (trimmed) p.name = trimmed
  }

  function beginVelocityEdit(): void {
    pushHistory()
  }

  function setNoteVelocity(id: number, vel: number): void {
    const n = findNote(id)
    if (!n) return
    n.vel = Math.max(0.05, Math.min(1, vel))
  }

  function addPart(): void {
    if (parts.length >= MAX_PARTS) return
    pushHistory()
    parts.push({ name: `Part ${parts.length + 1}`, notes: [] })
    activePart.value = parts.length - 1
    selection.value = new Set()
  }

  function removePart(index: number): void {
    if (parts.length <= 1) return
    pushHistory()
    parts.splice(index, 1)
    activePart.value = Math.min(activePart.value, parts.length - 1)
    selection.value = new Set()
  }

  function setActivePart(index: number): void {
    activePart.value = Math.max(0, Math.min(parts.length - 1, index))
    selection.value = new Set()
  }

  let dragOrig: Map<number, PersistedNote> | null = null

  function beginDrag(): void {
    pushHistory()
    dragOrig = new Map()
    for (const id of selection.value) {
      const n = findNote(id)
      if (n) dragOrig.set(id, { midi: n.midi, start: n.start, dur: n.dur })
    }
  }

  function dragBy(dMidi: number, dBeat: number): void {
    if (!dragOrig) return
    for (const [id, orig] of dragOrig) {
      const n = findNote(id)
      if (!n) continue
      n.midi = orig.midi + dMidi
      n.start = snapBeat(orig.start + dBeat)
      clampNote(n)
    }
  }

  function beginResize(id: number, push = true): void {
    if (push) pushHistory()
    const n = findNote(id)
    dragOrig = n
      ? new Map([[id, { midi: n.midi, start: n.start, dur: n.dur }]])
      : null
  }

  function resizeBy(id: number, dBeat: number): void {
    const orig = dragOrig?.get(id)
    if (!orig) return
    resizeNote(id, orig.dur + dBeat)
  }

  function resizeLeftBy(id: number, dBeat: number): void {
    const orig = dragOrig?.get(id)
    const n = findNote(id)
    if (!orig || !n) return
    const end = orig.start + orig.dur
    const minDur = snapBeats.value > 0 ? snapBeats.value : 0.0625
    const start = Math.max(0, Math.min(end - minDur,
      snapBeat(orig.start + dBeat)))
    n.start = start
    n.dur = end - start
  }

  function endDrag(): void {
    dragOrig = null
  }

  const stepCursor = ref(0)
  const stepDur = ref(1)
  const stepDotted = ref(false)
  let stepLastMidi = 60

  const STEP_SEMIS: Record<string, number> = {
    c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11,
  }

  function stepEffDur(): number {
    return stepDotted.value ? stepDur.value * 1.5 : stepDur.value
  }

  function ensureBars(untilBeat: number): void {
    const needed = Math.ceil(untilBeat / beatsPerBar.value)
    if (needed > bars.value) bars.value = Math.min(256, needed)
  }

  function stepPitchFor(letter: string): number | null {
    const semi = STEP_SEMIS[letter.toLowerCase()]
    if (semi === undefined) return null
    const base = Math.round((stepLastMidi - semi) / 12) * 12 + semi
    const candidates = [base - 12, base, base + 12]
      .filter((m) => m >= 0 && m <= 127)
    return candidates.reduce((a, b) =>
      Math.abs(b - stepLastMidi) <= Math.abs(a - stepLastMidi) ? b : a)
  }

  function stepInsert(letter: string): number | null {
    const midi = stepPitchFor(letter)
    if (midi === null) return null
    pushHistory()
    const dur = stepEffDur()
    ensureBars(stepCursor.value + dur)
    const note: RollNote = {
      id: nextId++, midi, start: stepCursor.value, dur, vel: DEFAULT_VEL,
    }
    clampNote(note)
    current.value.notes.push(note)
    selection.value = new Set([note.id])
    stepLastMidi = midi
    stepCursor.value = note.start + note.dur
    return note.id
  }

  function stepRest(): void {
    const dur = stepEffDur()
    ensureBars(stepCursor.value + dur)
    stepCursor.value += dur
  }

  function stepBackspace(): void {
    const p = current.value
    let best: RollNote | null = null
    for (const n of p.notes) {
      const end = n.start + n.dur
      if (Math.abs(end - stepCursor.value) < 1e-6
        && (!best || n.id > best.id)) best = n
    }
    if (best) {
      pushHistory()
      p.notes = p.notes.filter((n) => n.id !== best.id)
      stepCursor.value = best.start
      selection.value = new Set()
    } else {
      stepCursor.value = Math.max(0, stepCursor.value - stepEffDur())
    }
  }

  function stepTranspose(delta: number): void {
    if (!selection.value.size) return
    pushHistory()
    for (const id of selection.value) {
      const n = findNote(id)
      if (!n) continue
      n.midi = Math.max(0, Math.min(127, n.midi + delta))
      stepLastMidi = n.midi
    }
  }

  function stepSetCursor(beat: number): void {
    stepCursor.value = Math.max(0, snapBeat(beat))
  }

  function loadEditorState(state: PersistedState): void {
    pushHistory()
    hydrate(state)
  }

  try {
    const raw = (opts.widget.value || '').trim()
    if (raw) hydrate(JSON.parse(raw) as PersistedState)
  } catch {}

  let persistTimer: ReturnType<typeof setTimeout> | null = null
  watch(
    [tempo, beatsPerBar, beatType, bars, () => snapshot()],
    () => {
      if (hydrating) return
      if (persistTimer) clearTimeout(persistTimer)
      persistTimer = setTimeout(() => {
        opts.widget.value = snapshot()
      }, 250)
    },
  )

  return {
    tempo, beatsPerBar, beatType, bars, parts, activePart, selection,
    snap, snapBeats, pxPerBeat, totalBeats, current,
    snapBeat, beatToX, xToBeat, midiToY, yToMidi,
    addNote, findNote, moveSelected, resizeNote, deleteSelected,
    selectOne, clearSelection, clearAll, selectAll, selectInRect,
    duplicateSelected, quantizeSelected, renamePart,
    beginVelocityEdit, setNoteVelocity,
    beginDrag, dragBy, beginResize, resizeBy, resizeLeftBy, endDrag,
    stepCursor, stepDur, stepDotted, stepInsert, stepRest,
    stepBackspace, stepTranspose, stepSetCursor,
    addPart, removePart, setActivePart,
    loadEditorState, undo, pushHistory, snapshot,
  }
}
