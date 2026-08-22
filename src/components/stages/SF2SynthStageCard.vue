<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:w-full ctv:grow" @contextmenu.stop.prevent>
    <div
      v-if="scoreXml"
      class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-2xs"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <button type="button" :class="btn" @click="engrave.zoomBy(-0.1)">−</button>
      <span class="ctv:font-mono ctv:text-muted-foreground ctv:min-w-9 ctv:text-center">{{ Math.round(engrave.zoom.value * 100) }}%</span>
      <button type="button" :class="btn" @click="engrave.zoomBy(0.1)">+</button>
      <span v-if="engrave.rendering.value" class="ctv:text-muted-foreground">{{ $t('music.engraving') }}</span>
      <span v-else-if="following" class="ctv:ml-auto ctv:text-success-background">{{ $t('music.following') }}</span>
    </div>

    <div v-if="scoreXml" class="ctv:relative ctv:flex-1 ctv:min-h-40">
    <div
      class="ctv-scroll-thin ctv:absolute ctv:inset-0 ctv:overflow-y-auto ctv:overflow-x-auto ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-white"
      style="overscroll-behavior: contain;"
      @pointerdown.stop @pointermove.stop @pointerup.stop @wheel.stop
    >
      <div ref="sheetEl" class="ctv:min-w-full ctv:p-2" />
      <div
        v-if="engrave.error.value"
        class="ctv:absolute ctv:inset-x-0 ctv:bottom-0 ctv:bg-black/70 ctv:px-2 ctv:py-1 ctv:text-2xs ctv:text-red-300"
      >{{ engrave.error.value }}</div>
    </div>
    </div>

    <VideoPlayerLite ref="playerRef" :source-video-url="state.output ?? ''" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <div class="ctv:flex ctv:items-center ctv:gap-2">
        <select
          v-model="soundfont"
          class="ctv:flex-1 ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:px-1.5 ctv:py-1 ctv:text-2xs ctv:text-base-foreground"
        >
          <option value="">{{ $t('music.builtinSynth') }}</option>
          <option v-for="f in soundfonts" :key="f" :value="f">{{ f }}</option>
        </select>
        <select
          v-model="program"
          class="ctv:flex-1 ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:px-1.5 ctv:py-1 ctv:text-2xs ctv:text-base-foreground"
        >
          <option v-for="p in GM_NAMES" :key="p" :value="p">{{ p.replace(/_/g, ' ') }}</option>
        </select>
      </div>
      <FxSlider v-model="gain" :label="$t('music.gain')" :min="0.1" :max="2" :step="0.05" :reset-to="1" />

      <div class="ctv:flex ctv:items-center ctv:gap-1.5">
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('music.channelPrograms') }}</span>
        <button type="button" :class="btn" @click="addRow">＋</button>
      </div>
      <div
        v-for="(row, ri) in channelRows"
        :key="ri"
        class="ctv:flex ctv:items-center ctv:gap-1.5"
      >
        <select
          v-model.number="row.ch"
          class="ctv:w-20 ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:px-1.5 ctv:py-1 ctv:text-2xs ctv:text-base-foreground"
        >
          <option
            v-for="c in CHANNELS" :key="c" :value="c"
            :disabled="c !== row.ch && channelRows.some(r => r.ch === c)"
          >ch {{ c }}</option>
        </select>
        <select
          v-model="row.program"
          class="ctv:flex-1 ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:px-1.5 ctv:py-1 ctv:text-2xs ctv:text-base-foreground"
        >
          <option v-for="p in GM_NAMES" :key="p" :value="p">{{ p.replace(/_/g, ' ') }}</option>
        </select>
        <button type="button" :class="btn" @click="removeRow(ri)">−</button>
      </div>
      <div class="ctv:text-2xs ctv:text-muted-foreground ctv:leading-snug">
        {{ $t('music.channelProgramsHint') }}
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!hasPerformance" class="ctv:text-muted-foreground">{{ $t('music.needsPerformance') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('fx.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('fx.adjustThenRun') }}</span>
    </div>

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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useScoreEngrave } from '@/composables/stages/useScoreEngrave'
import { beatAtTime, type TempoMark } from '@/composables/stages/scoreTime'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'
import { listResources } from '@/api'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const btn = 'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:py-1 ctv:px-2.5 ctv:rounded-lg ctv:border ctv:border-white/10 ctv:bg-white/5 ctv:text-base-foreground ctv:cursor-pointer ctv:hover:border-primary-background/60'

import { GM_NAMES } from '@/constants/gmPrograms'

const perfRaw = computed(() =>
  pickSourceImageUrl(props.state.inputs, 'performance') ?? '')
const hasPerformance = computed(() => !!perfRaw.value)

const parsed = computed<{ xml: string; tempo: TempoMark[] }>(() => {
  const raw = perfRaw.value
  if (!raw) return { xml: '', tempo: [] }
  try {
    const p = JSON.parse(raw) as {
      musicxml?: string
      tempo_map?: TempoMark[]
      events?: unknown[]
      duration?: number
    }
    console.info(
      '[ComfyTV/score-synth] performance received: events='
      + (Array.isArray(p.events) ? p.events.length : 0)
      + ' duration=' + String(p.duration)
      + ' tempoMarks='
      + (Array.isArray(p.tempo_map) ? p.tempo_map.length : 0)
      + ' hasMusicXml='
      + String(typeof p.musicxml === 'string' && p.musicxml.length > 0))
    return {
      xml: typeof p.musicxml === 'string' ? p.musicxml : '',
      tempo: Array.isArray(p.tempo_map) ? p.tempo_map : [],
    }
  } catch {
    return { xml: '', tempo: [] }
  }
})
const scoreXml = computed(() => parsed.value.xml)

const soundfont = useStrWidget(props.node, 'soundfont', '')
const program = useStrWidget(props.node, 'program', 'piano')
const channelPrograms = useStrWidget(props.node, 'channel_programs', '')
const gain = useNumWidget(props.node, 'gain', 1)

const CHANNELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15]

interface ChannelRow {
  ch: number
  program: string
}

function parseRows(raw: string): ChannelRow[] {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>
    if (!obj || typeof obj !== 'object') return []
    return Object.entries(obj)
      .map(([k, v]) => ({ ch: Number(k), program: String(v) }))
      .filter((r) => Number.isInteger(r.ch) && CHANNELS.includes(r.ch)
        && GM_NAMES.includes(r.program))
      .sort((a, b) => a.ch - b.ch)
  } catch {
    return []
  }
}

const channelRows = ref<ChannelRow[]>(parseRows(channelPrograms.value))

watch(channelRows, (rows) => {
  if (!rows.length) {
    channelPrograms.value = ''
    return
  }
  const obj: Record<string, string> = {}
  for (const r of rows) obj[String(r.ch)] = r.program
  channelPrograms.value = JSON.stringify(obj)
}, { deep: true })

function addRow(): void {
  const used = new Set(channelRows.value.map((r) => r.ch))
  const next = CHANNELS.find((c) => !used.has(c))
  if (next === undefined) return
  channelRows.value.push({ ch: next, program: 'piano' })
}

function removeRow(index: number): void {
  channelRows.value.splice(index, 1)
}

const soundfonts = ref<string[]>([])
onMounted(async () => {
  try {
    const res = await listResources('soundfont')
    soundfonts.value = res.resources.map((r) => r.filename)
  } catch {
    soundfonts.value = []
  }
})

const sheetEl = ref<HTMLElement | null>(null)
const engrave = useScoreEngrave({ xml: scoreXml, container: sheetEl })

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)
const following = ref(false)
let raf = 0

function tick(): void {
  const el = playerRef.value?.videoEl ?? null
  if (el && !el.paused && Number.isFinite(el.currentTime)
    && scoreXml.value) {
    following.value = true
    engrave.seekCursorToBeat(beatAtTime(parsed.value.tempo, el.currentTime))
  } else if (following.value && (!el || el.paused)) {
    following.value = false
  }
  raf = requestAnimationFrame(tick)
}

onMounted(() => {
  raf = requestAnimationFrame(tick)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
})
watch(scoreXml, () => {
  following.value = false
  engrave.hideCursor()
})
</script>
