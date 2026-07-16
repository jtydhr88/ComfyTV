<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.mode') }}</span>
      <FxChips
        v-model="mode"
        :options="[
          { value: 'waveform', label: $t('afx.waveform') },
          { value: 'spectrum', label: $t('afx.spectrum') },
        ]"
      />

      <template v-if="mode === 'waveform'">
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
          <input type="checkbox" v-model="splitChannels" class="ctv:accent-primary-background" />
          {{ $t('afx.splitChannels') }}
        </label>
      </template>
      <template v-else>
        <div class="ctv:max-h-20 ctv:overflow-y-auto">
          <FxChips v-model="color" :options="colorOptions" />
        </div>
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
          <input type="checkbox" v-model="legend" class="ctv:accent-primary-background" />
          {{ $t('afx.legend') }}
        </label>
      </template>
    </div>

    <img
      v-if="state.output"
      :src="state.output"
      class="ctv:w-full ctv:rounded ctv:border ctv:border-border-subtle"
    >

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('fx.needsAudioOrVideo') }}</span>
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
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useBoolWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceVideoUrl = computed(() =>
  pickSourceImageUrl(props.state.inputs, 'audio') || pickSourceImageUrl(props.state.inputs, 'video'))

const colorOptions = [
  'intensity', 'channel', 'rainbow', 'moreland', 'nebulae', 'fire', 'fiery',
  'fruit', 'cool', 'magma', 'green', 'viridis', 'plasma', 'cividis', 'terrain',
].map(v => ({ value: v, label: v }))

const mode = useStrWidget(props.node, 'mode', 'waveform')
const splitChannels = useBoolWidget(props.node, 'split_channels', false)
const color = useStrWidget(props.node, 'color', 'intensity')
const legend = useBoolWidget(props.node, 'legend', true)
</script>
