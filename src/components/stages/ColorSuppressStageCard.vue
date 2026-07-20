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
      <FxSlider v-model="red" label="Red" :min="0" :max="1" :step="0.01" :reset-to="0" :gradient="CHANNEL_STOPS.red" />
      <FxSlider v-model="green" label="Green" :min="0" :max="1" :step="0.01" :reset-to="0" :gradient="CHANNEL_STOPS.green" />
      <FxSlider v-model="blue" label="Blue" :min="0" :max="1" :step="0.01" :reset-to="0" :gradient="CHANNEL_STOPS.blue" />
      <FxSlider v-model="cyan" label="Cyan" :min="0" :max="1" :step="0.01" :reset-to="0" :gradient="CHANNEL_STOPS.cyan" />
      <FxSlider v-model="magenta" label="Magenta" :min="0" :max="1" :step="0.01" :reset-to="0" :gradient="CHANNEL_STOPS.magenta" />
      <FxSlider v-model="yellow" label="Yellow" :min="0" :max="1" :step="0.01" :reset-to="0" :gradient="CHANNEL_STOPS.yellow" />
      <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
        <input type="checkbox" v-model="preserveLuma" class="ctv:accent-primary-background" />
        Preserve luminance
      </label>
      <FxChips v-model="output" :options="OUTPUTS" />
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
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useFxVideoPreview } from '@/composables/stages/useFxVideoPreview'
import { VideoColorSuppressRenderer } from '@/widgets/glsl/keyingRenderers'
import { useBoolWidget, useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'
import { CHANNEL_STOPS } from '@/components/widgets/colorStops'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const OUTPUTS = [
  { value: 'image', label: 'Image' },
  { value: 'matte', label: 'Matte' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const red = useNumWidget(props.node, 'red', 0)
const green = useNumWidget(props.node, 'green', 0)
const blue = useNumWidget(props.node, 'blue', 0)
const cyan = useNumWidget(props.node, 'cyan', 0)
const magenta = useNumWidget(props.node, 'magenta', 0)
const yellow = useNumWidget(props.node, 'yellow', 0)
const preserveLuma = useBoolWidget(props.node, 'preserve_luma', false)
const output = useStrWidget(props.node, 'output', 'image')

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)
const videoEl = computed<HTMLVideoElement | null>(() => playerRef.value?.videoEl ?? null)
const previewCanvas = ref<HTMLCanvasElement | null>(null)

const { supported } = useFxVideoPreview({
  videoEl,
  canvasEl: previewCanvas,
  nodeId: String(props.node.id),
  params: () => ({
    red: red.value,
    green: green.value,
    blue: blue.value,
    cyan: cyan.value,
    magenta: magenta.value,
    yellow: yellow.value,
    preserveLuma: preserveLuma.value,
    output: output.value,
  }),
  createRenderer: () => new VideoColorSuppressRenderer(),
})
</script>
