<template>
  <FxCardShell :node="node">
    <template #player>
      <VideoPlayerLite ref="playerRef" :source-video-url="sourceVideoUrl">
        <template #overlay>
          <canvas
            v-show="supported"
            ref="previewCanvas"
            class="ctv:absolute ctv:inset-0 ctv:size-full ctv:object-contain ctv:pointer-events-none"
          />
        </template>
      </VideoPlayerLite>
    </template>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxChips v-model="channel" :options="CHANNELS" />
      <CurvesCanvas v-model="activeCurve" :color="CHANNEL_COLORS[channel]" />
      <div class="ctv:flex ctv:items-center ctv:gap-1">
        <div class="ctv:flex-1 ctv:text-2xs ctv:text-center ctv:text-muted-foreground">{{ $t('fx.curveHint') }}</div>
        <button
          type="button"
          class="ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border
                 ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground
                 ctv:hover:border-primary-background"
          @click="resetActive"
        >{{ $t('fx.resetCurve') }}</button>
      </div>
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
  </FxCardShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxCardShell from '@/components/stages/FxCardShell.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import CurvesCanvas from '@/components/widgets/fx/CurvesCanvas.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useCurveChannels } from '@/composables/stages/useCurveChannels'
import { useVideoCurvesPreview } from '@/composables/stages/useVideoCurvesPreview'
import type { VideoCurvesParams } from '@/composables/stages/videoCurvesMath'
import { useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const CHANNEL_COLORS: Record<string, string> = {
  master: '#e0e0e0', red: '#ef5350', green: '#66bb6a', blue: '#42a5f5',
}
const CHANNELS = [
  { value: 'master', label: 'RGB' },
  { value: 'red', label: 'R' },
  { value: 'green', label: 'G' },
  { value: 'blue', label: 'B' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const preset = useStrWidget(props.node, 'preset', 'none')

const { channel, activeCurve, resetActive, widgets } = useCurveChannels(props.node)

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)
const previewCanvas = ref<HTMLCanvasElement | null>(null)
const previewVideoEl = computed<HTMLVideoElement | null>(
  () => playerRef.value?.videoEl ?? null,
)

function previewParams(): Partial<VideoCurvesParams> {
  return {
    preset: preset.value,
    master: widgets.master.value,
    red: widgets.red.value,
    green: widgets.green.value,
    blue: widgets.blue.value,
  }
}

const { supported } = useVideoCurvesPreview({
  videoEl: previewVideoEl,
  canvasEl: previewCanvas,
  nodeId: String(props.node.id),
  params: previewParams,
})
</script>
