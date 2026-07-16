<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite
      :source-video-url="sourceVideoUrl"
      :video-style="previewStyle"
    />

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxSlider v-model="exposure" :label="$t('fx.exposure')" :min="-3" :max="3" :step="0.05" :reset-to="0" />
      <FxSlider v-model="black" :label="$t('fx.black')" :min="-0.1" :max="0.1" :step="0.001" :reset-to="0" :decimals="3" />
      <FxSlider v-model="temperature" :label="$t('fx.temperature')" :min="1000" :max="12000" :step="50" :reset-to="6500" :decimals="0" />
      <FxSlider v-model="hue" :label="$t('fx.hue')" :min="-180" :max="180" :step="1" :reset-to="0" :decimals="0" unit="°" />
      <FxSlider v-model="saturation" :label="$t('fx.saturation')" :min="-1" :max="1" :step="0.01" :reset-to="0" />
      <FxSlider v-model="vibrance" :label="$t('fx.vibrance')" :min="-2" :max="2" :step="0.01" :reset-to="0" />
      <FxSlider v-model="blackpoint" label="Black point" :min="-0.5" :max="0.5" :step="0.005" :reset-to="0" />
      <FxSlider v-model="whitepoint" label="White point" :min="0.5" :max="2" :step="0.005" :reset-to="1" />

      <div class="ctv:flex ctv:items-start ctv:justify-around ctv:gap-1 ctv:pt-1">
        <ColorWheel v-model="shadows" :label="$t('fx.shadows')" />
        <ColorWheel v-model="midtones" :label="$t('fx.midtones')" />
        <ColorWheel v-model="highlights" :label="$t('fx.highlights')" />
      </div>
      <div class="ctv:flex ctv:items-center ctv:justify-between ctv:gap-1 ctv:text-2xs">
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-muted-foreground ctv:cursor-pointer">
          <input type="checkbox" v-model="preserveLightness" class="ctv:accent-primary-background" />
          {{ $t('fx.preserveLightness') }}
        </label>
        <button
          type="button"
          class="ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border
                 ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground
                 ctv:hover:border-primary-background"
          @click="resetWheels"
        >{{ $t('fx.resetWheels') }}</button>
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('fx.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('fx.previewNote') }}</span>
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
import ColorWheel from '@/components/widgets/fx/ColorWheel.vue'
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

const exposure = useNumWidget(props.node, 'exposure', 0)
const black = useNumWidget(props.node, 'black', 0)
const temperature = useNumWidget(props.node, 'temperature', 6500)
const hue = useNumWidget(props.node, 'hue', 0)
const saturation = useNumWidget(props.node, 'saturation', 0)
const vibrance = useNumWidget(props.node, 'vibrance', 0)
const blackpoint = useNumWidget(props.node, 'blackpoint', 0)
const whitepoint = useNumWidget(props.node, 'whitepoint', 1)
const preserveLightness = useBoolWidget(props.node, 'preserve_lightness', true)

function wheelModel(zone: 'shadows' | 'midtones' | 'highlights') {
  const r = useNumWidget(props.node, `${zone}_r`, 0)
  const g = useNumWidget(props.node, `${zone}_g`, 0)
  const b = useNumWidget(props.node, `${zone}_b`, 0)
  return computed({
    get: () => ({ r: r.value, g: g.value, b: b.value }),
    set: (v: { r: number; g: number; b: number }) => {
      r.value = v.r
      g.value = v.g
      b.value = v.b
    },
  })
}
const shadows = wheelModel('shadows')
const midtones = wheelModel('midtones')
const highlights = wheelModel('highlights')

function resetWheels() {
  shadows.value = { r: 0, g: 0, b: 0 }
  midtones.value = { r: 0, g: 0, b: 0 }
  highlights.value = { r: 0, g: 0, b: 0 }
}

const previewStyle = computed<Record<string, string>>(() => {
  const parts: string[] = []
  if (exposure.value) parts.push(`brightness(${Math.pow(2, exposure.value).toFixed(3)})`)
  if (saturation.value) parts.push(`saturate(${(1 + saturation.value).toFixed(3)})`)
  if (hue.value) parts.push(`hue-rotate(${hue.value}deg)`)
  if (temperature.value !== 6500) {
    const d = (temperature.value - 6500) / 5500
    if (d < 0) parts.push(`sepia(${Math.min(0.5, -d * 0.4).toFixed(3)})`)
    else parts.push(`hue-rotate(${(-d * 18).toFixed(1)}deg)`)
  }
  const style: Record<string, string> = {}
  if (parts.length) style.filter = parts.join(' ')
  return style
})
</script>
