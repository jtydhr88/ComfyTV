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
      <FxChips v-model="scMethod" :options="METHODS" />
      <div
        class="ctv:h-48 ctv:shrink-0 ctv:overflow-y-auto ctv-scroll-thin ctv:flex ctv:flex-col ctv:gap-1"
        @wheel.stop
      >
        <FxSlider v-for="z in ZONES" :key="z.id" v-model="z.model.value" :label="z.label" :min="-1" :max="1" :step="0.01" :reset-to="0" :gradient="z.gradient" />
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('fx.chainMode') }}</span>
    </div>

    <StageCard
      :state="state"
      :node="node"
      hide-run-button
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
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useChainedFxPreview } from '@/composables/stages/useChainedFxPreview'
import { VideoSelectiveColorRenderer } from '@/widgets/glsl/videoSelectiveColorRenderer'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'
import { channelStops } from '@/components/widgets/colorStops'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const METHODS = [
  { value: 'absolute', label: 'Absolute' },
  { value: 'relative', label: 'Relative' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const scMethod = useStrWidget(props.node, 'sc_method', 'absolute')
const ZONE_IDS = ['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas', 'whites', 'neutrals', 'blacks']
const ZONES = ZONE_IDS.map(id => ({
  id,
  label: id[0].toUpperCase() + id.slice(1),
  model: useNumWidget(props.node, `sc_${id}`, 0),
  gradient: channelStops(id),
}))

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)
const videoEl = computed<HTMLVideoElement | null>(() => playerRef.value?.videoEl ?? null)
const previewCanvas = ref<HTMLCanvasElement | null>(null)

const { supported } = useChainedFxPreview({
  videoEl,
  canvasEl: previewCanvas,
  nodeId: String(props.node.id),
  node: props.node,
  params: () => ({
    scMethod: scMethod.value,
    zones: Object.fromEntries(ZONES.map(z => [z.id, z.model.value])),
  }),
  createRenderer: () => new VideoSelectiveColorRenderer(),
})

</script>
