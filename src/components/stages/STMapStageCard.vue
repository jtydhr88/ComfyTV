<template>
  <FxCardShell :node="node">
    <template #player>
      <VideoPlayerLite :source-video-url="sourceVideoUrl" />
    </template>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxChips v-model="mode" :options="MODES" />
      <FxChips v-model="wrap" :options="WRAPS" />

      <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
        <input type="checkbox" v-model="flipV" class="ctv:accent-primary-background" />
        Flip V
      </label>

      <FxSlider v-if="mode === 'idistort'" v-model="amount" :label="$t('fx.amount')" :min="0" :max="512" :step="1" :decimals="0" :reset-to="32" />
      <FxSlider v-model="uOffset" label="U offset" :min="-1" :max="1" :step="0.01" :reset-to="0" />
      <FxSlider v-model="vOffset" label="V offset" :min="-1" :max="1" :step="0.01" :reset-to="0" />
      <FxSlider v-model="uScale" label="U scale" :min="-4" :max="4" :step="0.01" :reset-to="1" />
      <FxSlider v-model="vScale" label="V scale" :min="-4" :max="4" :step="0.01" :reset-to="1" />
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="!uvUrl" class="ctv:text-muted-foreground">Wire a UV map (video or image)</span>
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
import { computed } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxCardShell from '@/components/stages/FxCardShell.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useBoolWidget, useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const MODES = [
  { value: 'stmap', label: 'STMap' },
  { value: 'idistort', label: 'IDistort' },
]

const WRAPS = [
  { value: 'clamp', label: 'Clamp' },
  { value: 'repeat', label: 'Repeat' },
  { value: 'mirror', label: 'Mirror' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const uvUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'uv_video') || pickSourceImageUrl(props.state.inputs, 'uv_image'))
const mode = useStrWidget(props.node, 'mode', 'stmap')
const wrap = useStrWidget(props.node, 'wrap', 'clamp')
const flipV = useBoolWidget(props.node, 'flip_v', true)
const amount = useNumWidget(props.node, 'amount', 32)
const uOffset = useNumWidget(props.node, 'u_offset', 0)
const vOffset = useNumWidget(props.node, 'v_offset', 0)
const uScale = useNumWidget(props.node, 'u_scale', 1)
const vScale = useNumWidget(props.node, 'v_scale', 1)
</script>
