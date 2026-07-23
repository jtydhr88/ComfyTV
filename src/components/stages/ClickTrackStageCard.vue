<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full" @contextmenu.stop.prevent>
    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <template v-if="!hasLabels">
        <FxSlider v-model="bpm" label="BPM" :min="20" :max="400" :step="0.5" :reset-to="120" />
        <FxSlider v-model="beatsPerBar" :label="$t('music.beatsPerBar')" :min="1" :max="12" :step="1" :decimals="0" :reset-to="4" />
        <FxSlider v-model="bars" :label="$t('music.bars')" :min="1" :max="256" :step="1" :decimals="0" :reset-to="8" />
      </template>
      <div v-else class="ctv:text-2xs ctv:text-success-background">
        {{ $t('music.clickFromLabels') }}
      </div>
      <div class="ctv:text-2xs ctv:text-muted-foreground ctv:leading-snug">
        {{ $t('music.clickHint') }}
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
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

const hasLabels = computed(() => !!pickSourceImageUrl(props.state.inputs, 'labels'))
const bpm = useNumWidget(props.node, 'bpm', 120)
const beatsPerBar = useNumWidget(props.node, 'beats_per_bar', 4)
const bars = useNumWidget(props.node, 'bars', 8)
</script>
