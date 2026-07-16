<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div
      class="ctv:relative ctv:w-full ctv:h-[200px] ctv:rounded-md ctv:overflow-hidden ctv:border ctv:border-border-subtle ctv-checker"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <div v-if="!sourceVideoUrl"
           class="ctv:h-full ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:text-white/50 ctv:bg-black">
        <i class="pi pi-video ctv:text-[32px] ctv:opacity-60" />
        <div class="ctv:text-xs">{{ $t('videoTrim.noInputVideo') }}</div>
      </div>
      <template v-else>
        <video
          ref="videoEl" :src="sourceVideoUrl" muted playsinline preload="auto" loop
          class="ctv:hidden"
          @loadeddata="startLoop"
        />
        <canvas
          ref="canvasEl"
          class="ctv:block ctv:size-full ctv:object-contain"
          :class="picking ? 'ctv:cursor-crosshair' : 'ctv:cursor-pointer'"
          @click="onCanvasClick"
        />
      </template>
    </div>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-[11px]">
        <span class="ctv:min-w-16 ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.keyColor') }}</span>
        <input
          type="color" :value="keyColor"
          class="ctv:w-8 ctv:h-6 ctv:p-0 ctv:border ctv:border-border-subtle ctv:rounded ctv:cursor-pointer ctv:bg-transparent"
          @input="(e) => keyColor = (e.target as HTMLInputElement).value"
        />
        <span class="ctv:font-mono ctv:text-2xs ctv:text-muted-foreground">{{ keyColor }}</span>
        <button
          type="button"
          class="ctv:ml-auto ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:transition-colors"
          :class="picking
            ? 'ctv:bg-secondary-background-selected ctv:border-primary-background ctv:text-primary-background'
            : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background'"
          @click="picking = !picking"
        ><i class="pi pi-eye-dropper" /> {{ $t('fx.pickFromVideo') }}</button>
        <button
          type="button"
          class="ctv:w-7 ctv:h-6 ctv:text-xs ctv:rounded ctv:cursor-pointer ctv:border
                 ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background"
          :title="playing ? $t('videoTrim.pause') : $t('videoCrop.play')"
          @click="togglePlay"
        ><i :class="['pi', playing ? 'pi-pause' : 'pi-play']" /></button>
      </div>

      <FxSlider v-model="similarity" :label="$t('fx.similarity')" :min="0.01" :max="1" :step="0.01" :reset-to="0.1" />
      <FxSlider v-model="blend" :label="$t('fx.blend')" :min="0" :max="1" :step="0.01" :reset-to="0.05" />
      <FxSlider v-model="despillMix" :label="$t('fx.despill')" :min="0" :max="1" :step="0.01" :reset-to="0.5" />
      <FxSlider v-model="despillExpand" :label="$t('fx.despillExpand')" :min="0" :max="1" :step="0.01" :reset-to="0" />
      <FxChips v-model="output" :options="OUTPUTS" />
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('fx.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('fx.previewNote') }}</span>
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
import { computed, onBeforeUnmount, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const { t } = useI18n()
const OUTPUTS = computed(() => [
  { value: 'alpha', label: t('fx.outAlpha') },
  { value: 'matte', label: t('fx.outMatte') },
]).value

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))

const keyColor = useStrWidget(props.node, 'key_color', '#00FF00')
const similarity = useNumWidget(props.node, 'similarity', 0.1)
const blend = useNumWidget(props.node, 'blend', 0.05)
const despillMix = useNumWidget(props.node, 'despill_mix', 0.5)
const despillExpand = useNumWidget(props.node, 'despill_expand', 0)
const output = useStrWidget(props.node, 'output', 'alpha')

const videoEl = ref<HTMLVideoElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const picking = ref(false)
const playing = ref(false)
let rafId = 0

const PW = 320
const PH = 180

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16) || 0,
          parseInt(h.slice(2, 4), 16) || 0,
          parseInt(h.slice(4, 6), 16) || 0]
}

function rgbToUv(r: number, g: number, b: number): [number, number] {
  return [
    -0.168736 * r - 0.331264 * g + 0.5 * b + 128,
    0.5 * r - 0.418688 * g - 0.081312 * b + 128,
  ]
}

function renderFrame() {
  const v = videoEl.value
  const c = canvasEl.value
  const ctx = c?.getContext('2d', { willReadFrequently: true })
  if (!v || !c || !ctx || v.readyState < 2) {
    rafId = requestAnimationFrame(renderFrame)
    return
  }
  if (c.width !== PW) { c.width = PW; c.height = PH }
  ctx.clearRect(0, 0, PW, PH)
  const ar = (v.videoWidth || 16) / (v.videoHeight || 9)
  let dw = PW, dh = PW / ar
  if (dh > PH) { dh = PH; dw = PH * ar }
  const dx = (PW - dw) / 2, dy = (PH - dh) / 2
  ctx.drawImage(v, dx, dy, dw, dh)

  const img = ctx.getImageData(0, 0, PW, PH)
  const d = img.data
  const [kr, kg, kb] = hexToRgb(keyColor.value)
  const [ku, kv] = rgbToUv(kr, kg, kb)
  const sim = similarity.value * 255 * Math.SQRT2
  const bl = blend.value * 255 * Math.SQRT2
  for (let i = 0; i < d.length; i += 4) {
    const [u, vv] = rgbToUv(d[i], d[i + 1], d[i + 2])
    const dist = Math.hypot(u - ku, vv - kv)
    let a = 255
    if (dist < sim) a = 0
    else if (bl > 0 && dist < sim + bl) a = Math.round(((dist - sim) / bl) * 255)
    d[i + 3] = Math.min(d[i + 3], a)
  }
  ctx.putImageData(img, 0, 0)
  rafId = requestAnimationFrame(renderFrame)
}

function startLoop() {
  cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(renderFrame)
}

function togglePlay() {
  const v = videoEl.value
  if (!v) return
  if (v.paused) { v.play(); playing.value = true }
  else { v.pause(); playing.value = false }
}

function onCanvasClick(e: MouseEvent) {
  if (!picking.value) { togglePlay(); return }
  const c = canvasEl.value
  const v = videoEl.value
  if (!c || !v || v.readyState < 2) return
  const tmp = document.createElement('canvas')
  tmp.width = PW; tmp.height = PH
  const tctx = tmp.getContext('2d')!
  const ar = (v.videoWidth || 16) / (v.videoHeight || 9)
  let dw = PW, dh = PW / ar
  if (dh > PH) { dh = PH; dw = PH * ar }
  tctx.drawImage(v, (PW - dw) / 2, (PH - dh) / 2, dw, dh)
  const rect = c.getBoundingClientRect()
  const px = Math.floor((e.clientX - rect.left) * (PW / rect.width))
  const py = Math.floor((e.clientY - rect.top) * (PH / rect.height))
  const p = tctx.getImageData(px, py, 1, 1).data
  keyColor.value = '#' + [p[0], p[1], p[2]]
    .map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()
  picking.value = false
}

onBeforeUnmount(() => cancelAnimationFrame(rafId))
</script>

<style scoped>
.ctv-checker {
  background-image:
    linear-gradient(45deg, #333 25%, transparent 25%, transparent 75%, #333 75%),
    linear-gradient(45deg, #333 25%, #222 25%, #222 75%, #333 75%);
  background-size: 16px 16px;
  background-position: 0 0, 8px 8px;
}
</style>
