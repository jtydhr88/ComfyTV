<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full" @contextmenu.stop.prevent>
    <VideoPlayerLite v-if="!state.output" :source-video-url="sourceVideoUrl" />

    <img
      v-if="state.output"
      :src="state.output"
      class="ctv:w-full ctv:rounded ctv:border ctv:border-border-subtle"
    >

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <FxSlider v-model="cols" label="Columns" :min="1" :max="12" :step="1" :decimals="0" :reset-to="4" />
      <FxSlider v-model="rows" label="Rows" :min="1" :max="12" :step="1" :decimals="0" :reset-to="4" />
      <FxSlider v-model="sheetWidth" label="Sheet Width" :min="320" :max="8192" :step="64" :decimals="0" :reset-to="1920" />
      <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
        <input type="checkbox" v-model="timecode" class="ctv:accent-primary-background" />
        Timecode labels
      </label>
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
import { useBoolWidget, useNumWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const cols = useNumWidget(props.node, 'cols', 4)
const rows = useNumWidget(props.node, 'rows', 4)
const sheetWidth = useNumWidget(props.node, 'sheet_width', 1920)
const timecode = useBoolWidget(props.node, 'timecode', true)
</script>
