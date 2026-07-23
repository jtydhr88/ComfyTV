<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full" @contextmenu.stop.prevent>
    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <textarea
        v-model="progression"
        rows="2"
        spellcheck="false"
        class="ctv:w-full ctv:resize-y ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:px-1.5 ctv:py-1 ctv:font-mono ctv:text-2xs ctv:text-base-foreground ctv:outline-none ctv:focus:border-primary-background"
        placeholder="Am7 Dm7 | G7 | Cmaj7"
        :disabled="hasTextInput"
        @keydown.stop
      />
      <FxChips v-model="pattern" :options="PATTERN_OPTS" />
      <FxChips v-model="voicing" :options="VOICING_OPTS" />
      <FxSlider v-model="bpm" label="BPM" :min="20" :max="300" :step="0.5" :reset-to="100" />
      <FxSlider v-model="beatsPerBar" :label="$t('music.beatsPerBar')" :min="1" :max="12" :step="1" :decimals="0" :reset-to="4" />
      <FxSlider v-model="octaveShift" :label="$t('music.octave')" :min="-2" :max="2" :step="1" :decimals="0" :reset-to="0" />
      <FxSlider v-model="velocity" :label="$t('music.velocity')" :min="20" :max="127" :step="1" :decimals="0" :reset-to="88" />
      <FxSlider v-model="repeats" :label="$t('music.repeats')" :min="1" :max="16" :step="1" :decimals="0" :reset-to="1" />
      <a
        v-if="midiUrl"
        :href="midiUrl"
        download="accompaniment.mid"
        class="ctv:text-2xs ctv:text-primary-background ctv:underline"
      >{{ $t('music.downloadMidi') }}</a>
      <div class="ctv:text-2xs ctv:text-muted-foreground ctv:leading-snug">
        {{ $t('music.chordHint') }}
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

const PATTERN_OPTS = ['block', 'pad', 'broken', 'alberti', 'strum']
  .map(v => ({ value: v, label: v }))
const VOICING_OPTS = ['close', 'drop_2', 'three_note', 'four_note',
  'root_only'].map(v => ({ value: v, label: v.replace(/_/g, ' ') }))

const hasTextInput = computed(() =>
  !!pickSourceImageUrl(props.state.inputs, 'progression_text'))
const progression = useStrWidget(props.node, 'progression',
  'Am7 | Dm7 | G7 | Cmaj7')
const pattern = useStrWidget(props.node, 'pattern', 'block')
const voicing = useStrWidget(props.node, 'voicing', 'close')
const bpm = useNumWidget(props.node, 'bpm', 100)
const beatsPerBar = useNumWidget(props.node, 'beats_per_bar', 4)
const octaveShift = useNumWidget(props.node, 'octave_shift', 0)
const velocity = useNumWidget(props.node, 'velocity', 88)
const repeats = useNumWidget(props.node, 'repeats', 1)

const midiUrl = computed(() => {
  const raw = props.state.outputs?.[1]
  return typeof raw === 'string' && raw.startsWith('/view') ? raw : ''
})
</script>
