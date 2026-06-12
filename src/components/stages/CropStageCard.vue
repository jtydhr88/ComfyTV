<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <CropCanvas
      :source-image-url="sourceImageUrl"
      :bounds="bounds"
      @update:bounds="onBoundsUpdate"
    />

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceImageUrl" class="ctv:text-muted-foreground">{{ $t('imageCrop.noInputImage') }}</span>
      <span v-else-if="computing" class="ctv:text-muted-foreground">{{ $t('imageCrop.applying') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('imageCrop.applied') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('imageCrop.adjustToApply') }}</span>
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
import CropCanvas from '@/components/widgets/CropCanvas.vue'
import type { Bounds } from '@/composables/widgets/useImageCrop'
import { useTransformPipeline } from '@/composables/widgets/useTransformPipeline'
import { getWidget, readWidgetNum, writeWidget } from '@/utils/widget'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceImageUrl = computed<string | null>(() => {
  const inp = props.state.inputs.find(i => i.slot === 'image')
  if (!inp || inp.source !== 'upstream' || !inp.content) return null
  return inp.content
})

const bounds = ref<Bounds>({
  x:      readWidgetNum(props.node, 'crop_x', 0),
  y:      readWidgetNum(props.node, 'crop_y', 0),
  width:  readWidgetNum(props.node, 'crop_w', 0),
  height: readWidgetNum(props.node, 'crop_h', 0),
})

function onBoundsUpdate(v: Bounds) {
  bounds.value = v
}

watch(bounds, (v) => {
  writeWidget(props.node, 'crop_x', v.x)
  writeWidget(props.node, 'crop_y', v.y)
  writeWidget(props.node, 'crop_w', v.width)
  writeWidget(props.node, 'crop_h', v.height)
  requestRecompute()
}, { deep: true })

function wireWidgetCallback(name: string, apply: (v: number) => void) {
  const w = getWidget(props.node, name)
  if (!w) return
  const orig = w.callback
  w.callback = (value: unknown) => {
    orig?.call(w, value)
    apply(Number(value))
  }
}
wireWidgetCallback('crop_x', v => { if (v !== bounds.value.x)      bounds.value = { ...bounds.value, x: v } })
wireWidgetCallback('crop_y', v => { if (v !== bounds.value.y)      bounds.value = { ...bounds.value, y: v } })
wireWidgetCallback('crop_w', v => { if (v !== bounds.value.width)  bounds.value = { ...bounds.value, width: v } })
wireWidgetCallback('crop_h', v => { if (v !== bounds.value.height) bounds.value = { ...bounds.value, height: v } })

if (props.node) {
  const orig = props.node.onConfigure
  props.node.onConfigure = function (info: any) {
    orig?.call(this, info)
    const restored: Bounds = {
      x:      readWidgetNum(props.node, 'crop_x', bounds.value.x),
      y:      readWidgetNum(props.node, 'crop_y', bounds.value.y),
      width:  readWidgetNum(props.node, 'crop_w', bounds.value.width),
      height: readWidgetNum(props.node, 'crop_h', bounds.value.height),
    }
    if (restored.x !== bounds.value.x || restored.y !== bounds.value.y
      || restored.width !== bounds.value.width || restored.height !== bounds.value.height) {
      bounds.value = restored
    }
  }
}

const { computing, requestRecompute } = useTransformPipeline({
  sourceImageUrl,
  state: props.state,
  nodeId: props.node?.id ?? 'unknown',
  filenamePrefix: 'comfytv-crop',
  subfolder: 'cropper',
  compute: (img) => {
    const b = bounds.value
    const sx = Math.max(0, Math.min(img.naturalWidth  - 1, Math.round(b.x)))
    const sy = Math.max(0, Math.min(img.naturalHeight - 1, Math.round(b.y)))
    const sw = Math.max(1, Math.min(img.naturalWidth  - sx, Math.round(b.width)))
    const sh = Math.max(1, Math.min(img.naturalHeight - sy, Math.round(b.height)))
    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d context unavailable')
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
    return canvas
  },
})

watch(sourceImageUrl, (url) => {
  if (url && bounds.value.width > 0 && bounds.value.height > 0) {
    requestRecompute()
  }
}, { immediate: true })
</script>
