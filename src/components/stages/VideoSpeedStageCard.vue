<template>
  <FxCardShell :node="node">
    <template #player>
      <VideoPlayerLite
        :source-video-url="sourceVideoUrl"
        :playback-rate="speed"
      />
    </template>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxSlider
        :model-value="speed"
        :label="$t('videoSpeed.speed')"
        :min="0.25"
        :max="4"
        :step="0.05"
        :decimals="2"
        :reset-to="1"
        unit="x"
        @update:model-value="setSpeed"
      />

      <div class="ctv:flex ctv:items-center ctv:gap-1">
        <button
          v-for="p in SPEED_PRESETS"
          :key="p"
          type="button"
          class="ctv:flex-1 ctv:py-0.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:transition-colors"
          :class="speed === p
            ? 'ctv:bg-secondary-background-selected ctv:border-primary-background ctv:text-primary-background'
            : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background'"
          @click="setSpeed(p)"
        >{{ p }}x</button>
        <button
          type="button"
          class="ctv:flex-1 ctv:py-0.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:transition-colors"
          :class="reverse
            ? 'ctv:bg-secondary-background-selected ctv:border-primary-background ctv:text-primary-background'
            : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background'"
          :title="$t('videoSpeed.reverseTip')"
          @click="reverse = !reverse"
        ><i class="pi pi-replay" /> {{ $t('videoSpeed.reverse') }}</button>
      </div>

      <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
        <input type="checkbox" v-model="pitchCompensate" class="ctv:accent-primary-background" />
        Keep pitch
      </label>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('videoSpeed.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('videoSpeed.done') }}</span>
      <span v-else-if="reverse" class="ctv:text-muted-foreground">{{ $t('videoSpeed.reverseNote') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('videoSpeed.adjustThenRun') }}</span>
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
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
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

const SPEED_PRESETS = [0.25, 0.5, 1, 1.5, 2, 4]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))

const speed = useNumWidget(props.node, 'speed', 1)
const reverse = useBoolWidget(props.node, 'reverse', false)
const pitchCompensate = useBoolWidget(props.node, 'pitch_compensate', true)

function setSpeed(v: number) {
  if (!Number.isFinite(v)) return
  speed.value = Math.min(4, Math.max(0.25, Math.round(v * 100) / 100))
}
</script>
