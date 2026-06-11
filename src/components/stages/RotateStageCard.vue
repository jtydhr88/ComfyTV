<template>
  <div class="rotate-stage">
    <div class="preview-shell">
      <div v-if="!sourceImageUrl" class="empty-state">
        <div class="empty-icon">⊟</div>
        <div class="empty-text">{{ $t('imageCrop.noInputImage') }}</div>
      </div>
      <img
        v-else
        :src="sourceImageUrl"
        class="preview-img"
        :style="previewStyle"
        draggable="false"
        @dragstart.prevent
      />
    </div>

    <div class="status">
      <span v-if="!sourceImageUrl" class="muted">{{ $t('imageCrop.noInputImage') }}</span>
      <span v-else-if="computing" class="muted">{{ $t('rotate.applying') }}</span>
      <span v-else-if="state.output" class="ok">{{ $t('rotate.applied') }}</span>
      <span v-else class="muted">{{ $t('rotate.adjustToApply') }}</span>
    </div>

    <div class="controls">
      <div class="row">
        <span class="label">{{ $t('rotate.angle') }}</span>
        <input
          type="range"
          min="-180" max="180" step="1"
          :value="angle"
          @input="(e) => angle = Number((e.target as HTMLInputElement).value)"
        />
        <span class="value">{{ angle }}°</span>
      </div>
      <div class="row quick-row">
        <button type="button" class="quick" @click="snap(-90)">⟲ 90°</button>
        <button type="button" class="quick" @click="snap(0)">0°</button>
        <button type="button" class="quick" @click="snap(180)">180°</button>
        <button type="button" class="quick" @click="snap(90)">⟳ 90°</button>
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

<style scoped>
.rotate-stage {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  height: 100%;
}

.preview-shell {
  position: relative;
  width: 100%;
  height: 280px;
  background: #0a0a0f;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
  pointer-events: none;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  gap: 6px;
}
.empty-icon { font-size: 32px; opacity: 0.6; }
.empty-text { font-size: 12px; }

.status {
  font-size: 10px;
  text-align: center;
  padding: 2px 0;
  letter-spacing: 0.3px;
}
.status .muted { color: rgba(255, 255, 255, 0.5); }
.status .ok    { color: #b5e3a5; }

.controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.row {
  display: grid;
  grid-template-columns: 64px 1fr 48px;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}
.label {
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: 10px;
}
.value {
  text-align: right;
  color: rgba(255, 255, 255, 0.85);
  font-family: ui-monospace, SFMono-Regular, monospace;
}
.quick-row {
  grid-template-columns: repeat(4, 1fr);
}
.quick {
  padding: 4px 6px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
}
.quick:hover { background: rgba(255, 255, 255, 0.1); }
input[type='range'] { width: 100%; }
</style>
