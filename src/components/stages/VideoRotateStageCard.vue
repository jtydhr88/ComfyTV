<template>
  <FxCardShell :node="node">
    <template #player>
      <VideoPlayerLite
        ref="playerEl"
        :source-video-url="sourceVideoUrl"
        :video-style="videoStyle"
      />
    </template>

    <div
      class="ctv:flex ctv:items-center ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <button type="button" :class="btnClass(false)"
              :title="$t('videoRotate.rotateLeft')"
              @click="rotateBy(-90)"><i class="pi pi-undo" /> 90°</button>
      <button type="button" :class="btnClass(false)"
              :title="$t('videoRotate.rotateRight')"
              @click="rotateBy(90)"><i class="pi pi-refresh" /> 90°</button>
      <button type="button" :class="btnClass(flipH)"
              :title="$t('videoRotate.flipH')"
              @click="setFlipH(!flipH)"><i class="pi pi-arrows-h" /></button>
      <button type="button" :class="btnClass(flipV)"
              :title="$t('videoRotate.flipV')"
              @click="setFlipV(!flipV)"><i class="pi pi-arrows-v" /></button>
      <span class="ctv:ml-auto ctv:text-[11px] ctv:font-mono ctv:font-bold ctv:text-primary-background">{{ rotateDeg }}°</span>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('videoRotate.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('videoRotate.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('videoRotate.adjustThenRun') }}</span>
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
import { useVideoRotate } from '@/composables/stages/useVideoRotate'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))

const playerEl = ref<InstanceType<typeof VideoPlayerLite> | null>(null)

const {
  rotateDeg, flipH, flipV,
  rotateBy, setFlipH, setFlipV, videoStyle,
} = useVideoRotate(props.node, () => playerEl.value?.boxEl ?? null)

function btnClass(active: boolean) {
  return 'ctv:flex-1 ctv:flex ctv:items-center ctv:justify-center ctv:gap-1 ctv:py-1 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:transition-colors '
    + (active
      ? 'ctv:bg-secondary-background-selected ctv:border-primary-background ctv:text-primary-background'
      : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background')
}
</script>
