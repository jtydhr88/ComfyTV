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
      <FxSlider v-model="smoothing" label="Smoothing (frames)" :min="1" :max="120" :step="1" :decimals="0" :reset-to="15" />
      <FxSlider v-model="strength" label="Strength" :min="0" :max="1" :step="0.01" :reset-to="1" />
      <div class="ctv:text-2xs ctv:text-muted-foreground ctv:leading-snug">
        {{ $t('fx.stab360Hint') }}
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
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
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useNumWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const smoothing = useNumWidget(props.node, 'smoothing', 15)
const strength = useNumWidget(props.node, 'strength', 1)
</script>
