<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <FxChips
        v-model="previewSide"
        :options="[
          { value: 'src', label: $t('afx.sourceLbl') },
          { value: 'ir', label: 'IR' },
        ]"
      />
    </div>

    <VideoPlayerLite :source-video-url="previewSide === 'src' ? srcUrl : irUrl" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <FxSlider v-model="wet" :label="$t('afx.wet')" :min="0" :max="2" :step="0.01" :reset-to="1" />
      <FxSlider v-model="dry" :label="$t('afx.dryLbl')" :min="0" :max="2" :step="0.01" :reset-to="0" />
      <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
        <input type="checkbox" v-model="normalize" class="ctv:accent-primary-background" />
        {{ $t('afx.normalizePeak') }}
      </label>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!srcUrl || !irUrl" class="ctv:text-muted-foreground">{{ $t('afx.needsSrcAndIr') }}</span>
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
import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
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

const previewSide = ref('src')

const srcUrl = computed(() =>
  pickSourceImageUrl(props.state.inputs, 'audio') || pickSourceImageUrl(props.state.inputs, 'video'))
const irUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'ir'))

const wet = useNumWidget(props.node, 'wet', 1)
const dry = useNumWidget(props.node, 'dry', 0)
const normalize = useBoolWidget(props.node, 'normalize', true)
</script>
