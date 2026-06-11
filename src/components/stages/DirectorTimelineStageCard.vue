<template>
  <div ref="rootEl" class="timeline-stage">
    <div class="palette">
      <span class="palette-label">{{ $t('timeline.keyframes') }}</span>
      <div v-if="keyframes.length === 0" class="palette-empty">
        {{ $t('timeline.connectImages') }}
      </div>
      <div v-else class="palette-thumbs">
        <button
          v-for="(url, i) in keyframes"
          :key="i"
          type="button"
          class="thumb"
          :title="$t('timeline.addSegment')"
          @click="addSegment(i)"
        >
          <img :src="url" :alt="`#${i + 1}`" />
          <span class="thumb-no">{{ i + 1 }}</span>
        </button>
      </div>
    </div>

    <div class="tracks-scroll">
      <div class="tracks" :style="{ width: `${trackWidthPx}px` }">
        <div class="ruler">
          <div
            v-for="tick in ruler"
            :key="tick.frame"
            class="tick"
            :style="{ left: `${tick.frame * ppf}px` }"
          >
            <span class="tick-label">{{ tick.label }}</span>
          </div>
        </div>

        <div class="track video-track">
          <div
            v-for="(seg, idx) in segments"
            :key="seg.id"
            class="segment"
            :class="{ selected: seg.id === selectedId, dragging: drag?.id === seg.id }"
            :style="segStyle(idx)"
            @pointerdown="onSegPointerDown($event, seg, idx)"
          >
            <img v-if="seg.imageUrl" :src="seg.imageUrl" class="seg-thumb" draggable="false" />
            <span class="seg-len">{{ seg.length }}f</span>
            <div class="seg-resize" @pointerdown.stop="onResizePointerDown($event, seg)" />
          </div>
          <div v-if="segments.length === 0" class="track-empty">{{ $t('timeline.clickKeyframe') }}</div>
        </div>
        <div class="track audio-track">
          <div
            v-if="audioSeg"
            class="audio-segment"
            :class="{ dragging: audioDrag }"
            :style="{ left: `${audioSeg.start * ppf}px`, width: `${audioSeg.length * ppf}px` }"
            @pointerdown="onAudioPointerDown($event)"
          >
            <span class="audio-label">🎵 {{ audioSeg.length }}f</span>
            <div class="seg-resize" @pointerdown.stop="onAudioResizePointerDown($event)" />
          </div>
          <button
            v-else-if="audioUrl"
            type="button"
            class="add-audio"
            @click="addAudio"
          >🎵 {{ $t('timeline.addAudio') }}</button>
          <div v-else class="track-empty muted">{{ $t('timeline.noAudio') }}</div>
        </div>
      </div>
    </div>

    <div v-if="selectedSeg" class="seg-editor">
      <div class="row">
        <span class="label">{{ $t('timeline.segmentPrompt') }}</span>
        <button type="button" class="del-btn" @click="removeSegment(selectedSeg.id)">🗑</button>
      </div>
      <textarea
        class="prompt-area"
        :value="selectedSeg.prompt"
        :placeholder="$t('timeline.promptPlaceholder')"
        @input="(e) => updatePrompt((e.target as HTMLTextAreaElement).value)"
      />
      <div class="row len-row">
        <span class="label">{{ $t('timeline.length') }}</span>
        <input
          type="number" min="1" max="600" step="1"
          :value="selectedSeg.length"
          @change="(e) => setLength(selectedSeg!.id, Number((e.target as HTMLInputElement).value))"
        />
        <span class="unit">f ≈ {{ (selectedSeg.length / frameRate).toFixed(2) }}s</span>
      </div>
    </div>

    <div class="meta-row">
      <div class="ctl">
        <span class="label">{{ $t('timeline.fps') }}</span>
        <input
          type="number" min="1" max="120" step="1"
          :value="frameRate"
          @change="(e) => setFrameRate(Number((e.target as HTMLInputElement).value))"
        />
      </div>
      <span class="total">{{ totalFrames }}f · {{ (totalFrames / frameRate).toFixed(1) }}s · {{ segments.length }} {{ $t('timeline.shots') }}</span>
    </div>

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
      hide-context
      hide-output
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useStageStore, type StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'

interface Segment {
  id: string
  length: number
  prompt: string
  imageUrl: string | null
  sourceIndex: number | null
}
interface AudioSegment {
  id: string
  start: number
  length: number
  trimStart: number
  audioUrl: string
}

const ppf = 3

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: any
}>()

const store = useStageStore()

const keyframes = computed<string[]>(() => {
  return props.state.inputs
    .filter(i => i.slot.startsWith('image') && i.source === 'upstream' && i.content)
    .map(i => i.content as string)
})
const audioUrl = computed<string | null>(() => {
  const a = props.state.inputs.find(i => i.slot === 'audio')
  return a && a.source === 'upstream' && a.content ? a.content : null
})

const frameRate = ref(24)
const segments = ref<Segment[]>([])
const audioSeg = ref<AudioSegment | null>(null)
const selectedId = ref<string | null>(null)

const selectedSeg = computed(() => segments.value.find(s => s.id === selectedId.value) ?? null)
const totalFrames = computed(() => segments.value.reduce((sum, s) => sum + s.length, 0))
const trackWidthPx = computed(() =>
  Math.max(320, (Math.max(totalFrames.value, audioSeg.value ? audioSeg.value.start + audioSeg.value.length : 0) + frameRate.value) * ppf),
)

function startOf(idx: number): number {
  let s = 0
  for (let i = 0; i < idx; i++) s += segments.value[i].length
  return s
}
function segStyle(idx: number) {
  const seg = segments.value[idx]
  const base = startOf(idx) * ppf
  const x = drag.value?.id === seg.id ? drag.value.previewX : base
  return { left: `${x}px`, width: `${seg.length * ppf}px` }
}

const ruler = computed(() => {
  const ticks: { frame: number; label: string }[] = []
  const total = Math.ceil(trackWidthPx.value / ppf)
  for (let f = 0; f <= total; f += frameRate.value) {
    ticks.push({ frame: f, label: `${Math.round(f / frameRate.value)}s` })
  }
  return ticks
})

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
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

const rootEl = ref<HTMLElement | null>(null)

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
    try { el.releasePointerCapture?.(e.pointerId) } catch { /* already released */ }
    onEnd()
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', finish)
  el.addEventListener('pointercancel', finish)
}

const drag = ref<{ id: string; previewX: number; grabDx: number } | null>(null)

function onSegPointerDown(e: PointerEvent, seg: Segment, idx: number) {
  selectedId.value = seg.id
  const base = startOf(idx) * ppf
  drag.value = { id: seg.id, previewX: base, grabDx: e.clientX - base }
  beginPointerDrag(e, onSegPointerMove, () => { drag.value = null; commit() })
}
function onSegPointerMove(e: PointerEvent) {
  if (!drag.value) return
  const px = e.clientX - drag.value.grabDx
  drag.value.previewX = px
  const draggedIdx = segments.value.findIndex(s => s.id === drag.value!.id)
  if (draggedIdx < 0) return
  const centerFrame = (px / ppf) + segments.value[draggedIdx].length / 2
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
  const dframes = Math.round((e.clientX - resizeState.startX) / ppf)
  seg.length = Math.max(1, resizeState.startLen + dframes)
}

const audioDrag = ref(false)
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
  const dframes = Math.round((e.clientX - audioMoveState.startX) / ppf)
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
  const dframes = Math.round((e.clientX - audioResizeState.startX) / ppf)
  audioSeg.value.length = Math.max(1, audioResizeState.startLen + dframes)
}

function getWidget(name: string): any | null {
  return props.node?.widgets?.find((w: any) => w.name === name) ?? null
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
  store.applyExecutedPayload(props.state, { output: [json] })
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
restore()

if (props.node) {
  const origOnConfigure = props.node.onConfigure
  props.node.onConfigure = function (info: any) {
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
</script>

<style scoped>
.timeline-stage {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  height: 100%;
}

.palette { display: flex; flex-direction: column; gap: 4px; }
.palette-label, .label {
  font-size: 10px; color: rgba(255,255,255,0.55);
  text-transform: uppercase; letter-spacing: 0.4px;
}
.palette-empty, .track-empty {
  font-size: 11px; color: rgba(255,255,255,0.4); padding: 4px;
}
.track-empty.muted { color: rgba(255,255,255,0.3); }
.palette-thumbs { display: flex; gap: 4px; flex-wrap: wrap; }
.thumb {
  position: relative; width: 48px; height: 36px; padding: 0;
  border: 1px solid rgba(255,255,255,0.15); border-radius: 4px;
  overflow: hidden; cursor: pointer; background: #000;
}
.thumb:hover { border-color: rgba(233,61,130,0.6); }
.thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb-no {
  position: absolute; bottom: 1px; left: 2px; font-size: 9px;
  background: rgba(0,0,0,0.7); color: #ffb0d8; padding: 0 3px; border-radius: 3px;
}

.tracks-scroll { flex: 0 0 auto; overflow-x: auto; overflow-y: hidden; background: #0a0a0f; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); }
.tracks { position: relative; min-height: 116px; }
.ruler { position: relative; height: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.tick { position: absolute; top: 0; height: 16px; border-left: 1px solid rgba(255,255,255,0.15); }
.tick-label { font-size: 8px; color: rgba(255,255,255,0.4); margin-left: 2px; }

.track { position: relative; height: 44px; margin: 4px; border-radius: 4px; background: rgba(255,255,255,0.03); }
.video-track { background: rgba(78,168,255,0.05); }
.audio-track { background: rgba(120,200,120,0.05); height: 28px; }

.segment {
  position: absolute; top: 2px; height: 40px;
  border: 1px solid rgba(78,168,255,0.5); border-radius: 4px;
  background: rgba(78,168,255,0.15); overflow: hidden; cursor: grab;
  display: flex; align-items: center;
}
.segment.selected { border-color: #4ea8ff; box-shadow: 0 0 0 1px #4ea8ff; }
.segment.dragging { opacity: 0.8; cursor: grabbing; z-index: 5; }
.seg-thumb { height: 100%; width: auto; object-fit: cover; pointer-events: none; }
.seg-len { position: absolute; bottom: 1px; right: 14px; font-size: 9px; color: #fff; background: rgba(0,0,0,0.6); padding: 0 3px; border-radius: 3px; pointer-events: none; }
.seg-resize { position: absolute; top: 0; right: 0; width: 8px; height: 100%; cursor: ew-resize; background: rgba(255,255,255,0.12); }
.seg-resize:hover { background: rgba(255,255,255,0.3); }

.audio-segment {
  position: absolute; top: 2px; height: 24px;
  border: 1px solid rgba(120,200,120,0.5); border-radius: 4px;
  background: rgba(120,200,120,0.2); cursor: grab;
  display: flex; align-items: center; padding-left: 6px;
}
.audio-segment.dragging { opacity: 0.8; cursor: grabbing; }
.audio-label { font-size: 10px; color: #b5e3a5; pointer-events: none; }
.add-audio {
  margin: 2px; padding: 3px 8px; font-size: 11px;
  background: rgba(120,200,120,0.12); border: 1px solid rgba(120,200,120,0.3);
  border-radius: 4px; color: #b5e3a5; cursor: pointer;
}

.seg-editor { display: flex; flex-direction: column; gap: 4px; }
.row { display: flex; align-items: center; gap: 6px; }
.del-btn { margin-left: auto; background: none; border: none; cursor: pointer; font-size: 13px; }
.prompt-area {
  width: 100%; min-height: 44px; resize: vertical;
  background: rgba(0,0,0,0.3); color: var(--input-text,#ddd);
  border: 1px solid rgba(255,255,255,0.15); border-radius: 4px;
  padding: 4px 6px; font-size: 11px; box-sizing: border-box;
}
.len-row input, .meta-row input {
  width: 56px; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.9);
  border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 2px 4px;
  font-size: 11px; font-family: ui-monospace, monospace;
}
.unit { font-size: 10px; color: rgba(255,255,255,0.5); }

.meta-row { display: flex; align-items: center; gap: 10px; }
.ctl { display: flex; align-items: center; gap: 4px; }
.total { margin-left: auto; font-size: 10px; color: rgba(255,255,255,0.55); font-family: ui-monospace, monospace; }
</style>
