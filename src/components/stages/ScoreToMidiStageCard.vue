<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full" @contextmenu.stop.prevent>
    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <FxSlider v-model="swingRatio" :label="$t('music.swing')" :min="50" :max="75" :step="1" :decimals="0" :reset-to="50" />
      <FxChips v-if="swingRatio > 50" v-model="swingUnit" :options="SWING_OPTS" />
      <FxSlider v-model="humanize" :label="$t('music.humanize')" :min="0" :max="1" :step="0.01" :reset-to="0" />
      <FxChips v-model="profile" :options="PROFILE_OPTS" />
      <FxChips v-model="easing" :options="EASING_OPTS" />
      <FxSlider v-model="seed" label="Seed" :min="0" :max="9999" :step="1" :decimals="0" :reset-to="7" />
      <a
        v-if="midiUrl"
        :href="midiUrl"
        download="performance.mid"
        class="ctv:text-2xs ctv:text-primary-background ctv:underline"
      >{{ $t('music.downloadMidi') }}</a>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!hasScore" class="ctv:text-muted-foreground">{{ $t('music.needsScore') }}</span>
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
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const SWING_OPTS = [
  { value: 'eighth', label: '8th' },
  { value: 'sixteenth', label: '16th' },
]
const EASING_OPTS = ['normal', 'ease_in', 'ease_out', 'ease_in_out',
  'exponential'].map(v => ({ value: v, label: v.replace(/_/g, ' ') }))
const PROFILE_OPTS = ['keyboard', 'strings', 'winds', 'voice']
  .map(v => ({ value: v, label: v }))

const hasScore = computed(() => !!pickSourceImageUrl(props.state.inputs, 'score'))
const swingRatio = useNumWidget(props.node, 'swing_ratio', 50)
const swingUnit = useStrWidget(props.node, 'swing_unit', 'eighth')
const humanize = useNumWidget(props.node, 'humanize', 0)
const easing = useStrWidget(props.node, 'easing', 'normal')
const profile = useStrWidget(props.node, 'profile', 'keyboard')
const seed = useNumWidget(props.node, 'seed', 7)

const midiUrl = computed(() => {
  const raw = props.state.outputs?.[1]
  return typeof raw === 'string' && raw.startsWith('/view') ? raw : ''
})
</script>
