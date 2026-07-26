<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:w-full ctv:grow" @contextmenu.stop.prevent>
    <div
      class="ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-1.5 ctv:text-2xs ctv:flex-wrap"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <button type="button" :class="[btn, mode === 'draw' ? btnOn : '']" @click="mode = 'draw'">{{ $t('music.draw') }}</button>
      <button type="button" :class="[btn, mode === 'select' ? btnOn : '']" @click="mode = 'select'">{{ $t('music.select') }}</button>
      <button
        type="button" :class="btn"
        :title="playing ? $t('videoTrim.pause') : $t('videoCrop.play')"
        @click="togglePlay"
      ><i :class="['pi', playing ? 'pi-stop' : 'pi-play']" /></button>
      <span class="ctv:text-muted-foreground">{{ $t('music.snap') }}</span>
      <select v-model="roll.snap.value" :class="sel">
        <option value="free">free</option>
        <option value="10ms">10ms</option>
        <option value="50ms">50ms</option>
        <option value="100ms">100ms</option>
        <option value="250ms">250ms</option>
        <option value="1s">1s</option>
      </select>
      <button type="button" :class="btn" :title="$t('music.undo')" @click="roll.undo()">↩</button>
      <button type="button" :class="btn" @click="roll.clearChannel()">{{ $t('music.clearChannel') }}</button>
      <button
        v-if="wiredMidi"
        type="button" :class="btn" :disabled="importBusy"
        @click="doImport"
      >{{ $t('music.importMidi') }}</button>
      <span v-if="importError" class="ctv:text-destructive-background">{{ importError }}</span>
    </div>

    <div
      class="ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-1 ctv:text-2xs ctv:flex-wrap"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <span class="ctv:text-muted-foreground">{{ $t('music.channel') }}</span>
      <div
        v-for="(c, i) in roll.channels"
        :key="c.ch"
        class="ctv:flex ctv:items-center ctv:gap-0.5 ctv:rounded ctv:border ctv:bg-secondary-background ctv:pl-1.5 ctv:pr-0.5 ctv:py-0.5"
        :class="i === roll.activeChannel.value
          ? 'ctv:border-primary-background ctv:bg-primary-background/20'
          : 'ctv:border-border-subtle'"
        @mouseenter="highlightCh = c.ch"
        @mouseleave="highlightCh = null"
      >
        <button
          type="button"
          class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:cursor-pointer ctv:text-base-foreground"
          :class="mutedCh.has(c.ch) ? 'ctv:opacity-20' : ''"
          @click="roll.setActiveChannel(i)"
        >
          <span
            class="ctv:size-2.5 ctv:shrink-0 ctv:rounded-xs"
            :style="{ background: chColor(c), boxShadow: `0 0 6px ${chColor(c)}` }"
          />
          <span>{{ c.ch === 9 ? '🥁' : `Ch${c.ch + 1}` }}</span>
        </button>
        <button
          type="button"
          class="ctv:flex ctv:size-5 ctv:items-center ctv:justify-center ctv:rounded ctv:cursor-pointer ctv:text-2xs ctv:font-semibold ctv:hover:bg-white/10"
          :class="soloCh === c.ch ? 'ctv:text-warning-background' : 'ctv:text-muted-foreground'"
          :title="$t('music.solo')"
          @click="toggleSolo(c.ch)"
        >S</button>
        <button
          type="button"
          class="ctv:flex ctv:size-5 ctv:items-center ctv:justify-center ctv:rounded ctv:cursor-pointer ctv:hover:bg-white/10"
          :class="mutedCh.has(c.ch) ? 'ctv:text-destructive-background' : 'ctv:text-muted-foreground'"
          :title="mutedCh.has(c.ch) ? $t('music.unmuteChannel') : $t('music.muteChannel')"
          @click="toggleMute(c.ch)"
        ><i :class="['pi', 'ctv:text-3xs', mutedCh.has(c.ch) ? 'pi-volume-off' : 'pi-volume-up']" /></button>
      </div>
      <button
        type="button" :class="btn" :title="$t('music.addChannel')"
        @click="roll.addChannel(false)"
      >＋</button>
      <button
        v-if="!hasDrums"
        type="button" :class="btn" :title="$t('music.percussion')"
        @click="roll.addChannel(true)"
      >＋🥁</button>
      <button
        v-if="roll.channels.length > 1"
        type="button" :class="btn" :title="$t('music.removeChannel')"
        @click="roll.removeChannel(roll.activeChannel.value)"
      >−</button>
      <template v-if="!isDrumChannel">
        <span class="ctv:text-muted-foreground">{{ $t('music.instrument') }}</span>
        <select :value="programChoice" :class="sel" @change="onProgramChange">
          <option v-for="g in GM_NAMES" :key="g" :value="g">{{ g.replace(/_/g, ' ') }}</option>
          <option v-if="programChoice.startsWith('p:')" :value="programChoice">{{ programChoice.slice(2) }}</option>
        </select>
      </template>
    </div>

    <div class="ctv:relative ctv:flex-1 ctv:min-h-0" data-testid="roll-shell">
    <div
      class="ctv:absolute ctv:inset-0 ctv:flex ctv:rounded ctv:border ctv:border-border-subtle ctv:overflow-hidden ctv:bg-black/40 ctv:outline-none"
      tabindex="0"
      @pointerenter="focusRoll"
      @pointerdown.stop @pointermove.stop @pointerup.stop
      @keydown="onKeydown"
      @wheel.stop="onWheel"
    >
      <div class="ctv:relative ctv:shrink-0 ctv:overflow-hidden ctv:bg-secondary-background" :style="{ width: (isDrumChannel ? 64 : KEY_WIDTH) + 'px', marginTop: '20px' }">
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
              v-for="tick in rulerTicks"
              :key="tick"
              class="ctv:absolute ctv:top-0.5 ctv:text-3xs ctv:text-muted-foreground"
              :style="{ left: roll.secToX(tick) + 3 + 'px' }"
            >{{ tick }}s</span>
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
              v-if="playing"
              class="ctv:absolute ctv:inset-y-0 ctv:w-0.5 ctv:bg-success-background ctv:pointer-events-none ctv:z-20"
              :style="{ left: roll.secToX(playSec) + 'px' }"
            />
            <div
              v-for="g in ghostBlocks"
              :key="'g' + g.id"
              class="ctv:absolute ctv:rounded-xs ctv:pointer-events-none"
              :style="{ left: g.x + 'px', top: g.y + 'px', width: g.w + 'px', height: g.h + 'px', background: g.color, opacity: g.alpha * 0.55 }"
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
                : 'ctv:border-white/25'"
              :style="{ left: n.x + 'px', top: n.y + 'px', width: n.w + 'px', height: n.h + 'px',
                        background: n.selected ? undefined : n.color,
                        opacity: n.selected ? 1 : n.alpha }"
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
              :class="vb.selected ? 'ctv:bg-warning-background' : ''"
              :style="{ left: vb.x + 'px', width: vb.w + 'px', height: vb.h + '%',
                        background: vb.selected ? undefined : vb.color,
                        opacity: vb.selected ? 1 : 0.7 }"
            />
          </div>
        </div>
      </div>
    </div>
    </div>

    <div class="ctv:shrink-0 ctv:text-2xs ctv:text-muted-foreground ctv:leading-snug">{{ mode === 'select' ? $t('music.rollHint2') : $t('music.rollHint') }}</div>

    <StageCard
      class="ctv:h-auto! ctv:grow-0 ctv:shrink-0"
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
import { useMidiEditor, NOTE_HEIGHT, KEY_WIDTH, MIN_PX_PER_SEC, MAX_PX_PER_SEC } from '@/composables/stages/useMidiEditor'
import { useStrWidget } from '@/composables/widgets/useWidgetModel'
import { midiEvents } from '@/api'
import { rollColor } from '@/utils/midiRoll'
import { GM_NAMES, GM_PROGRAM_NUMBERS, gmNameForProgram } from '@/constants/gmPrograms'
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

const eventsJson = useStrWidget(props.node, 'events_json', '')
const roll = useMidiEditor({ widget: eventsJson })

const mode = ref<'draw' | 'select'>('select')
const scrollEl = ref<HTMLElement | null>(null)
const contentEl = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const scrollLeft = ref(0)

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

const isDrumChannel = computed(() => roll.current.value.ch === 9)
const hasDrums = computed(() => roll.channels.some((c) => c.ch === 9))

const mutedCh = ref<Set<number>>(new Set())
const soloCh = ref<number | null>(null)
const highlightCh = ref<number | null>(null)

function chColor(c: { ch: number; program: number }): string {
  return rollColor(c.ch === 9 ? 'drums' : `p${c.program}`)
}

function chAlpha(ch: number): number {
  let a = mutedCh.value.has(ch) ? 0.2 : 1
  if (highlightCh.value !== null && ch !== highlightCh.value) {
    a = Math.min(a, 0.15)
  }
  return a
}

function toggleMute(ch: number): void {
  soloCh.value = null
  const next = new Set(mutedCh.value)
  if (next.has(ch)) next.delete(ch)
  else next.add(ch)
  mutedCh.value = next
}

function toggleSolo(ch: number): void {
  if (soloCh.value === ch) {
    soloCh.value = null
    mutedCh.value = new Set()
  } else {
    soloCh.value = ch
    mutedCh.value = new Set(
      roll.channels.filter((c) => c.ch !== ch).map((c) => c.ch))
  }
}

const programChoice = computed(() => {
  const p = roll.current.value.program
  return gmNameForProgram(p) ?? `p:${p}`
})

function onProgramChange(e: Event): void {
  const v = (e.target as HTMLSelectElement).value
  if (v.startsWith('p:')) return
  const num = GM_PROGRAM_NUMBERS[v]
  if (num !== undefined) roll.setProgram(roll.activeChannel.value, num)
}

const keys = computed(() => {
  const perc = isDrumChannel.value
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

const rulerTicks = computed(() => {
  const px = roll.pxPerSec.value
  const step = px >= 48 ? 1 : px >= 16 ? 5 : px >= 4 ? 15 : 60
  const out: number[] = []
  for (let s = 0; s <= roll.totalSec.value; s += step) out.push(s)
  return out
})

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
  const px = roll.pxPerSec.value
  return {
    width: `${roll.totalSec.value * px}px`,
    height: `${128 * NOTE_HEIGHT}px`,
    backgroundImage: [
      `repeating-linear-gradient(to right, rgba(255,255,255,0.16) 0 1px, transparent 1px ${px}px)`,
      `repeating-linear-gradient(to right, rgba(255,255,255,0.05) 0 1px, transparent 1px ${px / 4}px)`,
      `repeating-linear-gradient(to bottom, rgba(255,255,255,0.10) 0 1px, transparent 1px ${12 * NOTE_HEIGHT}px)`,
      `repeating-linear-gradient(to bottom, rgba(255,255,255,0.04) 0 1px, transparent 1px ${NOTE_HEIGHT}px)`,
      blackRows,
    ].join(', '),
    cursor: mode.value === 'draw' ? 'crosshair' : 'default',
  }
})

const noteBlocks = computed(() => {
  const c = roll.current.value
  const color = chColor(c)
  const alpha = chAlpha(c.ch)
  return c.notes.map((n) => ({
    id: n.id,
    midi: n.midi,
    x: roll.secToX(n.start),
    y: roll.midiToY(n.midi),
    w: Math.max(3, n.dur * roll.pxPerSec.value - 1),
    h: NOTE_HEIGHT - 1,
    selected: roll.selection.value.has(n.id),
    color,
    alpha,
  }))
})

const velBars = computed(() => {
  const color = chColor(roll.current.value)
  return roll.current.value.notes.map((n) => ({
    id: n.id,
    x: roll.secToX(n.start),
    w: Math.max(3, n.dur * roll.pxPerSec.value - 1),
    h: Math.round((n.vel / 127) * 100),
    selected: roll.selection.value.has(n.id),
    color,
  }))
})

const ghostBlocks = computed(() => {
  const out: Array<{ id: number; x: number; y: number; w: number; h: number; color: string; alpha: number }> = []
  roll.channels.forEach((c, i) => {
    if (i === roll.activeChannel.value) return
    const color = chColor(c)
    const alpha = chAlpha(c.ch)
    for (const n of c.notes) {
      out.push({
        id: n.id,
        x: roll.secToX(n.start),
        y: roll.midiToY(n.midi),
        w: Math.max(3, n.dur * roll.pxPerSec.value - 1),
        h: NOTE_HEIGHT - 1,
        color,
        alpha,
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

function drumHit(midi: number, when: number, dest: AudioNode, vel = 100): void {
  const ctx = audioCtx!
  const amp = vel / 100
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
    if (isDrumChannel.value) {
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
const playSec = ref(0)
let playMaster: GainNode | null = null
let playStartTime = 0
let playRaf = 0
let playEndSec = 0
let schedTimer: ReturnType<typeof setInterval> | null = null
let schedQueue: Array<{ start: number; dur: number; midi: number; vel: number; ch: number; wave: OscillatorType }> = []
let schedIdx = 0

const CH_WAVES: OscillatorType[] = ['triangle', 'square', 'sawtooth', 'sine']

function stopPlayback(): void {
  playing.value = false
  cancelAnimationFrame(playRaf)
  if (schedTimer) clearInterval(schedTimer)
  schedTimer = null
  schedQueue = []
  schedIdx = 0
  if (playMaster) {
    try {
      playMaster.disconnect()
    } catch {}
    playMaster = null
  }
}

function scheduleAhead(): void {
  if (!audioCtx || !playMaster) return
  const horizon = audioCtx.currentTime - playStartTime + 2.5
  while (schedIdx < schedQueue.length
    && schedQueue[schedIdx].start <= horizon) {
    const n = schedQueue[schedIdx++]
    if (mutedCh.value.has(n.ch)) continue
    const on = playStartTime + n.start
    if (n.ch === 9) {
      drumHit(n.midi, on, playMaster, n.vel)
      continue
    }
    const off = on + Math.max(0.05, n.dur)
    const amp = 0.125 * (n.vel / 100)
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = n.wave
    osc.frequency.value = 440 * Math.pow(2, (n.midi - 69) / 12)
    gain.gain.setValueAtTime(0.0001, on)
    gain.gain.exponentialRampToValueAtTime(amp, on + 0.01)
    gain.gain.setValueAtTime(amp, Math.max(on + 0.01, off - 0.04))
    gain.gain.exponentialRampToValueAtTime(0.0001, off)
    osc.connect(gain).connect(playMaster)
    osc.start(on)
    osc.stop(off + 0.02)
  }
}

function playTick(): void {
  if (!playing.value || !audioCtx) return
  playSec.value = Math.max(0, audioCtx.currentTime - playStartTime)
  const x = roll.secToX(playSec.value)
  const scroller = scrollEl.value
  if (scroller && (x < scroller.scrollLeft
    || x > scroller.scrollLeft + scroller.clientWidth - 48)) {
    scroller.scrollLeft = Math.max(0, x - 48)
  }
  if (playSec.value > playEndSec + 1) {
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
  playEndSec = 0
  schedQueue = []
  roll.channels.forEach((c, i) => {
    const wave = CH_WAVES[i % CH_WAVES.length]
    for (const n of c.notes) {
      playEndSec = Math.max(playEndSec, n.start + n.dur)
      schedQueue.push({
        start: n.start, dur: n.dur, midi: n.midi, vel: n.vel,
        ch: c.ch, wave,
      })
    }
  })
  if (!schedQueue.length) return
  schedQueue.sort((a, b) => a.start - b.start)
  schedIdx = 0
  playMaster = audioCtx.createGain()
  playMaster.gain.value = 0.9
  playMaster.connect(audioCtx.destination)
  playStartTime = audioCtx.currentTime + 0.08
  playSec.value = 0
  playing.value = true
  scheduleAhead()
  schedTimer = setInterval(scheduleAhead, 400)
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
  const dSec = (e.clientX - drag.startX) / zoom / roll.pxPerSec.value
  if (drag.type === 'move') {
    const dMidi = -Math.round((e.clientY - drag.startY) / zoom / NOTE_HEIGHT)
    roll.dragBy(dMidi, dSec)
  } else if (drag.type === 'resize') {
    roll.resizeBy(drag.id, dSec)
  } else {
    roll.resizeLeftBy(drag.id, dSec)
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

function contentPos(e: PointerEvent, zoom?: number): { x: number; y: number } {
  const el = contentEl.value
  if (!el) return { x: 0, y: 0 }
  const rect = el.getBoundingClientRect()
  const z = zoom ?? rollZoom()
  return { x: (e.clientX - rect.left) / z, y: (e.clientY - rect.top) / z }
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

function updateMarquee(e: PointerEvent, zoom: number): void {
  const m = marquee.value
  if (!m) return
  const p = contentPos(e, zoom)
  m.x1 = p.x
  m.y1 = p.y
  roll.selectInRect(
    roll.xToSec(Math.min(m.x0, m.x1)),
    roll.xToSec(Math.max(m.x0, m.x1)),
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
  const sec = roll.xToSec(x)
  const vel = Math.max(1, Math.min(127, Math.round((1 - y / 44) * 127)))
  for (const n of roll.current.value.notes) {
    if (n.start <= sec && sec < n.start + n.dur) {
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

function gridPos(e: PointerEvent): { sec: number; midi: number } {
  const p = contentPos(e)
  return { sec: roll.xToSec(p.x), midi: roll.yToMidi(p.y) }
}

function onGridDown(e: PointerEvent): void {
  if (e.button !== 0) return
  if (mode.value === 'draw') {
    const { sec, midi } = gridPos(e)
    const id = roll.addNote(midi, sec)
    beep(midi)
    roll.beginResize(id, false)
    startDrag({ type: 'resize', id, startX: e.clientX, startY: e.clientY }, e)
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

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    roll.deleteSelected()
    e.preventDefault()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    roll.undo()
    e.preventDefault()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    roll.selectAll()
    e.preventDefault()
  }
}

function onWheel(e: WheelEvent): void {
  if (e.ctrlKey || e.metaKey) {
    const next = roll.pxPerSec.value * (e.deltaY < 0 ? 1.2 : 1 / 1.2)
    roll.pxPerSec.value = Math.min(MAX_PX_PER_SEC,
      Math.max(MIN_PX_PER_SEC, Math.round(next)))
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

const wiredMidi = computed(() =>
  pickSourceImageUrl(props.state.inputs, 'midi') ?? '')

const importBusy = ref(false)
const importError = ref('')

async function doImport(): Promise<void> {
  const url = wiredMidi.value
  if (!url || importBusy.value) return
  importBusy.value = true
  importError.value = ''
  try {
    const res = await midiEvents(url)
    if (res.status !== 'ready' || !res.events) {
      importError.value = t('music.notMidi')
      return
    }
    roll.loadEditorState({
      tempo_map: res.tempo_map ?? [],
      programs: res.programs ?? {},
      events: res.events,
    })
    mutedCh.value = new Set()
    soloCh.value = null
    highlightCh.value = null
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
