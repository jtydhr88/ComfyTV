<template>
  <FxCardShell :node="node">
    <template #player>
      <VideoPlayerLite ref="playerRef" :source-video-url="sourceVideoUrl">
        <template #overlay>
          <canvas
            v-show="supported && lutReady"
            ref="previewCanvas"
            class="ctv:absolute ctv:inset-0 ctv:size-full ctv:object-contain ctv:pointer-events-none"
          />
        </template>
      </VideoPlayerLite>
    </template>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <select
        v-if="luts.length"
        v-model="lutFile"
        class="ctv:w-full ctv:py-0.5 ctv:px-1 ctv:text-[11px] ctv:rounded ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground"
      >
        <option v-for="l in luts" :key="l" :value="l">{{ l }}</option>
      </select>
      <div v-else class="ctv:text-2xs ctv:text-center ctv:text-muted-foreground ctv:py-0.5">{{ $t('fx.noLuts') }}</div>

      <div class="ctv:flex ctv:items-center ctv:gap-1">
        <button type="button" :class="btnClass" @click="fileEl?.click()">
          <i class="pi pi-upload" /> {{ $t('fx.upload') }}
        </button>
        <button type="button" :class="btnClass" :title="$t('fx.refresh')" @click="refreshLuts">
          <i class="pi pi-refresh" />
        </button>
        <input
          ref="fileEl"
          type="file"
          accept=".cube,.3dl,.dat,.m3d,.csp"
          class="ctv:hidden"
          @change="onFilePicked"
        />
      </div>

      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.interp') }}</span>
      <FxChips v-model="interp" :options="INTERPS" />
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('fx.done') }}</span>
      <span v-else-if="lutUnsupported" class="ctv:text-muted-foreground">{{ $t('fx.lutPreviewUnavailable') }}</span>
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
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useLutLibrary } from '@/composables/stages/useLutLibrary'
import { useChainedFxPreview } from '@/composables/stages/useChainedFxPreview'
import { ChainLutRenderer } from '@/composables/stages/fxChainPreviewRegistry'
import { isPreviewableLutFile } from '@/composables/stages/videoLutMath'
import { useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const INTERPS = [
  { value: 'tetrahedral', label: 'tetrahedral' },
  { value: 'trilinear', label: 'trilinear' },
  { value: 'nearest', label: 'nearest' },
  { value: 'pyramid', label: 'pyramid' },
  { value: 'prism', label: 'prism' },
]

const btnClass = 'ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background'

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const lutFile = useStrWidget(props.node, 'lut_file', '')
const interp = useStrWidget(props.node, 'interp', 'tetrahedral')

const fileEl = ref<HTMLInputElement | null>(null)

const { luts, lutUrls, refreshLuts, onFilePicked } = useLutLibrary(lutFile)

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)
const previewCanvas = ref<HTMLCanvasElement | null>(null)
const previewVideoEl = computed<HTMLVideoElement | null>(
  () => playerRef.value?.videoEl ?? null,
)

const { supported } = useChainedFxPreview({
  videoEl: previewVideoEl,
  canvasEl: previewCanvas,
  nodeId: String(props.node.id),
  node: props.node,
  params: () => ({
    lutFile: lutFile.value,
    lutUrl: lutUrls.value[lutFile.value] ?? '',
    interp: interp.value,
  }),
  createRenderer: () => new ChainLutRenderer(),
})

const lutReady = computed(() =>
  !!lutFile.value && isPreviewableLutFile(lutFile.value))
const lutUnsupported = computed(() =>
  !!lutFile.value && !isPreviewableLutFile(lutFile.value))
</script>
