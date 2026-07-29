<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full" @contextmenu.stop.prevent>
    <template v-if="showGlslPreview">
      <div
        class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:w-full ctv:flex-1"
        @pointerdown.stop
        @pointermove.stop
        @pointerup.stop
      >
        <div class="ctv:relative ctv:w-full ctv:flex-1 ctv:min-h-[140px] ctv:rounded-md ctv:overflow-hidden ctv:bg-black ctv:border ctv:border-border-subtle">
          <canvas ref="canvasEl" class="ctv:block ctv:size-full ctv:object-contain" />
          <video
            ref="videoAEl"
            :src="srcA ?? undefined"
            class="ctv:hidden"
            muted playsinline preload="metadata"
          />
          <video
            ref="videoBEl"
            :src="srcB ?? undefined"
            class="ctv:hidden"
            muted playsinline preload="metadata"
          />
          <img
            ref="lumaEl"
            :src="lumaSrc || undefined"
            crossorigin="anonymous"
            class="ctv:hidden"
            @load="preview.renderOnce()"
          />
        </div>

        <div class="ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-1.5 ctv:text-[11px]">
          <button
            type="button"
            class="ctv:flex ctv:items-center ctv:justify-center ctv:w-7 ctv:h-6 ctv:text-xs ctv:rounded ctv:cursor-pointer
                   ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground
                   ctv:hover:border-primary-background ctv:disabled:opacity-40 ctv:disabled:cursor-default"
            :disabled="!preview.ready.value"
            :title="preview.playing.value ? $t('videoTrim.pause') : $t('videoCrop.play')"
            @click="preview.togglePlay()"
          ><i :class="['pi', preview.playing.value ? 'pi-pause' : 'pi-play']" /></button>

          <div
            class="ctv:relative ctv:flex-1 ctv:h-2 ctv:rounded-full ctv:overflow-hidden ctv:bg-secondary-background
                   ctv:border ctv:border-border-subtle ctv:touch-none"
            :class="preview.ready.value ? 'ctv:cursor-pointer' : 'ctv:cursor-default'"
            @pointerdown="onScrubStart"
            @pointermove="onScrubMove"
            @pointerup="onScrubEnd"
            @pointercancel="onScrubEnd"
          >
            <div
              class="ctv:absolute ctv:inset-y-0 ctv:left-0 ctv:bg-primary-background ctv:pointer-events-none"
              :style="{ width: `${fillPct}%` }"
            />
            <div
              class="ctv:absolute ctv:inset-y-0 ctv:bg-primary-background/20 ctv:border-x ctv:border-primary-background/45 ctv:pointer-events-none"
              :style="{ left: `${bandLeftPct}%`, width: `${bandWidthPct}%` }"
            />
          </div>

          <span class="ctv:shrink-0 ctv:font-mono ctv:text-muted-foreground">
            {{ timelineTime }} / {{ timelineTotal }}
          </span>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
        <FxChips
          v-model="previewSide"
          :options="[
            { value: 'A', label: 'A' },
            { value: 'B', label: 'B' },
          ]"
        />
      </div>

      <VideoPlayerLite :source-video-url="previewSide === 'A' ? srcA : srcB" />
    </template>

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <template v-if="!lumaWired">
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.lumaPattern') }}</span>
        <div class="ctv-scroll-thin ctv:max-h-24 ctv:overflow-y-auto" @wheel.stop>
          <FxChips v-model="lumaMap" :options="LUMA_MAP_OPTS" />
        </div>
      </template>
      <div v-else class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('fx.lumaWiredHint') }}</div>

      <FxSlider
        v-model="duration"
        :label="$t('fx.duration')"
        :min="0.1" :max="5" :step="0.05"
        unit="s" :reset-to="1.0"
      />
      <FxSlider
        v-model="softness"
        :label="$t('fx.softness')"
        :min="0" :max="1" :step="0.01"
        :reset-to="0.1"
      />
      <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
        <input type="checkbox" v-model="invert" class="ctv:accent-primary-background" />
        {{ $t('fx.invert') }}
      </label>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!srcA || !srcB" class="ctv:text-muted-foreground">{{ $t('fx.needsTwoInputs') }}</span>
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
import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useVideoTransitionPreview } from '@/composables/stages/useVideoTransitionPreview'
import { useBoolWidget, useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const srcA = computed(() => pickSourceImageUrl(props.state.inputs, 'video_a'))
const srcB = computed(() => pickSourceImageUrl(props.state.inputs, 'video_b'))

const previewSide = ref<'A' | 'B'>('A')

const duration = useNumWidget(props.node, 'duration', 1.0)
const softness = useNumWidget(props.node, 'softness', 0.1)
const invert = useBoolWidget(props.node, 'invert', false)
const lumaMap = useStrWidget(props.node, 'luma_map', 'radial')

const lumaImageUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'luma_image'))
const lumaWired = computed(() => Boolean(lumaImageUrl.value))
const lumaSrc = computed(() => {
  if (lumaImageUrl.value) return lumaImageUrl.value
  return `/comfytv/luma_map?kind=${encodeURIComponent(lumaMap.value)}&w=320&h=180`
})

const LUMA_MAP_OPTS = ['linear_x', 'linear_y', 'bilinear_x', 'bilinear_y',
  'radial', 'square', 'diamond', 'clock', 'symmetric_clock', 'spiral',
  'burst', 'curtain', 'blinds_h', 'blinds_v', 'checker', 'cloud']
  .map(v => ({ value: v, label: v.replace('_', ' ') }))

const canvasEl = ref<HTMLCanvasElement | null>(null)
const videoAEl = ref<HTMLVideoElement | null>(null)
const videoBEl = ref<HTMLVideoElement | null>(null)
const lumaEl = ref<HTMLImageElement | null>(null)

const preview = useVideoTransitionPreview({
  videoAEl,
  videoBEl,
  canvasEl,
  lumaEl,
  nodeId: String(props.node.id),
  params: () => ({
    transition: 'fade',
    duration: duration.value,
    offset: 0,
    lumaMode: invert.value ? 2 : 1,
    lumaSoftness: softness.value,
  }),
})

const showGlslPreview = computed(() =>
  preview.supported.value && Boolean(srcA.value) && Boolean(srcB.value),
)

const timelineTime = computed(() => `${preview.time.value.toFixed(2)}s`)
const timelineTotal = computed(() => `${preview.timeline.value.total.toFixed(2)}s`)
const fillPct = computed(() =>
  Math.min(100, (preview.time.value / preview.timeline.value.total) * 100),
)
const bandLeftPct = computed(() =>
  (preview.timeline.value.lead / preview.timeline.value.total) * 100,
)
const bandWidthPct = computed(() =>
  (preview.window.value.duration / preview.timeline.value.total) * 100,
)

let scrubbing = false

function scrubTo(e: PointerEvent): void {
  const el = e.currentTarget as HTMLElement | null
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0) return
  preview.scrub((e.clientX - rect.left) / rect.width)
}

function onScrubStart(e: PointerEvent): void {
  if (!preview.ready.value) return
  scrubbing = true
  preview.pause()
  ;(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId)
  scrubTo(e)
}

function onScrubMove(e: PointerEvent): void {
  if (!scrubbing) return
  scrubTo(e)
}

function onScrubEnd(e: PointerEvent): void {
  if (!scrubbing) return
  scrubbing = false
  ;(e.currentTarget as HTMLElement | null)?.releasePointerCapture?.(e.pointerId)
}
</script>
