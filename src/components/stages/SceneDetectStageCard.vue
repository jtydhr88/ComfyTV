<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <FxSlider
        v-model="threshold"
        :label="$t('fx.threshold')"
        :min="0.05" :max="1" :step="0.01"
        :reset-to="0.4"
      />
      <FxSlider
        v-model="minGap"
        :label="$t('fx.minGap')"
        :min="0" :max="30" :step="0.1"
        unit="s" :reset-to="1.0"
      />
      <div class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('fx.detectHint') }}</div>
    </div>

    <div
      v-if="scenes.length"
      class="ctv:grid ctv:grid-cols-4 ctv:gap-1 ctv:max-h-40 ctv:overflow-y-auto"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <div v-for="(img, i) in scenes" :key="i">
        <img :src="img.image_url" class="ctv:w-full ctv:rounded">
        <div class="ctv:text-2xs ctv:text-center ctv:text-muted-foreground">{{ img.label }}</div>
      </div>
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

const threshold = useNumWidget(props.node, 'threshold', 0.4)
const minGap = useNumWidget(props.node, 'min_gap_s', 1.0)

const scenes = computed<{ image_url: string; label?: string }[]>(() => {
  try {
    const o = JSON.parse(props.state.output || 'null')
    return Array.isArray(o?.images) ? o.images : []
  } catch {
    return []
  }
})
</script>
