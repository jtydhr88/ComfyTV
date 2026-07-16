<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" />

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxSlider v-model="translateX" label="Translate X" :min="-2000" :max="2000" :step="1" :decimals="0" :reset-to="0" />
      <FxSlider v-model="translateY" label="Translate Y" :min="-2000" :max="2000" :step="1" :decimals="0" :reset-to="0" />
      <FxSlider v-model="scale" :label="$t('fx.scale')" :min="0.2" :max="4" :step="0.05" :reset-to="1.4" />
      <FxSlider v-model="rotateDeg" label="Rotate" :min="-180" :max="180" :step="0.5" :reset-to="0" unit="°" />
      <FxSlider v-model="steps" label="Steps" :min="1" :max="7" :step="1" :decimals="0" :reset-to="5" />
      <FxSlider v-model="decay" label="Decay" :min="0.001" :max="1" :step="0.01" :reset-to="0.3" />
      <FxSlider v-model="mix" label="Mix" :min="0" :max="1" :step="0.01" :reset-to="1" />

      <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
        <input type="checkbox" v-model="maxMode" class="ctv:accent-primary-background" />
        Max
      </label>
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
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useBoolWidget, useNumWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const translateX = useNumWidget(props.node, 'translate_x', 0)
const translateY = useNumWidget(props.node, 'translate_y', 0)
const scale = useNumWidget(props.node, 'scale', 1.4)
const rotateDeg = useNumWidget(props.node, 'rotate_deg', 0)
const steps = useNumWidget(props.node, 'steps', 5)
const decay = useNumWidget(props.node, 'decay', 0.3)
const mix = useNumWidget(props.node, 'mix', 1)
const maxMode = useBoolWidget(props.node, 'max_mode', false)
</script>
