<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full" @contextmenu.stop.prevent>
    <div
      class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-2xs ctv:flex-wrap"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <button type="button" :class="[btn, mode === 'draw' ? btnOn : '']" @click="mode = 'draw'">{{ $t('music.draw') }}</button>
      <button type="button" :class="[btn, mode === 'select' ? btnOn : '']" @click="mode = 'select'">{{ $t('music.select') }}</button>
      <button type="button" :class="[btn, mode === 'step' ? btnOn : '']" @click="mode = 'step'">{{ $t('music.step') }}</button>
      <template v-if="mode === 'step'">
        <button
          v-for="d in STEP_DURS"
          :key="d.beats"
          type="button"
          :class="[btn, roll.stepDur.value === d.beats ? btnOn : '']"
          :title="`${d.key}`"
          @click="roll.stepDur.value = d.beats"
        >{{ d.label }}</button>
        <button type="button" :class="[btn, roll.stepDotted.value ? btnOn : '']" @click="roll.stepDotted.value = !roll.stepDotted.value">·</button>
      </template>
      <button
        type="button" :class="btn"
        :title="playing ? $t('videoTrim.pause') : $t('videoCrop.play')"
        @click="togglePlay"
      ><i :class="['pi', playing ? 'pi-stop' : 'pi-play']" /></button>
      <span class="ctv:text-muted-foreground">{{ $t('music.snap') }}</span>
      <select v-model="roll.snap.value" :class="sel">
        <option value="1/4">1/4</option>
        <option value="1/8">1/8</option>
        <option value="1/16">1/16</option>
        <option value="1/32">1/32</option>
        <option value="free">free</option>
      </select>
      <span class="ctv:text-muted-foreground">{{ $t('music.tempo') }}</span>
      <input v-model.number="roll.tempo.value" type="number" min="20" max="400" :class="[sel, 'ctv:w-14']">
      <span class="ctv:text-muted-foreground">{{ $t('music.timeSig') }}</span>
      <select v-model.number="roll.beatsPerBar.value" :class="sel">
        <option v-for="n in 12" :key="n" :value="n">{{ n }}</option>
      </select>
      <span class="ctv:text-muted-foreground">/</span>
      <select v-model.number="roll.beatType.value" :class="sel">
        <option v-for="n in [2, 4, 8]" :key="n" :value="n">{{ n }}</option>
      </select>
      <span class="ctv:text-muted-foreground">{{ $t('music.bars') }}</span>
      <input v-model.number="roll.bars.value" type="number" min="1" max="256" :class="[sel, 'ctv:w-14']">
      <button type="button" :class="btn" :title="$t('music.undo')" @click="roll.undo()">↩</button>
      <button type="button" :class="btn" @click="roll.clearAll()">{{ $t('music.clearPart') }}</button>
      <button
        v-if="wiredScore"
        type="button" :class="btn" :disabled="importBusy"
        @click="doImport"
      >{{ $t('music.importScore') }}</button>
    </div>

    <div
      class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <span class="ctv:text-muted-foreground">{{ $t('music.part') }}</span>
      <button
        v-for="(p, i) in roll.parts"
        :key="i"
        type="button"
        :class="[btn, i === roll.activePart.value ? btnOn : '']"
        :title="$t('music.renamePart')"
        @click="roll.setActivePart(i)"
        @dblclick="onRenamePart(i)"
      >{{ p.name }}</button>
      <button
        v-if="roll.parts.length < 4"
        type="button" :class="btn" :title="$t('music.addPart')"
        @click="roll.addPart()"
      >＋</button>
      <button
        v-if="roll.parts.length > 1"
        type="button" :class="btn" :title="$t('music.removePart')"
        @click="roll.removePart(roll.activePart.value)"
      >−</button>
      <button
        type="button"
        :class="[btn, roll.current.value.percussion ? btnOn : '']"
        :title="$t('music.percussion')"
        @click="roll.current.value.percussion = !roll.current.value.percussion"
      >🥁</button>
      <template v-if="!roll.current.value.percussion">
        <span class="ctv:text-muted-foreground">{{ $t('music.instrument') }}</span>
        <select
          :value="roll.current.value.program ?? 'piano'"
          :class="sel"
          @change="roll.current.value.program = ($event.target as HTMLSelectElement).value"
        >
          <option v-for="g in GM_NAMES" :key="g" :value="g">{{ g.replace(/_/g, ' ') }}</option>
        </select>
      </template>
      <button type="button" :class="btn" :title="$t('music.quantize')" @click="roll.quantizeSelected()">Q</button>
      <span v-if="importError" class="ctv:text-destructive-background">{{ importError }}</span>
      <span v-else-if="importNote" class="ctv:text-warning-background">{{ importNote }}</span>
    </div>

    <div
      class="ctv:flex ctv:rounded ctv:border ctv:border-border-subtle ctv:overflow-hidden ctv:bg-black/40 ctv:outline-none"
      style="height: 380px;"
      tabindex="0"
      @pointerenter="focusRoll"
      @pointerdown.stop @pointermove.stop @pointerup.stop
      @keydown="onKeydown"
      @wheel.stop="onWheel"
    >
      <div class="ctv:relative ctv:shrink-0 ctv:overflow-hidden ctv:bg-secondary-background" :style="{ width: (isPercPart ? 64 : KEY_WIDTH) + 'px', marginTop: '20px' }">
        <div class="ctv:absolute ctv:inset-x-0" :style="{ top: -scrollTop + 'px' }">
          <div
            v-for="k in keys"
            :key="k.midi"
            class="ctv:absolute ctv:inset-x-0 ctv:flex ctv:items-center ctv:justify-end ctv:pr-1 ctv:cursor-pointer ctv:border-b ctv:border-white/5"
            :class="k.black ? 'ctv:bg-black/50' : 'ctv:bg-white/10'"
            :style="{ top: k.y + 'px', height: NOTE_HEIGHT + 'px' }"
            @click="beep(k.midi)"
          >
            <span v-if="k.label" class="ctv:text-3xs ctv:text-muted-foreground ctv:truncate">{{ k.label }}</span>
          </div>
        </div>
      </div>

      <div class="ctv:flex-1 ctv:flex ctv:flex-col ctv:min-w-0">
        <div class="ctv:relative ctv:h-5 ctv:shrink-0 ctv:overflow-hidden ctv:bg-secondary-background ctv:border-b ctv:border-white/10">
          <div class="ctv:absolute ctv:inset-y-0" :style="{ left: -scrollLeft + 'px' }">
            <span
              v-for="b in roll.bars.value"
              :key="b"
              class="ctv:absolute ctv:top-0.5 ctv:text-3xs ctv:text-muted-foreground"
              :style="{ left: (b - 1) * barPx + 3 + 'px' }"
            >{{ b }}</span>
          </div>
        </div>

        <div ref="scrollEl" class="ctv-scroll-thin ctv:flex-1 ctv:min-h-0 ctv:overflow-auto" @scroll="onScroll">
          <div
            ref="contentEl"
            class="ctv:relative"
            :style="gridStyle"
            @pointerdown="onGridDown"
          >
            <div
              v-if="mode === 'step'"
              class="ctv:absolute ctv:inset-y-0 ctv:w-0.5 ctv:bg-warning-background/80 ctv:pointer-events-none ctv:z-20"
              :style="{ left: roll.beatToX(roll.stepCursor.value) + 'px' }"
            />
            <div
              v-if="playing"
              class="ctv:absolute ctv:inset-y-0 ctv:w-0.5 ctv:bg-success-background ctv:pointer-events-none ctv:z-20"
              :style="{ left: roll.beatToX(playBeat) + 'px' }"
            />
            <div
              v-for="g in ghostBlocks"
              :key="'g' + g.id"
              class="ctv:absolute ctv:rounded-xs ctv:bg-white/20 ctv:pointer-events-none"
              :style="{ left: g.x + 'px', top: g.y + 'px', width: g.w + 'px', height: g.h + 'px' }"
            />
            <div
              v-if="marquee"
              class="ctv:absolute ctv:border ctv:border-warning-background ctv:bg-warning-background/10 ctv:pointer-events-none ctv:z-30"
              :style="marqueeStyle"
            />
            <div
              v-for="n in noteBlocks"
              :key="n.id"
              class="ctv:absolute ctv:rounded-xs ctv:cursor-grab ctv:border"
              :class="n.selected
                ? 'ctv:bg-warning-background ctv:border-white/80 ctv:z-10'
                : 'ctv:bg-primary-background ctv:border-white/25'"
              :style="{ left: n.x + 'px', top: n.y + 'px', width: n.w + 'px', height: n.h + 'px' }"
              @pointerdown.stop="onNoteDown(n.id, n.midi, $event)"
              @dblclick.stop="onNoteDblClick(n.id)"
            >
              <div
                class="ctv:absolute ctv:inset-y-0 ctv:left-0 ctv:w-1.5 ctv:cursor-ew-resize"
                @pointerdown.stop="onLeftHandleDown(n.id, $event)"
              />
              <div
                class="ctv:absolute ctv:inset-y-0 ctv:right-0 ctv:w-1.5 ctv:cursor-ew-resize"
                @pointerdown.stop="onHandleDown(n.id, $event)"
              />
            </div>
          </div>
        </div>

        <div
          ref="laneEl"
          class="ctv:relative ctv:h-11 ctv:shrink-0 ctv:overflow-hidden ctv:border-t ctv:border-white/15 ctv:bg-black/40 ctv:cursor-ns-resize"
          :title="$t('music.velocity')"
          @pointerdown="onVelDown"
        >
          <span class="ctv:absolute ctv:top-0.5 ctv:left-1 ctv:text-3xs ctv:text-muted-foreground ctv:pointer-events-none ctv:z-10">{{ $t('music.velocity') }}</span>
          <div class="ctv:absolute ctv:inset-y-0" :style="{ left: -scrollLeft + 'px' }">
            <div
              v-for="vb in velBars"
              :key="vb.id"
              class="ctv:absolute ctv:bottom-0 ctv:rounded-t-xs ctv:pointer-events-none"
              :class="vb.selected ? 'ctv:bg-warning-background' : 'ctv:bg-primary-background/70'"
              :style="{ left: vb.x + 'px', width: vb.w + 'px', height: vb.h + '%' }"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-muted-foreground ctv:leading-snug">{{ mode === 'step' ? $t('music.stepHint') : mode === 'select' ? $t('music.rollHint2') : $t('music.rollHint') }}</div>

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { usePianoRoll, NOTE_HEIGHT, KEY_WIDTH } from '@/composables/stages/usePianoRoll'
import { useStrWidget } from '@/composables/widgets/useWidgetModel'
import { importScoreEditor } from '@/api'
import { askText } from '@/composables/dialog/useTextInputDialog'
import { GM_NAMES } from '@/constants/gmPrograms'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const { t } = useI18n()

const btn = 'ctv:py-0.5 ctv:px-1.5 ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:text-base-foreground ctv:cursor-pointer ctv:hover:border-primary-background ctv:disabled:opacity-40'
const btnOn = 'ctv:border-primary-background ctv:bg-primary-background/30'
const sel = 'ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:px-1 ctv:py-0.5 ctv:text-2xs ctv:text-base-foreground'

const notesJson = useStrWidget(props.node, 'notes_json', '')
const roll = usePianoRoll({ widget: notesJson })

const mode = ref<'draw' | 'select' | 'step'>('draw')
const scrollEl = ref<HTMLElement | null>(null)
const contentEl = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const scrollLeft = ref(0)

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const BLACK = new Set([1, 3, 6, 8, 10])

const GM_DRUMS: Record<number, string> = {
  35: 'Kick 2', 36: 'Kick', 37: 'Stick', 38: 'Snare', 39: 'Clap',
  40: 'Snare 2', 41: 'Tom Lo2', 42: 'HH Cl', 43: 'Tom Lo', 44: 'HH Pedal',
  45: 'Tom Mid', 46: 'HH Open', 47: 'Tom Mid2', 48: 'Tom Hi', 49: 'Crash',
  50: 'Tom Hi2', 51: 'Ride', 52: 'China', 53: 'Ride Bell', 54: 'Tamb',
  55: 'Splash', 56: 'Cowbell', 57: 'Crash 2', 58: 'Vibraslap', 59: 'Ride 2',
  60: 'Bongo Hi', 61: 'Bongo Lo', 62: 'Conga Mute', 63: 'Conga Hi',
  64: 'Conga Lo', 65: 'Timbale Hi', 66: 'Timbale Lo', 67: 'Agogo Hi',
  68: 'Agogo Lo', 69: 'Cabasa', 70: 'Maracas', 75: 'Claves',
  76: 'Woodblk Hi', 77: 'Woodblk Lo', 80: 'Tri Mute', 81: 'Tri Open',
}

const isPercPart = computed(() => !!roll.current.value.percussion)

const keys = computed(() => {
  const perc = isPercPart.value
  const out: Array<{ midi: number; y: number; black: boolean; label: string }> = []
  for (let midi = 127; midi >= 0; midi--) {
    const semi = midi % 12
    out.push({
      midi,
      y: (127 - midi) * NOTE_HEIGHT,
      black: perc ? !(midi in GM_DRUMS) : BLACK.has(semi),
      label: perc
        ? (GM_DRUMS[midi] ?? '')
        : (semi === 0 ? `C${Math.floor(midi / 12) - 1}` : ''),
    })
  }
  return out
})

const barPx = computed(() => roll.pxPerBeat.value * roll.beatsPerBar.value)

const blackRows = (() => {
  const dark = [1, 4, 6, 9, 11]
  const stops: string[] = []
  let pos = 0
  for (let r = 0; r < 12; r++) {
    const end = (r + 1) * NOTE_HEIGHT
    const color = dark.includes(r) ? 'rgba(0,0,0,0.28)' : 'transparent'
    stops.push(`${color} ${pos}px ${end}px`)
    pos = end
  }
  return `repeating-linear-gradient(to bottom, ${stops.join(', ')})`
})()

const gridStyle = computed(() => {
  const pb = roll.pxPerBeat.value
  return {
    width: `${roll.totalBeats.value * pb}px`,
    height: `${128 * NOTE_HEIGHT}px`,
    backgroundImage: [
      `repeating-linear-gradient(to right, rgba(255,255,255,0.16) 0 1px, transparent 1px ${barPx.value}px)`,
      `repeating-linear-gradient(to right, rgba(255,255,255,0.05) 0 1px, transparent 1px ${pb}px)`,
      `repeating-linear-gradient(to bottom, rgba(255,255,255,0.10) 0 1px, transparent 1px ${12 * NOTE_HEIGHT}px)`,
      `repeating-linear-gradient(to bottom, rgba(255,255,255,0.04) 0 1px, transparent 1px ${NOTE_HEIGHT}px)`,
      blackRows,
    ].join(', '),
    cursor: mode.value === 'draw' ? 'crosshair' : 'default',
  }
})

const noteBlocks = computed(() => roll.current.value.notes.map((n) => ({
  id: n.id,
  midi: n.midi,
  x: roll.beatToX(n.start),
  y: roll.midiToY(n.midi),
  w: Math.max(3, n.dur * roll.pxPerBeat.value - 1),
  h: NOTE_HEIGHT - 1,
  selected: roll.selection.value.has(n.id),
})))

const velBars = computed(() => roll.current.value.notes.map((n) => ({
  id: n.id,
  x: roll.beatToX(n.start),
  w: Math.max(3, n.dur * roll.pxPerBeat.value - 1),
  h: Math.round(n.vel * 100),
  selected: roll.selection.value.has(n.id),
})))

const ghostBlocks = computed(() => {
  const out: Array<{ id: number; x: number; y: number; w: number; h: number }> = []
  roll.parts.forEach((p, i) => {
    if (i === roll.activePart.value) return
    for (const n of p.notes) {
      out.push({
        id: n.id,
        x: roll.beatToX(n.start),
        y: roll.midiToY(n.midi),
        w: Math.max(3, n.dur * roll.pxPerBeat.value - 1),
        h: NOTE_HEIGHT - 1,
      })
    }
  })
  return out
})

let audioCtx: AudioContext | null = null
let noiseBuf: AudioBuffer | null = null

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseBuf
}

function drumHit(midi: number, when: number, dest: AudioNode,
  vel = 0.8): void {
  const ctx = audioCtx!
  const amp = vel / 0.8
  if (midi === 35 || midi === 36) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.frequency.setValueAtTime(120, when)
    osc.frequency.exponentialRampToValueAtTime(45, when + 0.12)
    g.gain.setValueAtTime(0.5 * amp, when)
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.15)
    osc.connect(g).connect(dest)
    osc.start(when)
    osc.stop(when + 0.16)
    return
  }
  const len = midi === 42 || midi === 44 ? 0.05
    : midi === 46 ? 0.25
    : midi === 49 || midi === 52 || midi === 55 || midi === 57 ? 0.6
    : midi === 51 || midi === 53 || midi === 59 ? 0.35
    : 0.12
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value =
    midi === 38 || midi === 39 || midi === 40 ? 1200 : 4000
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.3 * amp, when)
  g.gain.exponentialRampToValueAtTime(0.001, when + len)
  src.connect(filter).connect(g).connect(dest)
  src.start(when)
  src.stop(when + len + 0.02)
}

function beep(midi: number): void {
  try {
    audioCtx = audioCtx ?? new AudioContext()
    const now = audioCtx.currentTime
    if (isPercPart.value) {
      drumHit(midi, now + 0.01, audioCtx.destination)
      return
    }
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12)
    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
    osc.connect(gain).connect(audioCtx.destination)
    osc.start(now)
    osc.stop(now + 0.25)
  } catch {}
}

const playing = ref(false)
const playBeat = ref(0)
let playMaster: GainNode | null = null
let playStartTime = 0
let playRaf = 0
let playEndBeat = 0

const PART_WAVES: OscillatorType[] = ['triangle', 'square', 'sawtooth', 'sine']

function stopPlayback(): void {
  playing.value = false
  cancelAnimationFrame(playRaf)
  if (playMaster) {
    try {
      playMaster.disconnect()
    } catch {}
    playMaster = null
  }
}

function playTick(): void {
  if (!playing.value || !audioCtx) return
  const beat = (audioCtx.currentTime - playStartTime)
    * roll.tempo.value / 60
  playBeat.value = Math.max(0, beat)
  const x = roll.beatToX(playBeat.value)
  const scroller = scrollEl.value
  if (scroller && (x < scroller.scrollLeft
    || x > scroller.scrollLeft + scroller.clientWidth - 48)) {
    scroller.scrollLeft = Math.max(0, x - 48)
  }
  if (beat > playEndBeat + 1) {
    stopPlayback()
    return
  }
  playRaf = requestAnimationFrame(playTick)
}

function togglePlay(): void {
  if (playing.value) {
    stopPlayback()
    return
  }
  try {
    audioCtx = audioCtx ?? new AudioContext()
  } catch {
    return
  }
  const secPerBeat = 60 / roll.tempo.value
  playEndBeat = 0
  playMaster = audioCtx.createGain()
  playMaster.gain.value = 0.9
  playMaster.connect(audioCtx.destination)
  const t0 = audioCtx.currentTime + 0.08
  roll.parts.forEach((part, pi) => {
    const wave = PART_WAVES[pi % PART_WAVES.length]
    for (const n of part.notes) {
      const on = t0 + n.start * secPerBeat
      playEndBeat = Math.max(playEndBeat, n.start + n.dur)
      if (part.percussion) {
        drumHit(n.midi, on, playMaster!, n.vel)
        continue
      }
      const off = on + Math.max(0.05, n.dur * secPerBeat)
      const amp = 0.125 * (n.vel ?? 0.8)
      const osc = audioCtx!.createOscillator()
      const gain = audioCtx!.createGain()
      osc.type = wave
      osc.frequency.value = 440 * Math.pow(2, (n.midi - 69) / 12)
      gain.gain.setValueAtTime(0.0001, on)
      gain.gain.exponentialRampToValueAtTime(amp, on + 0.01)
      gain.gain.setValueAtTime(amp, Math.max(on + 0.01, off - 0.04))
      gain.gain.exponentialRampToValueAtTime(0.0001, off)
      osc.connect(gain).connect(playMaster!)
      osc.start(on)
      osc.stop(off + 0.02)
    }
  })
  if (playEndBeat === 0) {
    stopPlayback()
    return
  }
  playStartTime = t0
  playBeat.value = 0
  playing.value = true
  playRaf = requestAnimationFrame(playTick)
}

interface DragState {
  type: 'move' | 'resize' | 'resize-left' | 'marquee' | 'vel'
  id: number
  startX: number
  startY: number
  zoom?: number
}

let drag: DragState | null = null
let dragEl: HTMLElement | null = null

function onDragMove(e: PointerEvent): void {
  if (!drag) return
  const zoom = drag.zoom ?? 1
  if (drag.type === 'marquee') {
    updateMarquee(e, zoom)
    return
  }
  if (drag.type === 'vel') {
    paintVelocity(e, zoom)
    return
  }
  const dBeat = (e.clientX - drag.startX) / zoom / roll.pxPerBeat.value
  if (drag.type === 'move') {
    const dMidi = -Math.round((e.clientY - drag.startY) / zoom / NOTE_HEIGHT)
    roll.dragBy(dMidi, dBeat)
  } else if (drag.type === 'resize') {
    roll.resizeBy(drag.id, dBeat)
  } else {
    roll.resizeLeftBy(drag.id, dBeat)
  }
}

function onDragEnd(): void {
  if (drag && drag.type !== 'marquee' && drag.type !== 'vel') roll.endDrag()
  marquee.value = null
  drag = null
  if (dragEl) {
    dragEl.removeEventListener('pointermove', onDragMove)
    dragEl.removeEventListener('pointerup', onDragEnd)
    dragEl.removeEventListener('pointercancel', onDragEnd)
    dragEl = null
  }
}

function startDrag(state: DragState, e: PointerEvent): void {
  onDragEnd()
  drag = { ...state, zoom: rollZoom() }
  const el = e.currentTarget as HTMLElement | null
  if (!el) return
  dragEl = el
  try {
    el.setPointerCapture(e.pointerId)
  } catch {}
  el.addEventListener('pointermove', onDragMove)
  el.addEventListener('pointerup', onDragEnd)
  el.addEventListener('pointercancel', onDragEnd)
}

function rollZoom(): number {
  const el = contentEl.value
  if (!el) return 1
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && el.clientWidth > 0
    ? rect.width / el.clientWidth
    : 1
}

function gridPos(e: PointerEvent): { beat: number; midi: number } {
  const el = contentEl.value
  if (!el) return { beat: 0, midi: 60 }
  const rect = el.getBoundingClientRect()
  const zoom = rollZoom()
  const x = (e.clientX - rect.left) / zoom
  const y = (e.clientY - rect.top) / zoom
  return { beat: roll.xToBeat(x), midi: roll.yToMidi(y) }
}

const marquee = ref<{
  x0: number; y0: number; x1: number; y1: number; additive: boolean
} | null>(null)

const marqueeStyle = computed(() => {
  const m = marquee.value
  if (!m) return {}
  return {
    left: Math.min(m.x0, m.x1) + 'px',
    top: Math.min(m.y0, m.y1) + 'px',
    width: Math.abs(m.x1 - m.x0) + 'px',
    height: Math.abs(m.y1 - m.y0) + 'px',
  }
})

function contentPos(e: PointerEvent, zoom?: number): { x: number; y: number } {
  const el = contentEl.value
  if (!el) return { x: 0, y: 0 }
  const rect = el.getBoundingClientRect()
  const z = zoom ?? rollZoom()
  return { x: (e.clientX - rect.left) / z, y: (e.clientY - rect.top) / z }
}

function updateMarquee(e: PointerEvent, zoom: number): void {
  const m = marquee.value
  if (!m) return
  const p = contentPos(e, zoom)
  m.x1 = p.x
  m.y1 = p.y
  roll.selectInRect(
    roll.xToBeat(Math.min(m.x0, m.x1)),
    roll.xToBeat(Math.max(m.x0, m.x1)),
    roll.yToMidi(Math.max(m.y0, m.y1)),
    roll.yToMidi(Math.min(m.y0, m.y1)),
    m.additive,
  )
}

const laneEl = ref<HTMLElement | null>(null)

function paintVelocity(e: PointerEvent, zoom?: number): void {
  const el = laneEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const z = zoom ?? rollZoom()
  const x = (e.clientX - rect.left) / z + scrollLeft.value
  const y = (e.clientY - rect.top) / z
  const beat = roll.xToBeat(x)
  const vel = Math.max(0.05, Math.min(1, 1 - y / 44))
  for (const n of roll.current.value.notes) {
    if (n.start <= beat && beat < n.start + n.dur) {
      roll.setNoteVelocity(n.id, vel)
    }
  }
}

function onVelDown(e: PointerEvent): void {
  if (e.button !== 0) return
  roll.beginVelocityEdit()
  paintVelocity(e)
  startDrag({ type: 'vel', id: -1, startX: e.clientX, startY: e.clientY }, e)
}

function onGridDown(e: PointerEvent): void {
  if (e.button !== 0) return
  if (mode.value === 'draw') {
    const { beat, midi } = gridPos(e)
    const id = roll.addNote(midi, beat)
    beep(midi)
    roll.beginResize(id, false)
    startDrag({ type: 'resize', id, startX: e.clientX, startY: e.clientY }, e)
  } else if (mode.value === 'step') {
    const { beat } = gridPos(e)
    roll.stepSetCursor(beat)
  } else {
    if (!e.shiftKey) roll.clearSelection()
    const p = contentPos(e)
    marquee.value = {
      x0: p.x, y0: p.y, x1: p.x, y1: p.y, additive: e.shiftKey,
    }
    startDrag(
      { type: 'marquee', id: -1, startX: e.clientX, startY: e.clientY }, e)
  }
}

function onNoteDown(id: number, midi: number, e: PointerEvent): void {
  if (e.button !== 0) return
  roll.selectOne(id, e.shiftKey)
  if (!e.shiftKey) {
    beep(midi)
    roll.beginDrag()
    startDrag({ type: 'move', id, startX: e.clientX, startY: e.clientY }, e)
  }
}

function onHandleDown(id: number, e: PointerEvent): void {
  if (e.button !== 0) return
  roll.selectOne(id)
  roll.beginResize(id)
  startDrag({ type: 'resize', id, startX: e.clientX, startY: e.clientY }, e)
}

function onLeftHandleDown(id: number, e: PointerEvent): void {
  if (e.button !== 0) return
  roll.selectOne(id)
  roll.beginResize(id)
  startDrag(
    { type: 'resize-left', id, startX: e.clientX, startY: e.clientY }, e)
}

function onNoteDblClick(id: number): void {
  roll.selectOne(id)
  roll.deleteSelected()
}

const STEP_DURS = [
  { beats: 4, label: '1', key: '7' },
  { beats: 2, label: '1/2', key: '6' },
  { beats: 1, label: '1/4', key: '5' },
  { beats: 0.5, label: '1/8', key: '4' },
  { beats: 0.25, label: '1/16', key: '3' },
  { beats: 0.125, label: '1/32', key: '2' },
]

function onStepKeydown(e: KeyboardEvent): boolean {
  const k = e.key.toLowerCase()
  if (/^[a-g]$/.test(k)) {
    const id = roll.stepInsert(k)
    if (id !== null) beep(roll.findNote(id)!.midi)
    return true
  }
  if (k === '0' || k === ' ') {
    roll.stepRest()
    return true
  }
  const dur = STEP_DURS.find((d) => d.key === k)
  if (dur) {
    roll.stepDur.value = dur.beats
    return true
  }
  if (k === '.') {
    roll.stepDotted.value = !roll.stepDotted.value
    return true
  }
  if (k === 'backspace') {
    roll.stepBackspace()
    return true
  }
  if (k === 'arrowup' || k === 'arrowdown') {
    roll.stepTranspose((e.shiftKey ? 12 : 1) * (k === 'arrowup' ? 1 : -1))
    for (const id of roll.selection.value) {
      const n = roll.findNote(id)
      if (n) beep(n.midi)
    }
    return true
  }
  if (k === 'arrowleft' || k === 'arrowright') {
    const d = roll.stepDotted.value ? roll.stepDur.value * 1.5 : roll.stepDur.value
    roll.stepSetCursor(roll.stepCursor.value + (k === 'arrowright' ? d : -d))
    return true
  }
  return false
}

function onKeydown(e: KeyboardEvent): void {
  if (mode.value === 'step' && !e.ctrlKey && !e.metaKey) {
    if (onStepKeydown(e)) {
      e.preventDefault()
      return
    }
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    roll.deleteSelected()
    e.preventDefault()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    roll.undo()
    e.preventDefault()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    roll.selectAll()
    e.preventDefault()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
    roll.duplicateSelected()
    e.preventDefault()
  }
}

async function onRenamePart(index: number): Promise<void> {
  const name = (await askText({
    title: t('music.renamePart'),
    label: t('music.part'),
  }))?.trim()
  if (name) roll.renamePart(index, name)
}

function onWheel(e: WheelEvent): void {
  if (e.ctrlKey || e.metaKey) {
    const next = roll.pxPerBeat.value * (e.deltaY < 0 ? 1.2 : 1 / 1.2)
    roll.pxPerBeat.value = Math.min(96, Math.max(8, Math.round(next)))
    e.preventDefault()
  }
}

function onScroll(): void {
  scrollTop.value = scrollEl.value?.scrollTop ?? 0
  scrollLeft.value = scrollEl.value?.scrollLeft ?? 0
}

function focusRoll(e: PointerEvent): void {
  (e.currentTarget as HTMLElement | null)?.focus?.()
}

const wiredScore = computed(() =>
  pickSourceImageUrl(props.state.inputs, 'score') ?? '')

const importBusy = ref(false)
const importError = ref('')
const importNote = ref('')

async function doImport(): Promise<void> {
  const xml = wiredScore.value
  if (!xml || importBusy.value) return
  importBusy.value = true
  importError.value = ''
  importNote.value = ''
  try {
    const state = await importScoreEditor(xml)
    roll.loadEditorState(state)
    if ((state.skipped_percussion ?? 0) > 0) {
      importNote.value = t('music.skippedPercussion')
    }
  } catch {
    importError.value = t('music.importFailed')
  } finally {
    importBusy.value = false
  }
}

onBeforeUnmount(() => {
  onDragEnd()
  stopPlayback()
  try {
    void audioCtx?.close()
  } catch {}
})
</script>
