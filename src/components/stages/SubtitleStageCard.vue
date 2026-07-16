<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" />

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <div class="ctv:flex ctv:flex-col ctv:gap-1 ctv:max-h-44 ctv:overflow-y-auto">
        <div v-for="(cue, i) in cues" :key="i" class="ctv:flex ctv:items-center ctv:gap-1">
          <input
            type="number"
            step="0.1"
            min="0"
            :value="+cue.start.toFixed(2)"
            class="ctv:w-16 ctv:p-1 ctv:text-[11px] ctv:rounded ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground"
            @change="onCueNum(i, 'start', $event)"
          />
          <input
            type="number"
            step="0.1"
            min="0"
            :value="+cue.end.toFixed(2)"
            class="ctv:w-16 ctv:p-1 ctv:text-[11px] ctv:rounded ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground"
            @change="onCueNum(i, 'end', $event)"
          />
          <input
            type="text"
            :value="cue.text"
            class="ctv:flex-1 ctv:min-w-0 ctv:p-1 ctv:text-[11px] ctv:rounded ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground"
            @change="onCueText(i, $event)"
          />
          <button
            type="button"
            class="ctv:py-0.5 ctv:px-1 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border
                   ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground
                   ctv:hover:border-primary-background"
            @click="removeCue(i)"
          ><i class="pi pi-times" /></button>
        </div>
      </div>

      <button
        type="button"
        class="ctv:py-0.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border
               ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground
               ctv:hover:border-primary-background"
        @click="addCue"
      >+ Add cue</button>

      <div class="ctv:text-2xs ctv:text-muted-foreground ctv:tracking-wide">{{ cues.length }} {{ $t('fx.cues') }}</div>

      <details class="ctv:flex ctv:flex-col ctv:gap-1">
        <summary class="ctv:text-2xs ctv:text-muted-foreground ctv:tracking-wide ctv:cursor-pointer">SRT source</summary>
        <textarea
          v-model="subs"
          rows="6"
          :placeholder="$t('fx.subsPlaceholder')"
          class="ctv:w-full ctv:p-1 ctv:text-[11px] ctv:rounded ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground ctv:resize-none ctv:font-mono"
        />
      </details>

      <div class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.fontLbl') }}</div>
      <FxChips v-model="font" :options="FONTS" />

      <FxSlider v-model="size" :label="$t('fx.fontSize')" :min="8" :max="200" :step="1" :decimals="0" />

      <div class="ctv:flex ctv:items-center ctv:gap-3 ctv:text-[11px]">
        <label class="ctv:flex ctv:items-center ctv:gap-1.5">
          <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.colorLbl') }}</span>
          <input
            v-model="color"
            type="color"
            class="ctv:h-6 ctv:w-10 ctv:cursor-pointer ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background"
          />
        </label>
      </div>
      <FxSlider v-model="stroke" :label="$t('fx.strokeLbl')" :min="0" :max="20" :step="1" :decimals="0" />

      <div class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.anchor') }}</div>
      <FxChips v-model="anchor" :options="ANCHORS" />
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
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
import { computed } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const FONTS = [
  { value: 'Inter-Regular', label: 'Inter' },
  { value: 'NotoSansSC-Regular', label: 'Noto SC' },
  { value: 'msyh', label: '雅黑' },
  { value: 'arial', label: 'Arial' },
]

const ANCHORS = [
  { value: 'bottom', label: 'Bottom' },
  { value: 'top', label: 'Top' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const subs = useStrWidget(props.node, 'subs', '')
const font = useStrWidget(props.node, 'font', 'Inter-Regular')
const size = useNumWidget(props.node, 'size', 36)
const color = useStrWidget(props.node, 'color', '#ffffff')
const stroke = useNumWidget(props.node, 'stroke', 2)
const anchor = useStrWidget(props.node, 'anchor', 'bottom')

type Cue = { start: number; end: number; text: string }

const TIME_RE = /(\d+):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d+):(\d{2}):(\d{2})[,.](\d{1,3})/

function srtTimeToSec(h: string, m: string, s: string, ms: string): number {
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, '0')) / 1000
}

function secToSrtTime(sec: number): string {
  const total = Math.max(0, Math.round(sec * 1000))
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(Math.floor(total / 3600000))}:${pad(Math.floor(total / 60000) % 60)}:${pad(Math.floor(total / 1000) % 60)},${pad(total % 1000, 3)}`
}

function parseSrt(raw: string): Cue[] {
  const cues: Cue[] = []
  let current: Cue | null = null
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(TIME_RE)
    if (m) {
      current = {
        start: srtTimeToSec(m[1], m[2], m[3], m[4]),
        end: srtTimeToSec(m[5], m[6], m[7], m[8]),
        text: '',
      }
      cues.push(current)
    } else if (current) {
      const t = line.trim()
      if (!t) current = null
      else current.text = current.text ? `${current.text}\n${t}` : t
    }
  }
  return cues
}

function serializeSrt(cues: Cue[]): string {
  return cues
    .map((c, i) => `${i + 1}\n${secToSrtTime(c.start)} --> ${secToSrtTime(c.end)}\n${c.text}`)
    .join('\n\n')
}

const cues = computed(() => parseSrt(subs.value))

function writeCues(next: Cue[]) {
  subs.value = next.length ? serializeSrt(next) : ''
}

function updateCue(i: number, patch: Partial<Cue>) {
  writeCues(cues.value.map((c, j) => (j === i ? { ...c, ...patch } : c)))
}

function removeCue(i: number) {
  const next = cues.value.slice()
  next.splice(i, 1)
  writeCues(next)
}

function addCue() {
  const last = cues.value[cues.value.length - 1]
  const start = last ? last.end : 0
  writeCues([...cues.value, { start, end: start + 2, text: '' }])
}

function onCueNum(i: number, key: 'start' | 'end', e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  if (Number.isFinite(v)) updateCue(i, { [key]: Math.max(0, v) })
}

function onCueText(i: number, e: Event) {
  updateCue(i, { text: (e.target as HTMLInputElement).value })
}
</script>
