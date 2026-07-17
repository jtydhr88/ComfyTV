<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div class="ctv:relative ctv:w-full ctv:h-[200px] ctv:rounded-md ctv:overflow-hidden ctv:bg-black ctv:border ctv:border-border-subtle">
      <video
        ref="videoEl"
        :src="sourceVideoUrl ?? undefined"
        muted
        playsinline
        preload="metadata"
        class="ctv:block ctv:size-full ctv:object-contain"
        @loadedmetadata="onMeta"
        @click="onVideoClick"
        @dblclick="onVideoDblClick"
      />
      <canvas ref="overlayEl" class="ctv:absolute ctv:inset-0 ctv:size-full ctv:pointer-events-none" />
    </div>

    <div class="ctv:text-2xs ctv:text-muted-foreground ctv:tracking-wide">{{ $t('fx.trackHint') }}</div>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <div class="ctv:flex ctv:items-center ctv:justify-between ctv:gap-1">
        <span class="ctv:text-2xs ctv:text-muted-foreground ctv:tracking-wide">{{ points.length }} points</span>
        <button
          type="button"
          class="ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border
                 ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground
                 ctv:hover:border-primary-background"
          @click="clearPoints"
        >Clear</button>
      </div>

      <FxChips v-model="solve" :options="SOLVES" />
      <div v-if="solveHint" class="ctv:text-2xs ctv:text-muted-foreground">{{ solveHint }}</div>

      <FxSlider v-model="tStart" :label="$t('fx.tStart')" :min="0" :max="3600" :step="0.05" />
      <FxSlider v-model="tEnd" :label="$t('fx.tEnd')" :min="-1" :max="3600" :step="0.05" />
      <div class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('fx.tEndAuto') }}</div>
      <FxSlider v-model="pattern" :label="$t('fx.pattern')" :min="4" :max="64" :step="1" :decimals="0" />
      <FxSlider v-model="search" :label="$t('fx.searchR')" :min="8" :max="128" :step="1" :decimals="0" />
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
import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useMotionTrackEditor } from '@/composables/stages/useMotionTrackEditor'
import { useNumWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const SOLVES = [
  { value: 'none', label: 'Raw' },
  { value: 'translation', label: 'Move' },
  { value: 'similarity', label: 'Move+Rot+Scale' },
  { value: 'perspective', label: 'Perspective' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const tStart = useNumWidget(props.node, 't_start', 0)
const tEnd = useNumWidget(props.node, 't_end', -1)

const videoEl = ref<HTMLVideoElement | null>(null)
const overlayEl = ref<HTMLCanvasElement | null>(null)

const {
  points, solve, solveHint, pattern, search,
  onMeta, onVideoClick, onVideoDblClick, clearPoints,
} = useMotionTrackEditor({ node: props.node, videoEl, overlayEl })
</script>
