<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <FxChips
        v-model="previewSide"
        :options="[
          { value: 'A', label: 'A' },
          { value: 'B', label: 'B' },
        ]"
      />
    </div>

    <VideoPlayerLite :source-video-url="previewSide === 'A' ? srcA : srcB" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.transition') }}</span>
      <div class="ctv:max-h-28 ctv:overflow-y-auto">
        <FxChips v-model="transition" :options="transitionOptions" />
      </div>

      <FxSlider
        v-model="duration"
        :label="$t('fx.duration')"
        :min="0.1" :max="5" :step="0.05"
        unit="s" :reset-to="1.0"
      />
      <FxSlider
        v-model="offset"
        :label="$t('fx.offset')"
        :min="0" :max="3600" :step="0.1"
        unit="s" :reset-to="0"
      />
      <div class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('fx.offsetAuto') }}</div>

      <template v-if="lumaWired">
        <div class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">Luma wipe</div>
        <FxSlider v-model="lumaSoftness" label="Softness" :min="0" :max="1" :step="0.01" :reset-to="0.1" />
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
          <input type="checkbox" v-model="lumaInvert" class="ctv:accent-primary-background" />
          Invert
        </label>
      </template>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!srcA || !srcB" class="ctv:text-muted-foreground">{{ $t('fx.needsTwoInputs') }}</span>
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
import { useBoolWidget, useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const srcA = computed(() => pickSourceImageUrl(props.state.inputs, 'video_a'))
const srcB = computed(() => pickSourceImageUrl(props.state.inputs, 'video_b'))

const previewSide = ref<'A' | 'B'>('A')

const TRANSITIONS = [
  'fade', 'dissolve', 'fadeblack', 'fadewhite', 'fadegrays', 'fadefast', 'fadeslow',
  'wipeleft', 'wiperight', 'wipeup', 'wipedown', 'wipetl', 'wipetr', 'wipebl', 'wipebr',
  'slideleft', 'slideright', 'slideup', 'slidedown',
  'smoothleft', 'smoothright', 'smoothup', 'smoothdown',
  'circlecrop', 'rectcrop', 'circleopen', 'circleclose',
  'vertopen', 'vertclose', 'horzopen', 'horzclose',
  'diagtl', 'diagtr', 'diagbl', 'diagbr',
  'hlslice', 'hrslice', 'vuslice', 'vdslice',
  'hlwind', 'hrwind', 'vuwind', 'vdwind',
  'coverleft', 'coverright', 'coverup', 'coverdown',
  'revealleft', 'revealright', 'revealup', 'revealdown',
  'squeezeh', 'squeezev', 'zoomin', 'distance', 'pixelize', 'radial', 'hblur',
]
const transitionOptions = TRANSITIONS.map((v) => ({ value: v, label: v }))

const transition = useStrWidget(props.node, 'transition', 'fade')
const duration = useNumWidget(props.node, 'duration', 1.0)
const offset = useNumWidget(props.node, 'offset', 0)
const lumaWired = computed(() => Boolean(pickSourceImageUrl(props.state.inputs, 'luma_image')))
const lumaSoftness = useNumWidget(props.node, 'luma_softness', 0.1)
const lumaInvert = useBoolWidget(props.node, 'luma_invert', false)
</script>
