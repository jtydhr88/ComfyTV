<template>
  <div class="mirror-stage">
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
      <span v-else-if="computing" class="muted">{{ $t('mirror.applying') }}</span>
      <span v-else-if="state.output" class="ok">{{ $t('mirror.applied') }}</span>
      <span v-else class="muted">{{ $t('mirror.adjustToApply') }}</span>
    </div>

    <div class="controls">
      <button
        type="button"
        class="toggle"
        :class="{ active: flipH }"
        :title="$t('mirror.horizontal')"
        @click="flipH = !flipH"
      >
        <span class="icon">⇋</span> {{ $t('mirror.horizontal') }}
      </button>
      <button
        type="button"
        class="toggle"
        :class="{ active: flipV }"
        :title="$t('mirror.vertical')"
        @click="flipV = !flipV"
      >
        <span class="icon">⇅</span> {{ $t('mirror.vertical') }}
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

<style scoped>
.mirror-stage {
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
}
.status .muted { color: rgba(255, 255, 255, 0.5); }
.status .ok    { color: #b5e3a5; }

.controls {
  display: flex;
  gap: 6px;
}
.toggle {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
}
.toggle:hover { background: rgba(255, 255, 255, 0.1); }
.toggle.active {
  background: rgba(233, 61, 130, 0.25);
  border-color: rgba(233, 61, 130, 0.6);
  color: #ffb0d8;
  font-weight: 600;
}
.icon { font-size: 14px; line-height: 1; }
</style>
