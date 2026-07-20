<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div class="ctv:relative ctv:w-full ctv:h-[280px] ctv:rounded-md ctv:overflow-hidden ctv:border ctv:border-border-subtle
                ctv:bg-black ctv:flex ctv:items-center ctv:justify-center">
      <div v-if="!sourceImageUrl" class="ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:text-white/50">
        <i class="pi pi-image ctv:text-[32px] ctv:opacity-60" />
        <div class="ctv:text-xs">{{ $t('imageCrop.noInputImage') }}</div>
      </div>
      <img
        v-else
        :src="sourceImageUrl"
        class="ctv:max-w-full ctv:max-h-full ctv:object-contain ctv:select-none ctv:pointer-events-none"
        :style="previewStyle"
        draggable="false"
        @dragstart.prevent
      />
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5">
      <span v-if="!sourceImageUrl" class="ctv:text-muted-foreground">{{ $t('imageCrop.noInputImage') }}</span>
      <span v-else-if="computing" class="ctv:text-muted-foreground">{{ $t('mirror.applying') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('mirror.applied') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('mirror.adjustToApply') }}</span>
    </div>

    <div class="ctv:flex ctv:gap-1.5">
      <button
        type="button"
        class="ctv:flex-1 ctv:flex ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:py-1.5 ctv:px-2.5 ctv:rounded
               ctv:text-xs ctv:border ctv:cursor-pointer"
        :class="flipH
          ? 'ctv:bg-secondary-background-selected ctv:border-primary-background ctv:text-primary-background ctv:font-semibold'
          : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:bg-secondary-background-hover'"
        :title="$t('mirror.horizontal')"
        @click="flipH = !flipH"
      >
        <i class="pi pi-arrow-right-arrow-left ctv:text-sm ctv:leading-none" /> {{ $t('mirror.horizontal') }}
      </button>
      <button
        type="button"
        class="ctv:flex-1 ctv:flex ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:py-1.5 ctv:px-2.5 ctv:rounded
               ctv:text-xs ctv:border ctv:cursor-pointer"
        :class="flipV
          ? 'ctv:bg-secondary-background-selected ctv:border-primary-background ctv:text-primary-background ctv:font-semibold'
          : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:bg-secondary-background-hover'"
        :title="$t('mirror.vertical')"
        @click="flipV = !flipV"
      >
        <i class="pi pi-arrows-v ctv:text-sm ctv:leading-none" /> {{ $t('mirror.vertical') }}
      </button>
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
import { computed, watch } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import { mirrorPreviewStyle, mirrorToCanvas } from '@/composables/stages/imageOrientPreview'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useTransformPipeline } from '@/composables/widgets/useTransformPipeline'
import { useBoolWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceImageUrl = computed(() => pickSourceImageUrl(props.state.inputs))

const flipH = useBoolWidget(props.node, 'flip_horizontal', false)
const flipV = useBoolWidget(props.node, 'flip_vertical', false)

const previewStyle = computed(() => mirrorPreviewStyle(flipH.value, flipV.value))

const { computing, requestRecompute } = useTransformPipeline({
  sourceImageUrl,
  state: props.state,
  nodeId: props.node?.id ?? 'unknown',
  filenamePrefix: 'comfytv-mirror',
  subfolder: 'comfytv/transformer',
  compute: (img) => mirrorToCanvas(img, flipH.value, flipV.value),
})

watch([flipH, flipV], () => requestRecompute())

watch(sourceImageUrl, (url) => {
  if (url) requestRecompute()
}, { immediate: true })
</script>
