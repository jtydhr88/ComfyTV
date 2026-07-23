<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full" @contextmenu.stop.prevent>
    <VideoPlayerLite v-if="!live" ref="playerRef" :source-video-url="sourceVideoUrl" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.scope') }}</span>
      <FxChips
        v-model="scope"
        :options="[
          { value: 'waveform', label: 'Waveform' },
          { value: 'waveform_parade', label: 'Parade' },
          { value: 'vectorscope', label: 'Vector' },
          { value: 'histogram', label: 'Histogram' },
          { value: 'cie', label: 'CIE' },
        ]"
      />

      <template v-if="!live">
        <FxSlider
          v-model="atSeconds"
          :label="$t('fx.atSeconds')"
          :min="-1" :max="atMax" :step="0.1"
          :reset-to="-1"
        />
        <div class="ctv:text-2xs ctv:text-muted-foreground">-1 = {{ $t('fx.middle') }}</div>
      </template>
    </div>

    <canvas
      v-if="live"
      ref="scopeCanvas"
      width="512"
      height="256"
      class="ctv:w-full ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-black"
    />
    <div v-if="live" class="ctv:text-2xs ctv:text-center ctv:tracking-wide">
      <span class="ctv:text-success-background">{{ $t('scopes.liveSampling') }}</span>
    </div>

    <img
      v-if="!live && state.output"
      :src="state.output"
      class="ctv:w-full ctv:rounded ctv:border ctv:border-border-subtle"
    >

    <div v-if="!live" class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('fx.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('fx.adjustThenRun') }}</span>
    </div>

    <StageCard
      :state="state"
      :node="node"
      :hide-run="live"
      :hide-output="live"
      :hide-actions="live"
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
import { useLiveScope } from '@/composables/stages/useLiveScope'
import type { ScopeKind } from '@/composables/stages/scopeMath'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))

const scope = useStrWidget(props.node, 'scope', 'waveform')
const atSeconds = useNumWidget(props.node, 'at_seconds', -1)

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)
const atMax = computed(() => {
  const d = playerRef.value?.duration ?? 0
  return d > 0 ? Math.max(0.1, Math.round(d * 10) / 10) : 3600
})

const scopeCanvas = ref<HTMLCanvasElement | null>(null)
const { live } = useLiveScope({
  node: props.node,
  scope: () => (scope.value || 'waveform') as ScopeKind,
  canvasEl: scopeCanvas,
  deps: () => props.state.inputs,
})
</script>
