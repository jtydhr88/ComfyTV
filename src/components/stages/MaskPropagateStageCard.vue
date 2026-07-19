<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite ref="playerRef" :source-video-url="sourceVideoUrl" />

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <img v-if="maskUrl" :src="maskUrl" class="ctv:w-full ctv:max-h-24 ctv:object-contain ctv:rounded ctv:border ctv:border-border-subtle">

      <FxChips v-model="model" :options="MODELS" />
      <FxSlider v-model="tRef" label="Ref time (s)" :min="0" :max="tMax" :step="0.05" :reset-to="0" />
      <FxSlider v-model="maxPoints" label="Max points" :min="4" :max="64" :step="1" :decimals="0" :reset-to="24" />

      <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
        <input type="checkbox" v-model="invert" class="ctv:accent-primary-background" />
        {{ $t('fx.invert') }}
      </label>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="!maskUrl" class="ctv:text-muted-foreground">Wire a first-frame mask (Split Part / SAM output works)</span>
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
import { useBoolWidget, useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const MODELS = [
  { value: 'translation', label: 'Translation' },
  { value: 'similarity', label: 'Similarity' },
  { value: 'perspective', label: 'Perspective' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)
const tMax = computed(() => {
  const d = playerRef.value?.duration ?? 0
  return d > 0 ? Math.max(0.1, Math.round(d * 10) / 10) : 3600
})
const maskUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'mask'))
const model = useStrWidget(props.node, 'model', 'translation')
const tRef = useNumWidget(props.node, 't_ref', 0)
const maxPoints = useNumWidget(props.node, 'max_points', 24)
const invert = useBoolWidget(props.node, 'invert', false)
</script>
