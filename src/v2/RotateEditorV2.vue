<template>
  <div class="v2-ed" @pointerdown.stop>
    <div class="v2-ed__canvas">
      <div class="v2-ed__fit">
        <img
          v-if="sourceImageUrl"
          :src="sourceImageUrl"
          :style="previewStyle"
          draggable="false"
          @dragstart.prevent
        />
      </div>
      <div v-if="!sourceImageUrl" class="v2-ed__empty">{{ $t('imageCrop.noInputImage') }}</div>
    </div>

    <div class="v2-ed__panel">
      <div class="v2-ed__row">
        <span class="v2-ed__label">{{ $t('rotate.angle') }}</span>
        <input
          type="range"
          class="v2-ed__range"
          min="-180" max="180" step="1"
          :value="angle"
          @input="angle = Number(($event.target as HTMLInputElement).value)"
        />
        <span class="v2-ed__value">{{ angle }}°</span>
      </div>
      <div class="v2-ed__chips">
        <button
          v-for="q in SNAPS"
          :key="q.l"
          type="button"
          class="v2-ed__chip"
          :data-on="angle === q.d ? '1' : ''"
          @click="angle = q.d"
        >{{ q.l }}</button>
      </div>
    </div>

    <div class="v2-ed__status">
      <span class="v2-ed__spacer" />
      <span v-if="!sourceImageUrl">{{ $t('imageCrop.noInputImage') }}</span>
      <span v-else-if="computing" class="v2-ed__busy">{{ $t('v2.applying') }}</span>
      <span v-else-if="state.output" class="v2-ed__ok">{{ $t('v2.appliedLive') }}</span>
      <span v-else>{{ $t('rotate.adjustToApply') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'

import { rotatePreviewStyle, rotateToCanvas } from '@/composables/stages/imageOrientPreview'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useTransformPipeline } from '@/composables/widgets/useTransformPipeline'
import { useNumWidget } from '@/composables/widgets/useWidgetModel'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'

const SNAPS = [
  { d: -90, l: '⟲ 90°' },
  { d: 0, l: '0°' },
  { d: 180, l: '180°' },
  { d: 90, l: '⟳ 90°' },
] as const

const props = defineProps<{
  node: LGraphNode
  state: StageState
}>()

const sourceImageUrl = computed(() => pickSourceImageUrl(props.state.inputs))
const angle = useNumWidget(props.node, 'angle', 0)
const previewStyle = computed(() => rotatePreviewStyle(angle.value))

const { computing, requestRecompute } = useTransformPipeline({
  sourceImageUrl,
  state: props.state,
  nodeId: props.node?.id ?? 'unknown',
  filenamePrefix: 'comfytv-rotate',
  subfolder: 'comfytv/transformer',
  compute: (img) => rotateToCanvas(img, angle.value),
})

watch(angle, () => requestRecompute())
watch(sourceImageUrl, (url) => {
  if (url) requestRecompute()
}, { immediate: true })
</script>
