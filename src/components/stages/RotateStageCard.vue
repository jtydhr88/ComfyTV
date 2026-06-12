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

    <div class="text-2xs text-center py-0.5 tracking-wide">
      <span v-if="!sourceImageUrl" class="text-muted-foreground">{{ $t('imageCrop.noInputImage') }}</span>
      <span v-else-if="computing" class="text-muted-foreground">{{ $t('rotate.applying') }}</span>
      <span v-else-if="state.output" class="text-success-background">{{ $t('rotate.applied') }}</span>
      <span v-else class="text-muted-foreground">{{ $t('rotate.adjustToApply') }}</span>
    </div>

    <div class="flex flex-col gap-1">
      <div class="grid grid-cols-[64px_1fr_48px] items-center gap-1.5 text-xs">
        <span class="text-2xs uppercase tracking-wider text-muted-foreground">{{ $t('rotate.angle') }}</span>
        <input
          type="range"
          class="w-full"
          min="-180" max="180" step="1"
          :value="angle"
          @input="(e) => angle = Number((e.target as HTMLInputElement).value)"
        />
        <span class="text-right text-base-foreground font-mono">{{ angle }}°</span>
      </div>
      <div class="grid grid-cols-4 gap-1.5 text-xs">
        <button
          v-for="q in [{ d: -90, l: '⟲ 90°' }, { d: 0, l: '0°' }, { d: 180, l: '180°' }, { d: 90, l: '⟳ 90°' }]"
          :key="q.l"
          type="button"
          class="py-1 px-1.5 rounded text-xs cursor-pointer
                 bg-secondary-background border border-border-subtle text-base-foreground hover:bg-secondary-background-hover"
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

function widgetValue(name: string, fallback = 0): number {
  const w = props.node?.widgets?.find((x: any) => x.name === name)
  return w ? Number(w.value) : fallback
}

const angle = ref<number>(widgetValue('angle', 0))

function writeWidget(name: string, value: number) {
  const w = props.node?.widgets?.find((x: any) => x.name === name)
  if (!w) return
  if (w.value !== value) {
    w.value = value
    w.callback?.(value)
  }
}

function wireWidget(name: string, apply: (v: number) => void) {
  const w = props.node?.widgets?.find((x: any) => x.name === name)
  if (!w) return
  const orig = w.callback
  w.callback = (v: unknown) => { orig?.call(w, v); apply(Number(v)) }
}
wireWidget('angle', v => { if (v !== angle.value) angle.value = v })

if (props.node) {
  const orig = props.node.onConfigure
  props.node.onConfigure = function (info: any) {
    orig?.call(this, info)
    const v = widgetValue('angle', angle.value)
    if (Number.isFinite(v) && v !== angle.value) angle.value = v
  }
}

function snap(deg: number) { angle.value = deg }

const previewStyle = computed(() => ({
  transform: `rotate(${angle.value}deg)`,
  transition: 'transform 80ms linear',
}))

const { computing, requestRecompute } = useTransformPipeline({
  sourceImageUrl,
  state: props.state,
  nodeId: props.node?.id ?? 'unknown',
  filenamePrefix: 'comfytv-rotate',
  subfolder: 'transformer',
  compute: (img) => rotateCanvas(img, angle.value),
})

watch(angle, (v) => {
  writeWidget('angle', v)
  requestRecompute()
})

watch(sourceImageUrl, (url) => {
  if (url) requestRecompute()
}, { immediate: true })

function rotateCanvas(img: HTMLImageElement, deg: number): HTMLCanvasElement {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const rad = (deg * Math.PI) / 180
  const cosT = Math.abs(Math.cos(rad))
  const sinT = Math.abs(Math.sin(rad))
  const newW = Math.max(1, Math.ceil(w * cosT + h * sinT))
  const newH = Math.max(1, Math.ceil(w * sinT + h * cosT))

  const canvas = document.createElement('canvas')
  canvas.width = newW
  canvas.height = newH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')

  ctx.translate(newW / 2, newH / 2)
  ctx.rotate(rad)
  ctx.drawImage(img, -w / 2, -h / 2)
  return canvas
}
</script>
