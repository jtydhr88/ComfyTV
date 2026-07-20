<template>
  <FxCardShell :node="node">
    <template #player>
      <VideoPlayerLite
        :source-video-url="sourceVideoUrl"
        :volume="Math.min(1, volume)"
        :default-muted="false"
      />
    </template>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-[11px]">
        <span class="ctv:min-w-9 ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('videoVolume.volume') }}</span>
        <input
          type="range" min="0" max="2" step="0.05"
          class="ctv:flex-1 ctv:accent-primary-background ctv:cursor-pointer"
          :value="Math.min(2, volume)"
          @input="(e) => setVolume(Number((e.target as HTMLInputElement).value))"
        />
        <input
          type="number" min="0" max="800" step="5"
          class="ctv-num-input ctv:w-14 ctv:py-0.5 ctv:px-1 ctv:text-right ctv:text-[11px] ctv:font-mono ctv:rounded
                 ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground"
          :value="Math.round(volume * 100)"
          @change="(e) => setVolume(Number((e.target as HTMLInputElement).value) / 100)"
        />
        <span class="ctv:text-2xs ctv:text-muted-foreground">%</span>
      </div>

      <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-[11px]">
        <label class="ctv:flex-1 ctv:flex ctv:items-center ctv:gap-1 ctv:py-0.5 ctv:px-1 ctv:rounded
                      ctv:bg-secondary-background ctv:border ctv:border-border-subtle">
          <span class="ctv:shrink-0 ctv:text-2xs ctv:text-muted-foreground">{{ $t('videoVolume.fadeIn') }}</span>
          <input
            type="number" min="0" max="60" step="0.1"
            class="ctv-num-input ctv:w-full ctv:border-0 ctv:outline-none ctv:bg-transparent ctv:text-[11px] ctv:font-mono ctv:text-base-foreground"
            :value="fadeIn"
            @change="(e) => setFade('fade_in_s', (e.target as HTMLInputElement).value)"
          />
          <span class="ctv:text-2xs ctv:text-muted-foreground">s</span>
        </label>
        <label class="ctv:flex-1 ctv:flex ctv:items-center ctv:gap-1 ctv:py-0.5 ctv:px-1 ctv:rounded
                      ctv:bg-secondary-background ctv:border ctv:border-border-subtle">
          <span class="ctv:shrink-0 ctv:text-2xs ctv:text-muted-foreground">{{ $t('videoVolume.fadeOut') }}</span>
          <input
            type="number" min="0" max="60" step="0.1"
            class="ctv-num-input ctv:w-full ctv:border-0 ctv:outline-none ctv:bg-transparent ctv:text-[11px] ctv:font-mono ctv:text-base-foreground"
            :value="fadeOut"
            @change="(e) => setFade('fade_out_s', (e.target as HTMLInputElement).value)"
          />
          <span class="ctv:text-2xs ctv:text-muted-foreground">s</span>
        </label>
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('videoVolume.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('videoVolume.done') }}</span>
      <span v-else-if="volume > 1" class="ctv:text-muted-foreground">{{ $t('videoVolume.previewCapNote') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('videoVolume.adjustThenRun') }}</span>
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
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { bindWidgetCallback, onNodeConfigure, readWidgetNum, writeWidget } from '@/utils/widget'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))

const volume = ref(readWidgetNum(props.node, 'volume', 1))
const fadeIn = ref(readWidgetNum(props.node, 'fade_in_s', 0))
const fadeOut = ref(readWidgetNum(props.node, 'fade_out_s', 0))

function setVolume(v: number) {
  if (!Number.isFinite(v)) return
  volume.value = Math.min(8, Math.max(0, Math.round(v * 100) / 100))
  writeWidget(props.node, 'volume', volume.value)
}
function setFade(name: 'fade_in_s' | 'fade_out_s', raw: string) {
  const v = Number(raw)
  if (!Number.isFinite(v)) return
  const clamped = Math.min(60, Math.max(0, Math.round(v * 10) / 10))
  if (name === 'fade_in_s') fadeIn.value = clamped
  else fadeOut.value = clamped
  writeWidget(props.node, name, clamped)
}

bindWidgetCallback(props.node, 'volume', (value) => {
  const v = Number(value)
  if (Number.isFinite(v) && v !== volume.value) volume.value = v
})
bindWidgetCallback(props.node, 'fade_in_s', (value) => {
  const v = Number(value)
  if (Number.isFinite(v) && v !== fadeIn.value) fadeIn.value = v
})
bindWidgetCallback(props.node, 'fade_out_s', (value) => {
  const v = Number(value)
  if (Number.isFinite(v) && v !== fadeOut.value) fadeOut.value = v
})

onNodeConfigure(props.node, () => {
  volume.value = readWidgetNum(props.node, 'volume', volume.value)
  fadeIn.value = readWidgetNum(props.node, 'fade_in_s', fadeIn.value)
  fadeOut.value = readWidgetNum(props.node, 'fade_out_s', fadeOut.value)
})
</script>

<style scoped>
.ctv-num-input { -moz-appearance: textfield; }
.ctv-num-input::-webkit-inner-spin-button,
.ctv-num-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
</style>
