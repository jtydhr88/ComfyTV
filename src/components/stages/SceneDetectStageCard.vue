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
      <FxChips
        v-model="outputMode"
        :options="[
          { value: 'frames', label: $t('fx.sceneFrames') },
          { value: 'clips', label: $t('fx.sceneClips') },
        ]"
      />
      <FxChips
        v-if="outputMode === 'clips'"
        v-model="cutMode"
        :options="[
          { value: 'fast', label: $t('fx.cutFast') },
          { value: 'precise', label: $t('fx.cutPrecise') },
        ]"
      />
      <div class="ctv:text-2xs ctv:text-muted-foreground">{{ outputMode === 'clips' ? $t('fx.sceneClipsHint') : $t('fx.detectHint') }}</div>
    </div>

    <div
      v-if="scenes.length"
      class="ctv-scroll-thin ctv:grid ctv:grid-cols-4 ctv:gap-1 ctv:max-h-40 ctv:overflow-y-auto"
      @pointerdown.stop @pointermove.stop @pointerup.stop @wheel.stop
    >
      <div v-for="(img, i) in scenes" :key="i">
        <img :src="img.image_url" class="ctv:w-full ctv:rounded">
        <div class="ctv:text-2xs ctv:text-center ctv:text-muted-foreground">{{ img.label }}</div>
      </div>
    </div>

    <div
      v-if="clipsPool"
      class="ctv:flex ctv:flex-col ctv:gap-1 ctv:flex-1 ctv:min-h-[140px]"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <span class="ctv:shrink-0 ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:opacity-60">{{ $t('fx.sceneClips') }}</span>
      <div class="ctv-scroll-thin ctv:flex-1 ctv:min-h-0 ctv:overflow-y-auto" @wheel.stop>
        <ValuePreview
          type="COMFYTV_VIDEOS"
          :content="clipsPool"
          :empty-label="$t('stage.empty.no_output')"
          :selected-index="state.pickedIndex"
          click-mode="pick"
          @item-click="onClipPick"
        />
      </div>
      <div class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('fx.sceneClipPickHint') }}</div>
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
      :hide-output="Boolean(clipsPool)"
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
import ValuePreview from '@/components/stages/ValuePreview.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'
import type { ImagePickContext } from '@/stores/stageStore'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string, context?: ImagePickContext) => void
  node: LGraphNode
}>()

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))

const threshold = useNumWidget(props.node, 'threshold', 0.4)
const minGap = useNumWidget(props.node, 'min_gap_s', 1.0)
const outputMode = useStrWidget(props.node, 'output', 'frames')
const cutMode = useStrWidget(props.node, 'cut_mode', 'fast')

function onClipPick(payload: ImagePickContext) {
  props.onAction('pick-item', payload)
}

const scenes = computed<{ image_url: string; label?: string }[]>(() => {
  try {
    const o = JSON.parse(props.state.output || 'null')
    return Array.isArray(o?.images) ? o.images : []
  } catch {
    return []
  }
})

const clipsPool = computed<string | null>(() => {
  try {
    const o = JSON.parse(props.state.output || 'null')
    return Array.isArray(o?.clips) && o.clips.length
      ? JSON.stringify({ images: o.clips })
      : null
  } catch {
    return null
  }
})
</script>
