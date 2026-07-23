<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceUrl" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <div class="ctv:text-2xs ctv:text-muted-foreground ctv:leading-snug">
        {{ $t('afx.stemSplitHint') }}
      </div>
      <div class="ctv:flex ctv:flex-wrap ctv:gap-1">
        <span
          v-for="stem in STEMS" :key="stem"
          class="ctv:px-1.5 ctv:py-0.5 ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:text-2xs ctv:text-muted-foreground"
        >{{ stem }}</span>
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceUrl" class="ctv:text-muted-foreground">{{ $t('fx.needsAudioOrVideo') }}</span>
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
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const STEMS = ['vocals', 'accompaniment', 'drums', 'bass', 'other']

const sourceUrl = computed(() =>
  pickSourceImageUrl(props.state.inputs, 'audio') || pickSourceImageUrl(props.state.inputs, 'video'))
</script>
