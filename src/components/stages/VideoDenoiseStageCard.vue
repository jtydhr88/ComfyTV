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
      <FxChips v-model="method" :options="METHODS" />
      <FxSlider v-model="strength" :label="$t('fx.strength')" :min="0" :max="1" :step="0.01" :reset-to="0.3" />

      <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-2xs">
        <button
          type="button"
          class="ctv:flex ctv:items-center ctv:gap-1 ctv:px-2 ctv:h-6 ctv:rounded ctv:cursor-pointer
                 ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground
                 ctv:hover:border-primary-background ctv:disabled:opacity-40 ctv:disabled:cursor-default"
          :disabled="!sourceVideoUrl || preview.state.loading"
          @click="preview.request()"
        >
          <i :class="['pi', preview.state.loading ? 'pi-spinner pi-spin' : 'pi-eye']" />
          {{ $t('fxPreview.run') }}
        </button>
        <span v-if="preview.state.error" class="ctv:text-destructive-background ctv:truncate">
          {{ $t('fxPreview.failed') }}
        </span>
        <span v-else-if="preview.state.stale" class="ctv:text-warning-background">
          {{ $t('fxPreview.stale') }}
        </span>
        <span v-else-if="preview.state.url" class="ctv:text-muted-foreground">
          {{ $t('fxPreview.window', { s: previewWindowLabel }) }}
        </span>
      </div>

      <div v-if="preview.state.url" class="ctv:h-40 ctv:flex ctv:flex-col">
        <VideoPlayerLite :source-video-url="preview.state.url" />
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('fx.done') }}</span>
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
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useFxClipPreview } from '@/composables/stages/useFxClipPreview'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const METHODS = [
  { value: 'atadenoise', label: 'atadenoise' },
  { value: 'nlmeans', label: 'nlmeans', title: 'slow' },
  { value: 'fftdnoiz', label: 'fftdnoiz' },
  { value: 'deband', label: 'deband' },
  { value: 'gradfun', label: 'gradfun' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const method = useStrWidget(props.node, 'method', 'atadenoise')
const strength = useNumWidget(props.node, 'strength', 0.3)

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)

function playhead(): number {
  const player = playerRef.value
  const el = player?.videoEl ?? null
  if (el && Number.isFinite(el.currentTime)) return el.currentTime
  const d = player?.duration ?? 0
  return d > 0 ? d / 2 : 0
}

const preview = useFxClipPreview({
  nodeId: 'ComfyTV.VideoDenoiseStage',
  getParams: () => ({ method: method.value, strength: strength.value }),
  getVideo: () => sourceVideoUrl.value,
  getPlayhead: playhead,
})

const previewWindowLabel = computed(() =>
  (preview.state.t1 - preview.state.t0).toFixed(1))
</script>
