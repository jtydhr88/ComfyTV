<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite
      :source-video-url="sourceVideoUrl"
      :playback-rate="speed"
    />

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-[11px]">
        <span class="ctv:min-w-9 ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('videoSpeed.speed') }}</span>
        <input
          type="range" min="0.25" max="4" step="0.05"
          class="ctv:flex-1 ctv:accent-primary-background ctv:cursor-pointer"
          :value="speed"
          @input="(e) => setSpeed(Number((e.target as HTMLInputElement).value))"
        />
        <span class="ctv:w-11 ctv:text-right ctv:font-mono ctv:font-bold ctv:text-primary-background">{{ speed.toFixed(2) }}x</span>
      </div>

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
          @click="setReverse(!reverse)"
        ><i class="pi pi-replay" /> {{ $t('videoSpeed.reverse') }}</button>
      </div>
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { bindWidgetCallback, onNodeConfigure, readWidgetNum, writeWidget, getWidget } from '@/utils/widget'

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

const speed = ref(readWidgetNum(props.node, 'speed', 1))
const reverse = ref(Boolean(getWidget(props.node, 'reverse')?.value))

function setSpeed(v: number) {
  if (!Number.isFinite(v)) return
  speed.value = Math.min(4, Math.max(0.25, Math.round(v * 100) / 100))
  writeWidget(props.node, 'speed', speed.value)
}
function setReverse(v: boolean) {
  reverse.value = v
  writeWidget(props.node, 'reverse', v)
}

bindWidgetCallback(props.node, 'speed', (value) => {
  const v = Number(value)
  if (Number.isFinite(v) && v !== speed.value) speed.value = v
})
bindWidgetCallback(props.node, 'reverse', (value) => {
  const v = Boolean(value)
  if (v !== reverse.value) reverse.value = v
})

onNodeConfigure(props.node, () => {
  speed.value = readWidgetNum(props.node, 'speed', speed.value)
  reverse.value = Boolean(getWidget(props.node, 'reverse')?.value)
})
</script>
