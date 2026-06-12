import { computed, ref, watch, type Ref } from 'vue'

import { useStageStore, type StageState } from '@/stores/stageStore'

export interface Segment {
  id: string
  length: number
  prompt: string
  imageUrl: string | null
  sourceIndex: number | null
}

export interface AudioSegment {
  id: string
  start: number
  length: number
  trimStart: number
  audioUrl: string
}

export const PPF = 3

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export function useTimelineEditor(
  node: any,
  state: StageState,
  rootEl: Ref<HTMLElement | null>,
) {
  const store = useStageStore()

  const keyframes = computed<string[]>(() =>
    state.inputs
      .filter(i => i.slot.startsWith('image') && i.source === 'upstream' && i.content)
      .map(i => i.content as string),
  )
  const audioUrl = computed<string | null>(() => {
    const a = state.inputs.find(i => i.slot === 'audio')
    return a && a.source === 'upstream' && a.content ? a.content : null
  })

  const frameRate  = ref(24)
  const segments   = ref<Segment[]>([])
  const audioSeg   = ref<AudioSegment | null>(null)
  const selectedId = ref<string | null>(null)
  const drag       = ref<{ id: string; previewX: number; grabDx: number } | null>(null)
  const audioDrag  = ref(false)

  const selectedSeg = computed(() =>
    segments.value.find(s => s.id === selectedId.value) ?? null,
  )
  const totalFrames = computed(() =>
    segments.value.reduce((sum, s) => sum + s.length, 0),
  )
  const trackWidthPx = computed(() =>
    Math.max(
      320,
      (Math.max(totalFrames.value, audioSeg.value ? audioSeg.value.start + audioSeg.value.length : 0)
        + frameRate.value) * PPF,
    ),
  )

  function startOf(idx: number): number {
    let s = 0
    for (let i = 0; i < idx; i++) s += segments.value[i].length
    return s
  }

  function segStyle(idx: number) {
    const seg = segments.value[idx]
    const base = startOf(idx) * PPF
    const x = drag.value?.id === seg.id ? drag.value.previewX : base
    return { left: `${x}px`, width: `${seg.length * PPF}px` }
  }

  const ruler = computed(() => {
    const ticks: { frame: number; label: string }[] = []
    const total = Math.ceil(trackWidthPx.value / PPF)
    for (let f = 0; f <= total; f += frameRate.value) {
      ticks.push({ frame: f, label: `${Math.round(f / frameRate.value)}s` })
    }
    return ticks
  })

  function getWidget(name: string): any | null {
    return node?.widgets?.find((w: any) => w.name === name) ?? null
  }

  function serialize(): string {
    let acc = 0
    const segOut = segments.value.map((s) => {
      const out = { id: s.id, start: acc, length: s.length, prompt: s.prompt, imageUrl: s.imageUrl }
      acc += s.length
      return out
    })
    return JSON.stringify({
      frameRate: frameRate.value,
      durationFrames: totalFrames.value,
      segments: segOut,
      audioSegments: audioSeg.value ? [{ ...audioSeg.value }] : [],
    })
  }

  function commit() {
    const json = serialize()
    const w = getWidget('timeline_data')
    if (w && w.value !== json) { w.value = json; w.callback?.(json) }
    const fw = getWidget('frame_rate')
    if (fw && fw.value !== frameRate.value) { fw.value = frameRate.value; fw.callback?.(frameRate.value) }
    store.applyExecutedPayload(state, { output: [json] })
  }

  function restore() {
    const raw = String(getWidget('timeline_data')?.value ?? '')
    const fr = Number(getWidget('frame_rate')?.value)
    if (Number.isFinite(fr) && fr > 0) frameRate.value = fr
    if (!raw) return
    try {
      const p = JSON.parse(raw)
      if (typeof p.frameRate === 'number') frameRate.value = p.frameRate
      if (Array.isArray(p.segments)) {
        segments.value = p.segments.map((s: any) => ({
          id: s.id || newId(),
          length: Math.max(1, Number(s.length) || frameRate.value),
          prompt: String(s.prompt ?? ''),
          imageUrl: s.imageUrl ?? null,
          sourceIndex: s.sourceIndex ?? null,
        }))
      }
      if (Array.isArray(p.audioSegments) && p.audioSegments[0]) {
        const a = p.audioSegments[0]
        audioSeg.value = {
          id: a.id || newId(),
          start: Number(a.start) || 0,
          length: Math.max(1, Number(a.length) || frameRate.value),
          trimStart: Number(a.trimStart) || 0,
          audioUrl: a.audioUrl || audioUrl.value || '',
        }
      }
    } catch (e) {
      console.warn('[ComfyTV/timeline] restore failed', e)
    }
  }

  function addSegment(sourceIndex: number) {
    segments.value.push({
      id: newId(),
      length: frameRate.value,
      prompt: '',
      imageUrl: keyframes.value[sourceIndex] ?? null,
      sourceIndex,
    })
    selectedId.value = segments.value[segments.value.length - 1].id
    commit()
  }

  function removeSegment(id: string) {
    segments.value = segments.value.filter(s => s.id !== id)
    if (selectedId.value === id) selectedId.value = null
    commit()
  }

  function updatePrompt(v: string) {
    if (selectedSeg.value) { selectedSeg.value.prompt = v; commit() }
  }
  function setLength(id: string, v: number) {
    const seg = segments.value.find(s => s.id === id)
    if (!seg) return
    seg.length = Math.max(1, Math.min(600, Math.round(v)))
    commit()
  }
  function setFrameRate(v: number) {
    frameRate.value = Math.max(1, Math.min(120, Math.round(v)))
    commit()
  }

  function addAudio() {
    if (!audioUrl.value) return
    audioSeg.value = {
      id: newId(),
      start: 0,
      length: Math.max(frameRate.value, totalFrames.value),
      trimStart: 0,
      audioUrl: audioUrl.value,
    }
    commit()
  }

  function beginPointerDrag(
    e: PointerEvent,
    onMove: (ev: PointerEvent) => void,
    onEnd: () => void,
  ) {
    const el = rootEl.value
    if (!el) return
    el.setPointerCapture?.(e.pointerId)
    const move = (ev: PointerEvent) => onMove(ev)
    const finish = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', finish)
      el.removeEventListener('pointercancel', finish)
      try { el.releasePointerCapture?.(e.pointerId) } catch {}
      onEnd()
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', finish)
    el.addEventListener('pointercancel', finish)
  }

  function onSegPointerDown(e: PointerEvent, seg: Segment, idx: number) {
    selectedId.value = seg.id
    const base = startOf(idx) * PPF
    drag.value = { id: seg.id, previewX: base, grabDx: e.clientX - base }
    beginPointerDrag(e, onSegPointerMove, () => { drag.value = null; commit() })
  }
  function onSegPointerMove(e: PointerEvent) {
    if (!drag.value) return
    const px = e.clientX - drag.value.grabDx
    drag.value.previewX = px
    const draggedIdx = segments.value.findIndex(s => s.id === drag.value!.id)
    if (draggedIdx < 0) return
    const centerFrame = (px / PPF) + segments.value[draggedIdx].length / 2
    let acc = 0, targetIdx = segments.value.length - 1
    for (let i = 0; i < segments.value.length; i++) {
      const mid = acc + segments.value[i].length / 2
      if (centerFrame < mid) { targetIdx = i; break }
      acc += segments.value[i].length
    }
    if (targetIdx !== draggedIdx) {
      const [moved] = segments.value.splice(draggedIdx, 1)
      segments.value.splice(targetIdx, 0, moved)
    }
  }

  let resizeState: { id: string; startX: number; startLen: number } | null = null
  function onResizePointerDown(e: PointerEvent, seg: Segment) {
    resizeState = { id: seg.id, startX: e.clientX, startLen: seg.length }
    beginPointerDrag(e, onResizeMove, () => { resizeState = null; commit() })
  }
  function onResizeMove(e: PointerEvent) {
    if (!resizeState) return
    const seg = segments.value.find(s => s.id === resizeState!.id)
    if (!seg) return
    const dframes = Math.round((e.clientX - resizeState.startX) / PPF)
    seg.length = Math.max(1, resizeState.startLen + dframes)
  }

  let audioMoveState: { startX: number; startFrame: number } | null = null
  function onAudioPointerDown(e: PointerEvent) {
    if (!audioSeg.value) return
    audioDrag.value = true
    audioMoveState = { startX: e.clientX, startFrame: audioSeg.value.start }
    beginPointerDrag(e, onAudioMove, () => {
      audioDrag.value = false
      audioMoveState = null
      commit()
    })
  }
  function onAudioMove(e: PointerEvent) {
    if (!audioSeg.value || !audioMoveState) return
    const dframes = Math.round((e.clientX - audioMoveState.startX) / PPF)
    audioSeg.value.start = Math.max(0, audioMoveState.startFrame + dframes)
  }

  let audioResizeState: { startX: number; startLen: number } | null = null
  function onAudioResizePointerDown(e: PointerEvent) {
    if (!audioSeg.value) return
    audioResizeState = { startX: e.clientX, startLen: audioSeg.value.length }
    beginPointerDrag(e, onAudioResizeMove, () => { audioResizeState = null; commit() })
  }
  function onAudioResizeMove(e: PointerEvent) {
    if (!audioSeg.value || !audioResizeState) return
    const dframes = Math.round((e.clientX - audioResizeState.startX) / PPF)
    audioSeg.value.length = Math.max(1, audioResizeState.startLen + dframes)
  }

  restore()
  if (node) {
    const origOnConfigure = node.onConfigure
    node.onConfigure = function (info: any) {
      origOnConfigure?.call(this, info)
      restore()
    }
  }

  watch(keyframes, (kf) => {
    let changed = false
    for (const s of segments.value) {
      if (s.sourceIndex != null && kf[s.sourceIndex] && s.imageUrl !== kf[s.sourceIndex]) {
        s.imageUrl = kf[s.sourceIndex]
        changed = true
      }
    }
    if (changed) commit()
  })

  return {
    keyframes, audioUrl,
    frameRate, segments, audioSeg, selectedId,
    drag, audioDrag,
    selectedSeg, totalFrames, trackWidthPx, ruler,
    segStyle,
    addSegment, removeSegment, updatePrompt, setLength, setFrameRate, addAudio,
    onSegPointerDown, onResizePointerDown,
    onAudioPointerDown, onAudioResizePointerDown,
  }
}
