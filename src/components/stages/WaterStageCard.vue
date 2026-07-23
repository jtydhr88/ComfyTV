<template>
  <FxCardShell :node="node">
    <template #player>
      <VideoPlayerLite ref="playerRef" :source-video-url="sourceVideoUrl" />
    </template>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxChips v-model="physics" :options="PHYSICS_OPTS" />
      <div class="ctv:flex ctv:gap-3">
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
          <input type="checkbox" v-model="rain" class="ctv:accent-primary-background" />
          Rain
        </label>
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
          <input type="checkbox" v-model="swirl" class="ctv:accent-primary-background" />
          Swirl
        </label>
      </div>
      <FxSlider v-model="amplitude" label="Amplitude" :min="0" :max="1" :step="0.01" :reset-to="0.5" />
      <FxSlider v-if="rain" v-model="rainEvery" label="Rain Rate" :min="1" :max="24" :step="1" :decimals="0" :reset-to="4" />
      <template v-if="swirl">
        <FxSlider v-model="swirlX" label="Swirl X" :min="-0.5" :max="0.5" :step="0.01" :reset-to="0" />
        <FxSlider v-model="swirlY" label="Swirl Y" :min="-0.5" :max="0.5" :step="0.01" :reset-to="0" />
      </template>
      <FxSlider v-model="seed" label="Seed" :min="0" :max="9999" :step="1" :decimals="0" :reset-to="7" />

      <FxClipPreviewPanel :preview="preview" :enabled="!!sourceVideoUrl" />
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('fx.chainMode') }}</span>
    </div>

    <StageCard
      :state="state"
      :node="node"
      hide-run-button
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
    />
  </FxCardShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxCardShell from '@/components/stages/FxCardShell.vue'
import FxClipPreviewPanel from '@/components/stages/FxClipPreviewPanel.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useFxClipPreview } from '@/composables/stages/useFxClipPreview'
import { useBoolWidget, useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const PHYSICS_OPTS = [
  { value: 'water', label: 'Water' },
  { value: 'jelly', label: 'Jelly' },
  { value: 'sludge', label: 'Sludge' },
  { value: 'super_sludge', label: 'Thick' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const physics = useStrWidget(props.node, 'physics', 'water')
const rain = useBoolWidget(props.node, 'rain', true)
const swirl = useBoolWidget(props.node, 'swirl', false)
const rainEvery = useNumWidget(props.node, 'rain_every', 4)
const amplitude = useNumWidget(props.node, 'amplitude', 0.5)
const swirlX = useNumWidget(props.node, 'swirl_x', 0)
const swirlY = useNumWidget(props.node, 'swirl_y', 0)
const seed = useNumWidget(props.node, 'seed', 7)

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)

function playhead(): number {
  const el = playerRef.value?.videoEl ?? null
  if (el && Number.isFinite(el.currentTime)) return el.currentTime
  const d = playerRef.value?.duration ?? 0
  return d > 0 ? d / 2 : 0
}

const preview = useFxClipPreview({
  nodeId: 'ComfyTV.WaterStage',
  getParams: () => ({
    physics: physics.value,
    rain: rain.value,
    swirl: swirl.value,
    rain_every: rainEvery.value,
    amplitude: amplitude.value,
    swirl_x: swirlX.value,
    swirl_y: swirlY.value,
    seed: seed.value,
  }),
  getVideo: () => sourceVideoUrl.value,
  getPlayhead: playhead,
})
</script>
