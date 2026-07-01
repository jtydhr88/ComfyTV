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
import { computed, ref, watch } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useTransformPipeline } from '@/composables/widgets/useTransformPipeline'
import { bindWidgetCallback, getWidget, onNodeConfigure, writeWidget } from '@/utils/widget'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceImageUrl = computed(() => pickSourceImageUrl(props.state.inputs))

function widgetValueBool(name: string, fallback = false): boolean {
  const w = getWidget(props.node, name)
  return w ? Boolean(w.value) : fallback
}

const flipH = ref<boolean>(widgetValueBool('flip_horizontal', false))
const flipV = ref<boolean>(widgetValueBool('flip_vertical', false))

bindWidgetCallback(props.node, 'flip_horizontal', (v) => {
  const b = Boolean(v)
  if (b !== flipH.value) flipH.value = b
})
bindWidgetCallback(props.node, 'flip_vertical', (v) => {
  const b = Boolean(v)
  if (b !== flipV.value) flipV.value = b
})

onNodeConfigure(props.node, () => {
  const h = widgetValueBool('flip_horizontal', flipH.value)
  const v = widgetValueBool('flip_vertical', flipV.value)
  if (h !== flipH.value) flipH.value = h
  if (v !== flipV.value) flipV.value = v
})

const previewStyle = computed(() => ({
  transform: `scale(${flipH.value ? -1 : 1}, ${flipV.value ? -1 : 1})`,
  transition: 'transform 80ms linear',
}))

const { computing, requestRecompute } = useTransformPipeline({
  sourceImageUrl,
  state: props.state,
  nodeId: props.node?.id ?? 'unknown',
  filenamePrefix: 'comfytv-mirror',
  subfolder: 'transformer',
  compute: (img) => mirrorCanvas(img, flipH.value, flipV.value),
})

watch([flipH, flipV], ([h, v]) => {
  writeWidget(props.node, 'flip_horizontal', h)
  writeWidget(props.node, 'flip_vertical', v)
  requestRecompute()
})

watch(sourceImageUrl, (url) => {
  if (url) requestRecompute()
}, { immediate: true })


function mirrorCanvas(img: HTMLImageElement, horizontal: boolean, vertical: boolean): HTMLCanvasElement {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  ctx.translate(horizontal ? w : 0, vertical ? h : 0)
  ctx.scale(horizontal ? -1 : 1, vertical ? -1 : 1)
  ctx.drawImage(img, 0, 0)
  return canvas
}
</script>
