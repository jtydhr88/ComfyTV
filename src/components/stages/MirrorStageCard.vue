<template>
  <div class="flex flex-col gap-1.5 size-full">
    <div class="relative w-full h-[280px] rounded-md overflow-hidden border border-border-subtle
                bg-black flex items-center justify-center">
      <div v-if="!sourceImageUrl" class="flex flex-col items-center justify-center gap-1.5 text-white/50">
        <div class="text-[32px] opacity-60">⊟</div>
        <div class="text-xs">{{ $t('imageCrop.noInputImage') }}</div>
      </div>
      <img
        v-else
        :src="sourceImageUrl"
        class="max-w-full max-h-full object-contain select-none pointer-events-none"
        :style="previewStyle"
        draggable="false"
        @dragstart.prevent
      />
    </div>

    <div class="text-2xs text-center py-0.5">
      <span v-if="!sourceImageUrl" class="text-muted-foreground">{{ $t('imageCrop.noInputImage') }}</span>
      <span v-else-if="computing" class="text-muted-foreground">{{ $t('mirror.applying') }}</span>
      <span v-else-if="state.output" class="text-success-background">{{ $t('mirror.applied') }}</span>
      <span v-else class="text-muted-foreground">{{ $t('mirror.adjustToApply') }}</span>
    </div>

    <div class="flex gap-1.5">
      <button
        type="button"
        class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded
               text-xs border cursor-pointer"
        :class="flipH
          ? 'bg-secondary-background-selected border-primary-background text-primary-background font-semibold'
          : 'bg-secondary-background border-border-subtle text-base-foreground hover:bg-secondary-background-hover'"
        :title="$t('mirror.horizontal')"
        @click="flipH = !flipH"
      >
        <span class="text-sm leading-none">⇋</span> {{ $t('mirror.horizontal') }}
      </button>
      <button
        type="button"
        class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded
               text-xs border cursor-pointer"
        :class="flipV
          ? 'bg-secondary-background-selected border-primary-background text-primary-background font-semibold'
          : 'bg-secondary-background border-border-subtle text-base-foreground hover:bg-secondary-background-hover'"
        :title="$t('mirror.vertical')"
        @click="flipV = !flipV"
      >
        <span class="text-sm leading-none">⇅</span> {{ $t('mirror.vertical') }}
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
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import { useTransformPipeline } from '@/composables/widgets/useTransformPipeline'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: any
}>()

const sourceImageUrl = computed<string | null>(() => {
  const inp = props.state.inputs.find(i => i.slot === 'image')
  if (!inp || inp.source !== 'upstream' || !inp.content) return null
  return inp.content
})

function widgetValueBool(name: string, fallback = false): boolean {
  const w = props.node?.widgets?.find((x: any) => x.name === name)
  return w ? Boolean(w.value) : fallback
}

const flipH = ref<boolean>(widgetValueBool('flip_horizontal', false))
const flipV = ref<boolean>(widgetValueBool('flip_vertical', false))

function writeWidget(name: string, value: boolean) {
  const w = props.node?.widgets?.find((x: any) => x.name === name)
  if (!w) return
  if (w.value !== value) {
    w.value = value
    w.callback?.(value)
  }
}

function wireWidget(name: string, apply: (v: boolean) => void) {
  const w = props.node?.widgets?.find((x: any) => x.name === name)
  if (!w) return
  const orig = w.callback
  w.callback = (v: unknown) => { orig?.call(w, v); apply(Boolean(v)) }
}
wireWidget('flip_horizontal', v => { if (v !== flipH.value) flipH.value = v })
wireWidget('flip_vertical',   v => { if (v !== flipV.value) flipV.value = v })

if (props.node) {
  const orig = props.node.onConfigure
  props.node.onConfigure = function (info: any) {
    orig?.call(this, info)
    const h = widgetValueBool('flip_horizontal', flipH.value)
    const v = widgetValueBool('flip_vertical', flipV.value)
    if (h !== flipH.value) flipH.value = h
    if (v !== flipV.value) flipV.value = v
  }
}

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
  writeWidget('flip_horizontal', h)
  writeWidget('flip_vertical', v)
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
