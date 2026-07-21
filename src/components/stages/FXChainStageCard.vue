<template>
  <FxCardShell :node="node">
    <template #player>
      <VideoPlayerLite ref="playerRef" :source-video-url="sourceVideoUrl">
        <template #overlay>
          <canvas
            v-show="supported"
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
      <div :class="sectionLabel">{{ $t('fxChain.title') }}</div>

      <div
        v-if="rows.length === 0"
        class="ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:h-24
               ctv:rounded-md ctv:bg-black/40 ctv:border ctv:border-dashed ctv:border-border-subtle ctv:text-white/50"
      >
        <i class="pi pi-bolt ctv:text-[24px] ctv:opacity-60" />
        <div class="ctv:text-xs ctv:text-center ctv:px-2">{{ $t('fxChain.empty') }}</div>
      </div>

      <div v-else class="ctv:flex ctv:flex-col ctv:gap-1">
        <div
          v-for="row in rows"
          :key="row.ordinal"
          class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:p-1 ctv:rounded-md
                 ctv:bg-black/40 ctv:border ctv:border-border-subtle"
        >
          <span class="ctv:shrink-0 ctv:w-4 ctv:text-center ctv:text-2xs ctv:font-bold ctv:font-mono ctv:text-[#b8c4ff]">
            {{ row.ordinal }}
          </span>

          <span
            class="ctv:flex-1 ctv:min-w-0 ctv:truncate ctv:text-[11px] ctv:font-semibold ctv:text-base-foreground"
            :title="row.kind"
          >
            {{ row.label }}
          </span>

          <span
            v-if="!row.preview"
            class="ctv:shrink-0 ctv:py-px ctv:px-1.5 ctv:text-3xs ctv:tracking-wide ctv:rounded-sm
                   ctv:bg-base-foreground/10 ctv:text-muted-foreground"
          >
            {{ $t('fxChain.noPreview') }}
          </span>
        </div>
      </div>

      <div
        v-if="rows.length > 1"
        class="ctv:text-3xs ctv:text-center ctv:text-muted-foreground ctv:tracking-wide ctv:truncate"
        :title="summary"
      >
        {{ summary }}
      </div>

      <div :class="sectionLabel">{{ $t('fxChain.delivery') }}</div>
      <div :class="rowLabel">{{ $t('fxChain.dSize') }}</div>
      <FxChips v-model="outSize" :options="SIZES" />
      <div :class="rowLabel">{{ $t('fxChain.dFps') }}</div>
      <FxChips v-model="outFps" :options="FPS_OPTS" />
      <div :class="rowLabel">{{ $t('fxChain.dCodec') }}</div>
      <FxChips v-model="outCodec" :options="CODECS" />
      <div :class="rowLabel">{{ $t('fxChain.dQuality') }}</div>
      <FxChips v-model="outQuality" :options="QUALITIES" />
      <div :class="rowLabel">{{ $t('fxChain.dColorspace') }}</div>
      <FxChips v-model="outColorspace" :options="CS_TARGETS" />
    </div>

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
    />
  </FxCardShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxCardShell from '@/components/stages/FxCardShell.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useStrWidget } from '@/composables/widgets/useWidgetModel'
import { useChainedFxPreview } from '@/composables/stages/useChainedFxPreview'
import { ChainBlitRenderer } from '@/composables/stages/fxChainPreviewRegistry'
import { useFxChain } from '@/composables/stages/useFxChain'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const { rows, summary } = useFxChain(props.node, () => props.state)

const { t } = useI18n()
const src = () => ({ value: 'source', label: t('fxChain.sourceOpt') })
const CS_TARGETS = ['bt709', 'bt601-6-625', 'bt2020', 'smpte170m']
  .map(v => ({ value: v, label: v }))
const SIZES = computed(() => [src(),
  ...['2160', '1440', '1080', '720', '540', '480']
    .map(v => ({ value: v, label: `${v}p` }))])
const FPS_OPTS = computed(() => [src(),
  ...['24', '25', '30', '50', '60'].map(v => ({ value: v, label: v }))])
const CODECS = [
  { value: 'h264', label: 'H.264' },
  { value: 'hevc', label: 'HEVC' },
  { value: 'prores', label: 'ProRes' },
]
const QUALITIES = computed(() => [
  { value: 'draft', label: t('fxChain.qDraft') },
  { value: 'standard', label: t('fxChain.qStandard') },
  { value: 'high', label: t('fxChain.qHigh') },
])
const outColorspace = useStrWidget(props.node, 'out_colorspace', 'bt709')
const outSize = useStrWidget(props.node, 'out_size', 'source')
const outFps = useStrWidget(props.node, 'out_fps', 'source')
const outCodec = useStrWidget(props.node, 'out_codec', 'h264')
const outQuality = useStrWidget(props.node, 'out_quality', 'standard')

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)
const videoEl = computed<HTMLVideoElement | null>(() => playerRef.value?.videoEl ?? null)
const previewCanvas = ref<HTMLCanvasElement | null>(null)

const { supported } = useChainedFxPreview({
  videoEl,
  canvasEl: previewCanvas,
  nodeId: String(props.node.id),
  node: props.node,
  params: () => ({}),
  createRenderer: () => new ChainBlitRenderer(),
})

const sectionLabel = 'ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:opacity-60'
const rowLabel = 'ctv:text-3xs ctv:tracking-wide ctv:opacity-50'
</script>
