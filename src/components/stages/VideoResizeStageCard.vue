<template>
  <FxCardShell :node="node">
    <template #player>
      <VideoPlayerLite
        :source-video-url="sourceVideoUrl"
        @meta="onMeta"
      />
    </template>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-[11px]">
        <label class="ctv:flex-1 ctv:flex ctv:items-center ctv:gap-1 ctv:py-0.5 ctv:px-1 ctv:rounded
                      ctv:bg-secondary-background ctv:border ctv:border-border-subtle">
          <span class="ctv:w-3 ctv:text-2xs ctv:text-muted-foreground">W</span>
          <input
            type="number" min="-1" step="2"
            class="ctv-num-input ctv:w-full ctv:border-0 ctv:outline-none ctv:bg-transparent ctv:text-[11px] ctv:font-mono ctv:text-base-foreground"
            :value="width"
            @change="(e) => setDim('width', (e.target as HTMLInputElement).value)"
          />
        </label>
        <label class="ctv:flex-1 ctv:flex ctv:items-center ctv:gap-1 ctv:py-0.5 ctv:px-1 ctv:rounded
                      ctv:bg-secondary-background ctv:border ctv:border-border-subtle">
          <span class="ctv:w-3 ctv:text-2xs ctv:text-muted-foreground">H</span>
          <input
            type="number" min="-1" step="2"
            class="ctv-num-input ctv:w-full ctv:border-0 ctv:outline-none ctv:bg-transparent ctv:text-[11px] ctv:font-mono ctv:text-base-foreground"
            :value="height"
            @change="(e) => setDim('height', (e.target as HTMLInputElement).value)"
          />
        </label>
        <button
          type="button"
          :class="[
            'ctv:w-7 ctv:h-6 ctv:text-xs ctv:rounded ctv:cursor-pointer ctv:border',
            lockRatio
              ? 'ctv:bg-secondary-background-selected ctv:border-primary-background ctv:text-primary-background'
              : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground',
          ]"
          :title="lockRatio ? $t('imageCrop.unlockRatio') : $t('imageCrop.lockRatio')"
          @click="lockRatio = !lockRatio"
        ><i :class="['pi', lockRatio ? 'pi-lock' : 'pi-lock-open']" /></button>
      </div>

      <div class="ctv:flex ctv:items-center ctv:gap-1">
        <button
          v-for="p in PRESETS"
          :key="p.label"
          type="button"
          class="ctv:flex-1 ctv:py-0.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:transition-colors
                 ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background
                 ctv:disabled:opacity-40 ctv:disabled:cursor-default"
          :disabled="srcW <= 0"
          @click="applyPreset(p.short)"
        >{{ p.label }}</button>
        <button
          type="button"
          class="ctv:flex-1 ctv:py-0.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:transition-colors
                 ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background
                 ctv:disabled:opacity-40 ctv:disabled:cursor-default"
          :disabled="srcW <= 0"
          @click="applySource"
        >{{ $t('videoResize.source') }}</button>
      </div>

      <div v-if="srcW > 0" class="ctv:text-3xs ctv:text-center ctv:font-mono ctv:text-muted-foreground">
        {{ srcW }}×{{ srcH }} → {{ targetLabel }}
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('videoResize.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('videoResize.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('videoResize.adjustThenRun') }}</span>
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
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useVideoResize } from '@/composables/stages/useVideoResize'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const PRESETS = [
  { label: '480p', short: 480 },
  { label: '720p', short: 720 },
  { label: '1080p', short: 1080 },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))

const {
  width, height, lockRatio, srcW, srcH,
  onMeta, setDim, applyPreset, applySource, targetLabel,
} = useVideoResize(props.node)
</script>

<style scoped>
.ctv-num-input { -moz-appearance: textfield; }
.ctv-num-input::-webkit-inner-spin-button,
.ctv-num-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
</style>
