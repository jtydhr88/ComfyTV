<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div class="ctv:relative ctv:w-full ctv:h-[280px] ctv:rounded-md ctv:overflow-hidden ctv:border ctv:border-border-subtle
                ctv:bg-black ctv:flex ctv:items-center ctv:justify-center">
      <div v-if="!sourceImageUrl" class="ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:text-white/50">
        <div class="ctv:text-[32px] ctv:opacity-60">⊟</div>
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
import { computed, ref, watch } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
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

const angle = ref<number>(readWidgetNum(props.node, 'angle', 0))

function wireWidget(name: string, apply: (v: number) => void) {
  const w = getWidget(props.node, name)
  if (!w) return
  const orig = w.callback
  w.callback = (v: unknown) => { orig?.call(w, v); apply(Number(v)) }
}
wireWidget('angle', v => { if (v !== angle.value) angle.value = v })

if (props.node) {
  const orig = props.node.onConfigure
  props.node.onConfigure = function (info: any) {
    orig?.call(this, info)
    const v = readWidgetNum(props.node, 'angle', angle.value)
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
  writeWidget(props.node, 'angle', v)
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
