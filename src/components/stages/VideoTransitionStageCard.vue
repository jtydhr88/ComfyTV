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

        <div v-if="lumaWired" class="ctv:text-2xs ctv:text-muted-foreground">
          {{ $t('fx.lumaPreviewHint') }}
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
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.transition') }}</span>
        <div class="ctv-scroll-thin ctv:h-56 ctv:shrink-0 ctv:overflow-y-auto ctv:flex ctv:flex-col ctv:gap-0.5" @wheel.stop>
          <div v-for="grp in TRANSITION_GROUPS" :key="grp.id" class="ctv:flex ctv:flex-col ctv:gap-0.5">
            <button
              type="button"
              class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:w-full ctv:py-0.5 ctv:px-0 ctv:bg-transparent ctv:border-0 ctv:cursor-pointer ctv:text-left"
              @click="toggleGroup(grp.id)"
            >
              <i :class="['pi', expandedGroups.has(grp.id) ? 'pi-chevron-down' : 'pi-chevron-right', 'ctv:w-2.5 ctv:text-2xs ctv:text-muted-foreground']" />
              <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t(`fx.transitionGroup.${grp.id}`) }}</span>
              <span class="ctv:text-3xs ctv:font-mono ctv:text-muted-foreground">{{ grp.names.length }}</span>
              <span
                v-if="!expandedGroups.has(grp.id) && grp.names.includes(transition)"
                class="ctv:ml-auto ctv:text-2xs ctv:text-primary-background ctv:font-mono"
              >{{ transition }}</span>
            </button>
            <div v-show="expandedGroups.has(grp.id)" class="ctv:grid ctv:grid-cols-3 ctv:gap-1">
              <button
                v-for="name in grp.names"
                :key="name"
                type="button"
                class="ctv:flex ctv:items-center ctv:gap-1 ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:transition-colors ctv:min-w-0"
                :class="transition === name
                  ? 'ctv:bg-secondary-background-selected ctv:border-primary-background ctv:text-primary-background'
                  : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background'"
                :title="name"
                @click="transition = name"
              >
                <component :is="getTransitionIcon(name)" class="ctv:size-3 ctv:shrink-0" />
                <span class="ctv:truncate">{{ name }}</span>
              </button>
            </div>
          </div>
        </div>
      </template>

      <FxSlider
        v-model="duration"
        :label="$t('fx.duration')"
        :min="0.1" :max="5" :step="0.05"
        unit="s" :reset-to="1.0"
      />
      <template v-if="!lumaWired">
        <FxSlider
          v-model="offset"
          :label="$t('fx.offset')"
          :min="0" :max="offsetMax" :step="0.1"
          unit="s" :reset-to="0"
        />
        <div class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('fx.offsetAuto') }}</div>
      </template>

      <template v-if="!lumaWired">
        <div class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">Luma wipe</div>
        <div class="ctv-scroll-thin ctv:max-h-20 ctv:overflow-y-auto" @wheel.stop>
          <FxChips v-model="lumaMap" :options="LUMA_MAP_OPTS" />
        </div>
      </template>

      <template v-if="lumaWired || lumaMap !== 'none'">
        <FxSlider v-model="lumaSoftness" label="Softness" :min="0" :max="1" :step="0.01" :reset-to="0.1" />
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
          <input type="checkbox" v-model="lumaInvert" class="ctv:accent-primary-background" />
          Invert
        </label>
      </template>
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
import { getTransitionIcon } from '@/composables/stages/transitionIcons'
import { TRANSITION_GROUPS, transitionGroupOf } from '@/composables/stages/transitionCatalog'
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

const transition = useStrWidget(props.node, 'transition', 'fade')

const expandedGroups = ref(new Set<string>([transitionGroupOf(transition.value)]))

function toggleGroup(id: string) {
  const next = new Set(expandedGroups.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedGroups.value = next
}
const duration = useNumWidget(props.node, 'duration', 1.0)
const offset = useNumWidget(props.node, 'offset', 0)
const lumaWired = computed(() => Boolean(pickSourceImageUrl(props.state.inputs, 'luma_image')))
const lumaSoftness = useNumWidget(props.node, 'luma_softness', 0.1)
const lumaInvert = useBoolWidget(props.node, 'luma_invert', false)
const lumaMap = useStrWidget(props.node, 'luma_map', 'none')
const LUMA_MAP_OPTS = ['none', 'linear_x', 'linear_y', 'bilinear_x',
  'bilinear_y', 'radial', 'square', 'diamond', 'clock', 'symmetric_clock',
  'spiral', 'burst', 'curtain', 'blinds_h', 'blinds_v', 'checker', 'cloud']
  .map(v => ({ value: v, label: v.replace('_', ' ') }))

const canvasEl = ref<HTMLCanvasElement | null>(null)
const videoAEl = ref<HTMLVideoElement | null>(null)
const videoBEl = ref<HTMLVideoElement | null>(null)

const preview = useVideoTransitionPreview({
  videoAEl,
  videoBEl,
  canvasEl,
  nodeId: String(props.node.id),
  params: () => ({
    transition: lumaWired.value ? 'fade' : transition.value,
    duration: duration.value,
    offset: offset.value,
  }),
})

const offsetMax = computed(() => {
  const a = preview.durA.value
  if (a <= 0) return 3600
  return Math.max(0.1, Math.round((a - duration.value) * 10) / 10)
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
