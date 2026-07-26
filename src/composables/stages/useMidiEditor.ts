import { computed, reactive, ref, watch, type Ref } from 'vue'

export interface EditorNote {
  id: number
  midi: number
  start: number
  dur: number
  vel: number
}

export interface EditorChannel {
  ch: number
  program: number
  notes: EditorNote[]
}

export const NOTE_HEIGHT = 12
export const KEY_WIDTH = 48
export const MIN_DUR = 0.01
export const MIN_PX_PER_SEC = 10
export const MAX_PX_PER_SEC = 2000

export type SnapChoice = 'free' | '10ms' | '50ms' | '100ms' | '250ms' | '1s'

const SNAP_SECONDS: Record<SnapChoice, number> = {
  free: 0, '10ms': 0.01, '50ms': 0.05, '100ms': 0.1, '250ms': 0.25, '1s': 1,
}

const DEFAULT_VEL = 100

interface PersistedEvent {
  t: number
  dur: number
  midi: number
  vel?: number
  ch?: number
}

interface PersistedState {
  tempo_map?: Array<Record<string, number>>
  programs?: Record<string, number>
  events?: PersistedEvent[]
}

export interface MidiEditorOptions {
  widget: Ref<string>
}

export function useMidiEditor(opts: MidiEditorOptions) {
  const channels = reactive<EditorChannel[]>([{ ch: 0, program: 0, notes: [] }])
  const activeChannel = ref(0)
  const selection = ref<Set<number>>(new Set())
  const snap = ref<SnapChoice>('free')
  const pxPerSec = ref(80)
  const tempoMap = ref<Array<Record<string, number>>>([])

  let nextId = 1
  let history: string[] = []
  let hydrating = false

  const snapSec = computed(() => SNAP_SECONDS[snap.value])
  const current = computed<EditorChannel>(() =>
    channels[Math.min(activeChannel.value, channels.length - 1)])

  const contentEnd = computed(() => {
    let m = 0
    for (const c of channels) {
      for (const n of c.notes) m = Math.max(m, n.start + n.dur)
    }
    return m
  })
  const totalSec = computed(() => Math.max(30, contentEnd.value + 8))

  function snapTime(sec: number): number {
    const s = snapSec.value
    if (s <= 0) return Math.max(0, sec)
    return Math.max(0, Math.round(sec / s) * s)
  }

  function secToX(sec: number): number {
    return sec * pxPerSec.value
  }

  function xToSec(x: number): number {
    return x / pxPerSec.value
  }

  function midiToY(midi: number): number {
    return (127 - midi) * NOTE_HEIGHT
  }

  function yToMidi(y: number): number {
    return Math.max(0, Math.min(127, 127 - Math.floor(y / NOTE_HEIGHT)))
  }

  function snapshot(): string {
    const events: PersistedEvent[] = []
    for (const c of channels) {
      for (const n of c.notes) {
        events.push({
          t: Math.round(n.start * 1e6) / 1e6,
          dur: Math.round(n.dur * 1e6) / 1e6,
          midi: n.midi,
          vel: n.vel,
          ch: c.ch,
        })
      }
    }
    events.sort((a, b) => a.t - b.t || (a.ch ?? 0) - (b.ch ?? 0)
      || a.midi - b.midi)
    const programs: Record<string, number> = {}
    for (const c of channels) {
      if (c.ch !== 9) programs[String(c.ch)] = c.program
    }
    return JSON.stringify({
      tempo_map: tempoMap.value,
      programs,
      events,
    })
  }

  function hydrate(state: PersistedState): void {
    hydrating = true
    tempoMap.value = Array.isArray(state.tempo_map) ? state.tempo_map : []
    const programs = state.programs ?? {}
    const byCh = new Map<number, EditorNote[]>()
    for (const e of (Array.isArray(state.events) ? state.events : [])) {
      if (!Number.isFinite(e?.midi) || !Number.isFinite(e?.t)
        || !Number.isFinite(e?.dur) || e.dur <= 0 || e.t < 0) continue
      const ch = Math.max(0, Math.min(15, Math.round(Number(e.ch) || 0)))
      if (!byCh.has(ch)) byCh.set(ch, [])
      byCh.get(ch)!.push({
        id: nextId++,
        midi: Math.max(0, Math.min(127, Math.round(e.midi))),
        start: e.t,
        dur: e.dur,
        vel: Number.isFinite(e.vel)
          ? Math.max(1, Math.min(127, Math.round(Number(e.vel))))
          : DEFAULT_VEL,
      })
    }
    const chs = [...byCh.keys()].sort((a, b) => a - b)
    const next: EditorChannel[] = chs.map((ch) => ({
      ch,
      program: Math.max(0, Math.min(127,
        Math.round(Number(programs[String(ch)]) || 0))),
      notes: byCh.get(ch)!,
    }))
    if (!next.length) next.push({ ch: 0, program: 0, notes: [] })
    channels.splice(0, channels.length, ...next)
    activeChannel.value = 0
    selection.value = new Set()
    hydrating = false
  }

  function pushHistory(): void {
    history.push(snapshot())
    if (history.length > 50) history = history.slice(-50)
  }

  function undo(): void {
    const prev = history.pop()
    if (!prev) return
    try {
      hydrate(JSON.parse(prev) as PersistedState)
    } catch {}
  }

  function clampNote(n: EditorNote): void {
    n.midi = Math.max(0, Math.min(127, n.midi))
    n.start = Math.max(0, n.start)
    n.dur = Math.max(MIN_DUR, n.dur)
  }

  function addNote(midi: number, start: number, dur?: number): number {
    pushHistory()
    const note: EditorNote = {
      id: nextId++,
      midi,
      start: snapTime(start),
      dur: dur ?? Math.max(snapSec.value, 0.25),
      vel: DEFAULT_VEL,
    }
    clampNote(note)
    current.value.notes.push(note)
    selection.value = new Set([note.id])
    return note.id
  }

  function findNote(id: number): EditorNote | undefined {
    return current.value.notes.find((n) => n.id === id)
  }

  function deleteSelected(): void {
    if (!selection.value.size) return
    pushHistory()
    const c = current.value
    c.notes = c.notes.filter((n) => !selection.value.has(n.id))
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

  function selectAll(): void {
    selection.value = new Set(current.value.notes.map((n) => n.id))
  }

  function clearChannel(): void {
    pushHistory()
    current.value.notes = []
    selection.value = new Set()
  }

  function selectInRect(
    sec0: number, sec1: number, midi0: number, midi1: number,
    additive = false,
  ): void {
    const tLo = Math.min(sec0, sec1)
    const tHi = Math.max(sec0, sec1)
    const mLo = Math.min(midi0, midi1)
    const mHi = Math.max(midi0, midi1)
    const next = additive ? new Set(selection.value) : new Set<number>()
    for (const n of current.value.notes) {
      if (n.start < tHi && n.start + n.dur > tLo
        && n.midi >= mLo && n.midi <= mHi) next.add(n.id)
    }
    selection.value = next
  }

  let dragOrig: Map<number, { midi: number; start: number; dur: number }>
    | null = null

  function beginDrag(): void {
    pushHistory()
    dragOrig = new Map()
    for (const id of selection.value) {
      const n = findNote(id)
      if (n) dragOrig.set(id, { midi: n.midi, start: n.start, dur: n.dur })
    }
  }

  function dragBy(dMidi: number, dSec: number): void {
    if (!dragOrig) return
    for (const [id, orig] of dragOrig) {
      const n = findNote(id)
      if (!n) continue
      n.midi = orig.midi + dMidi
      n.start = snapTime(orig.start + dSec)
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

  function resizeBy(id: number, dSec: number): void {
    const orig = dragOrig?.get(id)
    const n = findNote(id)
    if (!orig || !n) return
    const s = snapSec.value
    const dur = orig.dur + dSec
    n.dur = s > 0 ? Math.max(s, Math.round(dur / s) * s) : Math.max(MIN_DUR, dur)
    clampNote(n)
  }

  function resizeLeftBy(id: number, dSec: number): void {
    const orig = dragOrig?.get(id)
    const n = findNote(id)
    if (!orig || !n) return
    const end = orig.start + orig.dur
    const minDur = snapSec.value > 0 ? snapSec.value : MIN_DUR
    const start = Math.max(0, Math.min(end - minDur,
      snapTime(orig.start + dSec)))
    n.start = start
    n.dur = end - start
  }

  function endDrag(): void {
    dragOrig = null
  }

  function beginVelocityEdit(): void {
    pushHistory()
  }

  function setNoteVelocity(id: number, vel: number): void {
    const n = findNote(id)
    if (!n) return
    n.vel = Math.max(1, Math.min(127, Math.round(vel)))
  }

  function freeChannel(drums: boolean): number | null {
    const used = new Set(channels.map((c) => c.ch))
    if (drums) return used.has(9) ? null : 9
    for (let ch = 0; ch < 16; ch++) {
      if (ch !== 9 && !used.has(ch)) return ch
    }
    return null
  }

  function addChannel(drums = false): void {
    const ch = freeChannel(drums)
    if (ch === null) return
    pushHistory()
    channels.push({ ch, program: 0, notes: [] })
    channels.sort((a, b) => a.ch - b.ch)
    activeChannel.value = channels.findIndex((c) => c.ch === ch)
    selection.value = new Set()
  }

  function removeChannel(index: number): void {
    if (channels.length <= 1) return
    pushHistory()
    channels.splice(index, 1)
    activeChannel.value = Math.min(activeChannel.value, channels.length - 1)
    selection.value = new Set()
  }

  function setActiveChannel(index: number): void {
    activeChannel.value = Math.max(0, Math.min(channels.length - 1, index))
    selection.value = new Set()
  }

  function setProgram(index: number, program: number): void {
    const c = channels[index]
    if (!c) return
    c.program = Math.max(0, Math.min(127, Math.round(program)))
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
    () => snapshot(),
    () => {
      if (hydrating) return
      if (persistTimer) clearTimeout(persistTimer)
      persistTimer = setTimeout(() => {
        opts.widget.value = snapshot()
      }, 250)
    },
  )

  return {
    channels, activeChannel, selection, snap, snapSec, pxPerSec,
    tempoMap, current, contentEnd, totalSec,
    snapTime, secToX, xToSec, midiToY, yToMidi,
    addNote, findNote, deleteSelected, selectOne, clearSelection,
    selectAll, selectInRect, clearChannel,
    beginDrag, dragBy, beginResize, resizeBy, resizeLeftBy, endDrag,
    beginVelocityEdit, setNoteVelocity,
    addChannel, removeChannel, setActiveChannel, setProgram,
    loadEditorState, undo, pushHistory, snapshot,
  }
}
