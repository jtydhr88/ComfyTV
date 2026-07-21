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
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxCardShell from '@/components/stages/FxCardShell.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
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
</script>
