<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite
      :source-video-url="sourceVideoUrl"
      :default-muted="false"
    />

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-[11px]">
        <span class="ctv:min-w-9 ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('videoMux.audioTrack') }}</span>
        <audio
          v-if="sourceAudioUrl"
          :src="sourceAudioUrl"
          class="ctv:flex-1 ctv:h-7 ctv:min-w-0"
          controls preload="metadata"
        />
        <span v-else class="ctv:flex-1 ctv:text-2xs ctv:italic ctv:text-muted-foreground">{{ $t('videoMux.noAudio') }}</span>
      </div>

      <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-[11px]">
        <button
          v-for="m in (['replace', 'mix'] as const)"
          :key="m"
          type="button"
          class="ctv:flex-1 ctv:py-1 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:transition-colors"
          :class="mode === m
            ? 'ctv:bg-secondary-background-selected ctv:border-primary-background ctv:text-primary-background'
            : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background'"
          @click="setMode(m)"
        >{{ $t(`videoMux.${m}`) }}</button>

        <label class="ctv:flex-1 ctv:flex ctv:items-center ctv:gap-1 ctv:py-0.5 ctv:px-1 ctv:rounded
                      ctv:bg-secondary-background ctv:border ctv:border-border-subtle">
          <span class="ctv:shrink-0 ctv:text-2xs ctv:text-muted-foreground">{{ $t('videoMux.offset') }}</span>
          <input
            type="number" min="-600" max="600" step="0.05"
            class="ctv-num-input ctv:w-full ctv:border-0 ctv:outline-none ctv:bg-transparent ctv:text-[11px] ctv:font-mono ctv:text-base-foreground"
            :value="offset"
            @change="(e) => setOffset((e.target as HTMLInputElement).value)"
          />
          <span class="ctv:text-2xs ctv:text-muted-foreground">s</span>
        </label>
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl || !sourceAudioUrl" class="ctv:text-muted-foreground">{{ $t('videoMux.needBoth') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('videoMux.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('videoMux.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('videoMux.adjustThenRun') }}</span>
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
import { bindWidgetCallback, onNodeConfigure, readWidgetNum, readWidgetStr, writeWidget } from '@/utils/widget'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const sourceAudioUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'audio'))

const mode = ref(readWidgetStr(props.node, 'mode', 'replace'))
const offset = ref(readWidgetNum(props.node, 'offset_s', 0))

function setMode(m: 'replace' | 'mix') {
  mode.value = m
  writeWidget(props.node, 'mode', m)
}
function setOffset(raw: string) {
  const v = Number(raw)
  if (!Number.isFinite(v)) return
  offset.value = Math.min(600, Math.max(-600, Math.round(v * 100) / 100))
  writeWidget(props.node, 'offset_s', offset.value)
}

bindWidgetCallback(props.node, 'mode', (value) => {
  const v = String(value ?? 'replace')
  if (v !== mode.value) mode.value = v
})
bindWidgetCallback(props.node, 'offset_s', (value) => {
  const v = Number(value)
  if (Number.isFinite(v) && v !== offset.value) offset.value = v
})

onNodeConfigure(props.node, () => {
  mode.value = readWidgetStr(props.node, 'mode', mode.value)
  offset.value = readWidgetNum(props.node, 'offset_s', offset.value)
})
</script>

<style scoped>
.ctv-num-input { -moz-appearance: textfield; }
.ctv-num-input::-webkit-inner-spin-button,
.ctv-num-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
</style>
