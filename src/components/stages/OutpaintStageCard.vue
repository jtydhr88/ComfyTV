<template>
  <div ref="rootEl" class="outpaint-stage">
    <div
      ref="canvasEl"
      class="canvas-area"
      :class="{ 'is-empty': !sourceImageUrl }"
    >
      <template v-if="!sourceImageUrl">
        <div class="empty-state">
          <div class="empty-icon">↔</div>
          <div class="empty-text">{{ $t('outpaint.noInputImage') }}</div>
        </div>
      </template>
      <template v-else>
        <div class="pad-area" :style="padAreaStyle" />
        <img
          :src="sourceImageUrl"
          class="src-img"
          :style="imgStyle"
          draggable="false"
          @load="onSourceLoaded"
          @dragstart.prevent
        />
        <div
          v-for="side in SIDES"
          :key="side"
          class="handle"
          :class="`handle-${side}`"
          :style="handleStyle(side)"
          @pointerdown="onHandlePointerDown($event, side)"
        >
          <span class="handle-grip" />
        </div>
        <span
          v-for="side in SIDES"
          :key="`v-${side}`"
          class="pad-value"
          :class="`pad-value-${side}`"
          :style="badgeStyle(side)"
        >{{ pad[side] }}px</span>
      </template>
    </div>

    <div class="controls">
      <div class="row">
        <label v-for="side in SIDES" :key="`in-${side}`" class="num">
          <span class="num-label">{{ $t(`outpaint.${side}`) }}</span>
          <input
            type="number" min="0" max="4096" step="8"
            :value="pad[side]"
            :disabled="!sourceImageUrl"
            @change="(e) => setPad(side, Number((e.target as HTMLInputElement).value))"
          />
        </label>
        <button
          type="button"
          class="reset-btn"
          :disabled="!sourceImageUrl"
          @click="resetAll"
        >{{ $t('outpaint.reset') }}</button>
      </div>
      <div class="row dim-row">
        <span class="muted">{{ $t('outpaint.output') }}:</span>
        <span class="dim">{{ outDims }}</span>
      </div>
    </div>

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
      hide-context
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'

type Side = 'left' | 'top' | 'right' | 'bottom'
const SIDES: Side[] = ['left', 'top', 'right', 'bottom']

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

const naturalW = ref(0)
const naturalH = ref(0)
function onSourceLoaded(e: Event) {
  const img = e.target as HTMLImageElement
  naturalW.value = img.naturalWidth
  naturalH.value = img.naturalHeight
}

function widgetValue(name: string, fallback = 0): number {
  const w = props.node?.widgets?.find((x: any) => x.name === name)
  return w ? Number(w.value) || 0 : fallback
}

const pad = ref<Record<Side, number>>({
  left:   widgetValue('pad_left',   0),
  top:    widgetValue('pad_top',    0),
  right:  widgetValue('pad_right',  0),
  bottom: widgetValue('pad_bottom', 0),
})

function writeWidget(name: string, value: number) {
  const w = props.node?.widgets?.find((x: any) => x.name === name)
  if (!w) return
  if (w.value !== value) {
    w.value = value
    w.callback?.(value)
  }
}

function setPad(side: Side, value: number) {
  const clamped = Math.max(0, Math.min(4096, Math.round(value || 0)))
  if (pad.value[side] === clamped) return
  pad.value = { ...pad.value, [side]: clamped }
}

watch(pad, (v) => {
  writeWidget('pad_left',   v.left)
  writeWidget('pad_top',    v.top)
  writeWidget('pad_right',  v.right)
  writeWidget('pad_bottom', v.bottom)
}, { deep: true })

function resetAll() {
  pad.value = { left: 0, top: 0, right: 0, bottom: 0 }
}

if (props.node) {
  props.node.onConfigure = useChainCallback(props.node.onConfigure, () => {
    pad.value = {
      left:   widgetValue('pad_left',   0),
      top:    widgetValue('pad_top',    0),
      right:  widgetValue('pad_right',  0),
      bottom: widgetValue('pad_bottom', 0),
    }
  })
}

const canvasEl = ref<HTMLDivElement | null>(null)
const canvasRect = ref({ w: 0, h: 0 })

let ro: ResizeObserver | null = null
watch(canvasEl, (el) => {
  ro?.disconnect()
  if (!el) return
  ro = new ResizeObserver(() => {
    canvasRect.value = { w: el.clientWidth, h: el.clientHeight }
  })
  ro.observe(el)
})

const virtualW = computed(() => Math.max(1, naturalW.value + pad.value.left + pad.value.right))
const virtualH = computed(() => Math.max(1, naturalH.value + pad.value.top + pad.value.bottom))

const scale = computed(() => {
  const cw = canvasRect.value.w - 24
  const ch = canvasRect.value.h - 24
  if (cw <= 0 || ch <= 0 || virtualW.value <= 0 || virtualH.value <= 0) return 1
  return Math.max(0.02, Math.min(cw / virtualW.value, ch / virtualH.value))
})

const offset = computed(() => {
  const w = virtualW.value * scale.value
  const h = virtualH.value * scale.value
  return {
    x: Math.max(0, (canvasRect.value.w - w) / 2),
    y: Math.max(0, (canvasRect.value.h - h) / 2),
  }
})

const padAreaStyle = computed(() => ({
  left:   `${offset.value.x}px`,
  top:    `${offset.value.y}px`,
  width:  `${virtualW.value * scale.value}px`,
  height: `${virtualH.value * scale.value}px`,
}))

const imgStyle = computed(() => ({
  left:   `${offset.value.x + pad.value.left * scale.value}px`,
  top:    `${offset.value.y + pad.value.top  * scale.value}px`,
  width:  `${naturalW.value * scale.value}px`,
  height: `${naturalH.value * scale.value}px`,
}))

function handleStyle(side: Side) {
  const ox = offset.value.x
  const oy = offset.value.y
  const ix = pad.value.left * scale.value
  const iy = pad.value.top  * scale.value
  const iw = naturalW.value * scale.value
  const ih = naturalH.value * scale.value
  const thick = 10
  if (side === 'left')   return { left: `${ox + ix - thick / 2}px`,         top: `${oy + iy}px`,           width: `${thick}px`, height: `${ih}px` }
  if (side === 'right')  return { left: `${ox + ix + iw - thick / 2}px`,    top: `${oy + iy}px`,           width: `${thick}px`, height: `${ih}px` }
  if (side === 'top')    return { left: `${ox + ix}px`,                     top: `${oy + iy - thick / 2}px`, width: `${iw}px`,   height: `${thick}px` }
  /* bottom */           return { left: `${ox + ix}px`,                     top: `${oy + iy + ih - thick / 2}px`, width: `${iw}px`, height: `${thick}px` }
}

function badgeStyle(side: Side) {
  const ox = offset.value.x
  const oy = offset.value.y
  const ix = pad.value.left * scale.value
  const iy = pad.value.top  * scale.value
  const iw = naturalW.value * scale.value
  const ih = naturalH.value * scale.value
  if (side === 'left')   return { left: `${ox + ix * 0.5}px`,           top: `${oy + iy + ih / 2}px`, transform: 'translate(-50%, -50%)' }
  if (side === 'right')  return { left: `${ox + ix + iw + (virtualW.value * scale.value - ix - iw) * 0.5}px`, top: `${oy + iy + ih / 2}px`, transform: 'translate(-50%, -50%)' }
  if (side === 'top')    return { left: `${ox + ix + iw / 2}px`,        top: `${oy + iy * 0.5}px`,    transform: 'translate(-50%, -50%)' }
  /* bottom */           return { left: `${ox + ix + iw / 2}px`,        top: `${oy + iy + ih + (virtualH.value * scale.value - iy - ih) * 0.5}px`, transform: 'translate(-50%, -50%)' }
}

const outDims = computed(() => {
  if (!naturalW.value) return '—'
  return `${virtualW.value} × ${virtualH.value}px`
})

const rootEl = ref<HTMLElement | null>(null)

function onHandlePointerDown(e: PointerEvent, side: Side) {
  if (!sourceImageUrl.value) return
  const el = rootEl.value
  if (!el) return
  el.setPointerCapture?.(e.pointerId)
  e.stopPropagation()

  const startClient = side === 'left' || side === 'right' ? e.clientX : e.clientY
  const startPad = pad.value[side]
  const sign = side === 'right' || side === 'bottom' ? 1 : -1  // drag outward → +pad
  const sc = scale.value

  const move = (ev: PointerEvent) => {
    const cur = side === 'left' || side === 'right' ? ev.clientX : ev.clientY
    const deltaPx = (cur - startClient) * sign
    const deltaSrc = Math.round(deltaPx / sc)
    setPad(side, startPad + deltaSrc)
  }
  const finish = () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', finish)
    el.removeEventListener('pointercancel', finish)
    try { el.releasePointerCapture?.(e.pointerId) } catch { /* */ }
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', finish)
  el.addEventListener('pointercancel', finish)
}
</script>

<style scoped>
.outpaint-stage {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  height: 100%;
}

.canvas-area {
  position: relative;
  flex: 1 1 auto;
  min-height: 280px;
  background: #0a0a0f;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  overflow: hidden;
  user-select: none;
}
.canvas-area.is-empty { display: flex; align-items: center; justify-content: center; }
.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  color: rgba(255, 255, 255, 0.5);
}
.empty-icon { font-size: 28px; opacity: 0.6; }
.empty-text { font-size: 12px; }

.pad-area {
  position: absolute;
  background-image:
    linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.04) 75%),
    linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.04) 75%);
  background-size: 12px 12px;
  background-position: 0 0, 6px 6px;
  border: 1px dashed rgba(255, 140, 200, 0.45);
}
.src-img {
  position: absolute;
  pointer-events: none;
  outline: 1px solid rgba(255, 255, 255, 0.7);
}

.handle {
  position: absolute;
  background: transparent;
  display: flex; align-items: center; justify-content: center;
  z-index: 3;
}
.handle-left, .handle-right  { cursor: ew-resize; }
.handle-top,  .handle-bottom { cursor: ns-resize; }
.handle::before {
  content: '';
  position: absolute;
  background: rgba(78, 168, 255, 0.65);
  border-radius: 2px;
}
.handle-left::before,  .handle-right::before  { width: 3px; height: 100%; }
.handle-top::before,   .handle-bottom::before { height: 3px; width: 100%; }
.handle:hover::before { background: rgba(78, 168, 255, 1); }
.handle-grip {
  position: absolute;
  width: 12px; height: 12px;
  background: #4ea8ff;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0,0,0,0.5);
}

.pad-value {
  position: absolute;
  font-size: 10px;
  background: rgba(0, 0, 0, 0.6);
  color: rgba(255, 255, 255, 0.9);
  padding: 1px 5px;
  border-radius: 3px;
  font-family: ui-monospace, monospace;
  z-index: 2;
  pointer-events: none;
}

.controls { display: flex; flex-direction: column; gap: 4px; }
.row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.num {
  display: flex; align-items: center; gap: 3px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  padding: 2px 4px;
}
.num-label {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  min-width: 32px;
}
.num input {
  width: 48px;
  background: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  padding: 1px 3px;
  font-size: 11px;
  font-family: ui-monospace, monospace;
}
.num input:disabled { opacity: 0.4; }

.reset-btn {
  margin-left: auto;
  padding: 3px 10px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.85);
  border-radius: 3px;
  cursor: pointer;
}
.reset-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.12); }
.reset-btn:disabled { opacity: 0.4; cursor: default; }

.dim-row .muted { font-size: 10px; color: rgba(255, 255, 255, 0.4); }
.dim { font-size: 11px; color: rgba(255, 255, 255, 0.8); font-family: ui-monospace, monospace; }
</style>
