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

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceImageUrl" class="ctv:text-muted-foreground">{{ $t('imageCrop.noInputImage') }}</span>
      <span v-else-if="computing" class="ctv:text-muted-foreground">{{ $t('rotate.applying') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('rotate.applied') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('rotate.adjustToApply') }}</span>
    </div>

    <div class="ctv:flex ctv:flex-col ctv:gap-1">
      <div class="ctv:grid ctv:grid-cols-[64px_1fr_48px] ctv:items-center ctv:gap-1.5 ctv:text-xs">
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wider ctv:text-muted-foreground">{{ $t('rotate.angle') }}</span>
        <input
          type="range"
          class="ctv:w-full"
          min="-180" max="180" step="1"
          :value="angle"
          @input="(e) => angle = Number((e.target as HTMLInputElement).value)"
        />
        <span class="ctv:text-right ctv:text-base-foreground ctv:font-mono">{{ angle }}°</span>
      </div>
      <div class="ctv:grid ctv:grid-cols-4 ctv:gap-1.5 ctv:text-xs">
        <button
          v-for="q in [{ d: -90, l: '⟲ 90°' }, { d: 0, l: '0°' }, { d: 180, l: '180°' }, { d: 90, l: '⟳ 90°' }]"
          :key="q.l"
          type="button"
          class="ctv:py-1 ctv:px-1.5 ctv:rounded ctv:text-xs ctv:cursor-pointer
                 ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground ctv:hover:bg-secondary-background-hover"
          @click="snap(q.d)"
        >{{ q.l }}</button>
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
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import { rotatePreviewStyle, rotateToCanvas } from '@/composables/stages/imageOrientPreview'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useTransformPipeline } from '@/composables/widgets/useTransformPipeline'
import { useNumWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceImageUrl = computed(() => pickSourceImageUrl(props.state.inputs))

const angle = useNumWidget(props.node, 'angle', 0)

function snap(deg: number) { angle.value = deg }

const previewStyle = computed(() => rotatePreviewStyle(angle.value))

const { computing, requestRecompute } = useTransformPipeline({
  sourceImageUrl,
  state: props.state,
  nodeId: props.node?.id ?? 'unknown',
  filenamePrefix: 'comfytv-rotate',
  subfolder: 'transformer',
  compute: (img) => rotateToCanvas(img, angle.value),
})

watch(angle, () => requestRecompute())

watch(sourceImageUrl, (url) => {
  if (url) requestRecompute()
}, { immediate: true })
</script>
