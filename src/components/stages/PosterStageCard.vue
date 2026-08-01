<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full" @contextmenu.stop.prevent>
    <div
      class="ctv:shrink-0 ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-1.5 ctv:px-1"
      @pointerdown.stop
      @wheel.stop
    >
      <div class="ctv:w-36 ctv:min-w-0">
        <ComfyTVSelect
          :model-value="ps.template()"
          :options="templateOptions"
          @update:model-value="ps.setTemplate(String($event))"
        />
      </div>
      <div class="ctv:w-40 ctv:min-w-0">
        <ComfyTVSelect
          :model-value="sizePresetLabel"
          :options="sizeOptions"
          @update:model-value="onSizePreset(String($event))"
        />
      </div>
      <label v-for="c in colorKeys" :key="c.key" :title="c.title"
             class="ctv:inline-flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:text-2xs ctv:text-muted-foreground">
        <span>{{ c.label }}</span>
        <input
          type="color"
          :value="ps.getColor(c.key)"
          class="ctv:w-5 ctv:h-4 ctv:p-0 ctv:border ctv:border-border-default ctv:rounded-sm ctv:bg-transparent ctv:cursor-pointer"
          @input="ps.setColor(c.key, ($event.target as HTMLInputElement).value)"
        >
      </label>
      <div class="ctv:w-32 ctv:min-w-0" :title="$t('poster.fontTitle')">
        <ComfyTVSelect
          :model-value="ps.getFont('font_title') || SYSTEM_FONT"
          :options="fontOptions"
          @update:model-value="onFont('font_title', String($event))"
        />
      </div>
      <div class="ctv:w-32 ctv:min-w-0" :title="$t('poster.fontBody')">
        <ComfyTVSelect
          :model-value="ps.getFont('font_body') || SYSTEM_FONT"
          :options="fontOptions"
          @update:model-value="onFont('font_body', String($event))"
        />
      </div>
      <span class="ctv:flex-1" />
      <button v-if="ps.hasElements.value" :class="btn(false)" :title="$t('poster.addTooltip')" @click="addMenuOpen = !addMenuOpen">➕</button>
      <button v-if="ps.hasElements.value" :class="btn(ps.gridOn.value)" :title="$t('poster.gridTooltip')" @click="ps.toggleGrid(); drawOverlay()">⌗</button>
      <button v-if="ps.hasElements.value" :class="btn(false)" :title="$t('poster.addGuideV')" @click="ps.addGuide('x'); ps.editMode.value = true; drawOverlay()">┊+</button>
      <button v-if="ps.hasElements.value" :class="btn(false)" :title="$t('poster.addGuideH')" @click="ps.addGuide('y'); ps.editMode.value = true; drawOverlay()">┄+</button>
      <button v-if="ps.hasElements.value" :class="btn(ps.snap.value)" :title="$t('poster.snapTooltip')" @click="ps.snap.value = !ps.snap.value">⊹</button>
      <button v-if="ps.hasElements.value" :class="btn(ps.editMode.value)" :title="$t('poster.editTooltip')" @click="toggleEdit">✎ {{ $t('poster.edit') }}</button>
    </div>

    <div
      v-if="addMenuOpen"
      class="ctv:shrink-0 ctv:flex ctv:items-center ctv:gap-1 ctv:px-1"
      @pointerdown.stop
    >
      <button v-for="t in addTypes" :key="t.type" :class="btn(false)"
              @click="onAdd(t.type)">{{ t.label }}</button>
    </div>

    <div
      ref="stageWrap"
      class="ctv:relative ctv:flex-1 ctv:min-h-0 ctv:overflow-hidden ctv:rounded-sm ctv:bg-black/40"
      tabindex="-1"
      @pointerdown.stop
      @wheel.stop
      @keydown="onKeydown"
    >
      <iframe ref="frameA" scrolling="no" :style="frameStyle(true)" />
      <iframe ref="frameB" scrolling="no" :style="frameStyle(false)" />
      <canvas
        ref="overlay"
        class="ctv:absolute ctv:z-[2]"
        :style="overlayStyle"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @dblclick="onDblClick"
      />

      <div
        v-if="toolbarVisible && activeRect"
        class="ctv:absolute ctv:z-[6] ctv:flex ctv:items-center ctv:gap-0.5 ctv:rounded-md ctv:border ctv:border-primary-background ctv:bg-interface-panel-surface ctv:px-1 ctv:py-0.5 ctv:whitespace-nowrap"
        :style="elToolbarStyle"
        @pointerdown.stop
      >
        <template v-if="activeType === 'text'">
          <button :class="miniBtn(false)" :title="$t('poster.fontToggle')" @click="toggleElFont">
            {{ elProp<string>('font', 'body') === 'title' ? $t('poster.fontTitleShort') : $t('poster.fontBodyShort') }}
          </button>
          <button :class="miniBtn(false)" @click="bumpFontSize(-2)">A−</button>
          <span class="ctv:text-2xs ctv:text-primary-foreground ctv:min-w-6 ctv:text-center">{{ Math.round(Number(elProp('font_size', 32))) }}</span>
          <button :class="miniBtn(false)" @click="bumpFontSize(2)">A+</button>
          <span :class="sepClass" />
          <button v-for="a in aligns" :key="a.v" :class="miniBtn(elProp('align', 'left') === a.v)"
                  @click="ps.setElementProp('align', a.v)">{{ a.l }}</button>
          <span :class="sepClass" />
          <button v-for="c in elColors" :key="c.v" :class="miniBtn(elProp('color', '') === c.v)"
                  @click="ps.setElementProp('color', c.v)">{{ c.l }}</button>
        </template>
        <template v-else-if="activeType === 'image'">
          <button :class="miniBtn(ps.imgEditId.value === activeId)" :title="$t('poster.imgAdjustTooltip')" @click="toggleImgEdit">✥</button>
          <input
            v-if="ps.imgEditId.value === activeId"
            type="range" min="1" max="4" step="0.02"
            class="ctv:w-20 ctv:cursor-pointer ctv:accent-primary-background"
            :value="imgScaleValue"
            @input="onImgScale(parseFloat(($event.target as HTMLInputElement).value))"
            @change="onImgScaleCommit"
          >
        </template>
        <span :class="sepClass" />
        <button :class="miniBtn(false) + ' ctv:text-destructive-foreground'" :title="$t('poster.deleteTooltip')" @click="ps.deleteActive()">🗑</button>
      </div>

      <div
        v-if="multiToolbarVisible && selectionRect"
        class="ctv:absolute ctv:z-[6] ctv:flex ctv:items-center ctv:gap-0.5 ctv:rounded-md ctv:border ctv:border-primary-background ctv:bg-interface-panel-surface ctv:px-1 ctv:py-0.5 ctv:whitespace-nowrap"
        :style="multiToolbarStyle"
        @pointerdown.stop
      >
        <button v-for="a in alignOps" :key="a.op" :class="miniBtn(false)"
                @click="onArrange(a.op)">{{ a.l }}</button>
        <span :class="sepClass" />
        <button v-for="d in distOps" :key="d.op"
                :class="miniBtn(false) + (ps.selectedIds.value.length < 3 && (d.op === 'hgap' || d.op === 'vgap') ? ' ctv:opacity-40' : '')"
                :disabled="ps.selectedIds.value.length < 3 && (d.op === 'hgap' || d.op === 'vgap')"
                @click="onArrange(d.op)">{{ d.l }}</button>
        <span :class="sepClass" />
        <button :class="miniBtn(false) + ' ctv:text-destructive-foreground'" :title="$t('poster.deleteTooltip')" @click="ps.deleteActive()">🗑</button>
      </div>

      <textarea
        v-if="inline"
        ref="inlineTa"
        v-model="inline.text"
        spellcheck="false"
        class="ctv:absolute ctv:z-[5] ctv:box-border ctv:resize-none ctv:rounded-sm ctv:border-2 ctv:border-primary-background ctv:bg-black/90 ctv:text-white ctv:text-xs ctv:font-mono ctv:p-1 ctv:overflow-auto ctv:focus-visible:outline-none"
        :style="inlineStyle"
        @pointerdown.stop
        @keydown="onInlineKeydown"
        @blur="closeInline(true)"
      />

      <div
        v-if="picker"
        class="ctv:absolute ctv:z-[7] ctv:flex ctv:flex-col ctv:rounded-md ctv:border ctv:border-border-default ctv:bg-interface-panel-surface ctv:p-1 ctv:min-w-28 ctv:max-h-56 ctv:overflow-y-auto"
        :style="{ left: picker.x + 'px', top: picker.y + 'px' }"
        @pointerdown.stop
      >
        <span class="ctv:text-3xs ctv:text-muted-foreground ctv:px-1.5 ctv:pb-1">{{ picker.title }}</span>
        <button
          v-for="opt in picker.options" :key="opt.key"
          :class="rowBtn(opt.active)"
          @click="opt.onPick(); picker = null"
        >{{ opt.label }}</button>
      </div>

      <div
        v-if="previewErrorText"
        class="ctv:absolute ctv:left-1 ctv:bottom-1 ctv:z-[3] ctv:text-2xs ctv:text-destructive-foreground ctv:bg-black/70 ctv:rounded-sm ctv:px-1.5 ctv:py-0.5"
      >{{ previewErrorText }}</div>
    </div>

    <div class="ctv:shrink-0">
      <StageCard
        :state="stageState"
        :node="node"
        :on-run-request="onRunRequest"
        :on-cancel-request="onCancelRequest"
        :on-disconnect="onDisconnect"
        :on-action="onAction"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import StageCard from '@/components/stages/StageCard.vue'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import { listResources } from '@/api'
import {
  HANDLE, MIN_WH, SIZE_PRESETS, SNAP_PX,
  cursorFor, elementProp, hitTest, rectPx, usePosterStage,
  type PosterElement, type Rect,
} from '@/composables/stages/usePosterStage'
import { angleTo, handlePos, type Transform } from '@/lib/shared2d/transformMath'

const SYSTEM_FONT = '(系统默认 System)'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const { t } = useI18n()

const stageState = computed(() => props.state)
const ps = usePosterStage(props.node, () => props.state)

const stageWrap = ref<HTMLElement | null>(null)
const frameA = ref<HTMLIFrameElement | null>(null)
const frameB = ref<HTMLIFrameElement | null>(null)
const overlay = ref<HTMLCanvasElement | null>(null)
const inlineTa = ref<HTMLTextAreaElement | null>(null)

const frontIsA = ref(true)
const view = ref({ scale: 1, offX: 0, offY: 0, cw: 0, ch: 0 })
const addMenuOpen = ref(false)
const fonts = ref<string[]>([])

const inline = ref<{
  el: PosterElement
  kind: 'literal' | 'data' | 'label'
  refIndex: number
  text: string
  rect: Rect
} | null>(null)

const marquee = ref<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
const rotDrag = ref<{ id: string; baseDeg: number; grab: number } | null>(null)
const guideDrag = ref<{ index: number } | null>(null)

function elTransformPx(el: PosterElement): Transform {
  const cv = overlay.value!
  const r = ps.effRect(el)
  return {
    x: r.x * cv.width, y: r.y * cv.height,
    w: r.w * cv.width, h: r.h * cv.height,
    rotation: ps.elementRot(el) * Math.PI / 180,
  }
}

function rotatedCorners(t: Transform): [number, number][] {
  return (['nw', 'ne', 'se', 'sw'] as const).map(h => {
    const p = handlePos(t, h)
    return [p.x, p.y]
  })
}

function guideHitIndex(px: number, py: number): number {
  const cv = overlay.value!
  const gs = ps.guides.value
  for (let i = 0; i < gs.length; i++) {
    const g = gs[i]!
    const d = g.axis === 'x' ? Math.abs(px - g.pos * cv.width) : Math.abs(py - g.pos * cv.height)
    if (d <= 4) return i
  }
  return -1
}

function livePatchRotate(id: string, deg: number) {
  try {
    const doc = frontFrame()?.contentDocument
    if (!doc) return
    const key = (window.CSS && CSS.escape) ? CSS.escape(id) : id
    const el = doc.querySelector(`.pm-el[data-el="${key}"]`) as HTMLElement | null
    if (el) el.style.transform = deg ? `rotate(${deg.toFixed(3)}deg)` : ''
  } catch {}
}

const picker = ref<{
  title: string
  x: number
  y: number
  options: Array<{ key: string; label: string; active: boolean; onPick: () => void }>
} | null>(null)

const colorKeys = computed(() => [
  { key: 'primary_color', label: t('poster.colorPrimary'), title: t('poster.colorPrimaryTitle') },
  { key: 'accent_color', label: t('poster.colorAccent'), title: t('poster.colorAccentTitle') },
  { key: 'bg_color', label: t('poster.colorBg'), title: t('poster.colorBgTitle') },
])

const aligns = computed(() => [
  { v: 'left', l: t('poster.alignLeft') },
  { v: 'center', l: t('poster.alignCenter') },
  { v: 'right', l: t('poster.alignRight') },
  { v: 'justify', l: t('poster.alignJustify') },
])

const elColors = computed(() => [
  { v: '', l: t('poster.colorPrimary') },
  { v: 'accent', l: t('poster.colorAccent') },
  { v: 'muted', l: t('poster.colorMuted') },
])

const addTypes = computed(() => [
  { type: 'text', label: t('poster.addText') },
  { type: 'image', label: t('poster.addImage') },
  { type: 'shape', label: t('poster.addShape') },
])

const templateOptions = computed(() =>
  ps.templates.value.map(tp => ({ value: tp.name, label: tp.label || tp.name })))

const fontOptions = computed(() =>
  [SYSTEM_FONT, ...fonts.value].map(f => ({ value: f, label: f })))

const sizeTick = ref(0)
const sizeCustom = computed(() => {
  void sizeTick.value
  return `${t('poster.sizeCustom')} ${ps.posterWidth()}×${ps.posterHeight()}`
})
const sizePresetLabel = computed(() => {
  void sizeTick.value
  const w = ps.posterWidth()
  const h = ps.posterHeight()
  return SIZE_PRESETS.find(p => p.w === w && p.h === h)?.label ?? sizeCustom.value
})
const sizeOptions = computed(() => {
  const opts = SIZE_PRESETS.map(p => ({ value: p.label, label: p.label }))
  if (!SIZE_PRESETS.some(p => p.label === sizePresetLabel.value)) {
    opts.unshift({ value: sizeCustom.value, label: sizeCustom.value })
  }
  return opts
})

const previewErrorText = computed(() =>
  ps.previewError.value ? t('poster.previewFailed', { detail: ps.previewError.value }) : '')

const activeId = computed(() => ps.activeElement.value?.id ?? null)
const activeType = computed(() => ps.activeElement.value?.type ?? '')
const toolbarVisible = computed(() =>
  ps.editMode.value && ps.hasElements.value && !inline.value
  && ps.selectedIds.value.length === 1 && !!ps.activeElement.value)
const multiToolbarVisible = computed(() =>
  ps.editMode.value && ps.hasElements.value && !inline.value
  && ps.selectedIds.value.length >= 2)

const activeRect = computed<Rect | null>(() => {
  const el = ps.activeElement.value
  if (!el) return null
  return rectPx(ps.effRect(el), view.value.cw, view.value.ch)
})

const selectionRect = computed<Rect | null>(() => {
  const els = ps.selectedElements.value
  if (els.length < 2) return null
  const rects = els.map(el => rectPx(ps.effRect(el), view.value.cw, view.value.ch))
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const r of rects) {
    minX = Math.min(minX, r.x); minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
})

const multiToolbarStyle = computed(() => {
  const r = selectionRect.value
  if (!r) return {}
  const top = r.y + view.value.offY - 32
  return {
    left: `${Math.max(0, Math.min(r.x + view.value.offX, view.value.cw - 280))}px`,
    top: `${top < 0 ? r.y + view.value.offY + r.h + 4 : top}px`,
  }
})

const alignOps = computed(() => [
  { op: 'left', l: t('poster.alignEdgeLeft') },
  { op: 'hcenter', l: t('poster.alignEdgeHCenter') },
  { op: 'right', l: t('poster.alignEdgeRight') },
  { op: 'top', l: t('poster.alignEdgeTop') },
  { op: 'vcenter', l: t('poster.alignEdgeVCenter') },
  { op: 'bottom', l: t('poster.alignEdgeBottom') },
] as const)

const distOps = computed(() => [
  { op: 'hspread', l: t('poster.distHSpread') },
  { op: 'vspread', l: t('poster.distVSpread') },
  { op: 'hgap', l: t('poster.distHGap') },
  { op: 'vgap', l: t('poster.distVGap') },
] as const)

function onArrange(op: string) {
  ps.applyArrange(op as Parameters<typeof ps.applyArrange>[0])
  drawOverlay()
}

const imgScaleValue = computed(() => {
  const el = ps.activeElement.value
  return el ? ps.elementImageProps(el).scale : 1
})

const elToolbarStyle = computed(() => {
  const r = activeRect.value
  if (!r) return {}
  const top = r.y + view.value.offY - 32
  return {
    left: `${Math.max(0, Math.min(r.x + view.value.offX, view.value.cw - 180))}px`,
    top: `${top < 0 ? r.y + view.value.offY + r.h + 4 : top}px`,
  }
})

const inlineStyle = computed(() => {
  const box = inline.value
  if (!box) return {}
  const h = box.kind === 'label' ? 26 : Math.max(48, box.rect.h)
  return {
    left: `${box.rect.x + view.value.offX}px`,
    top: `${box.kind === 'label' ? box.rect.y + box.rect.h - h + view.value.offY : box.rect.y + view.value.offY}px`,
    width: `${Math.max(60, box.rect.w)}px`,
    height: `${h}px`,
  }
})

const overlayStyle = computed(() => ({
  left: `${view.value.offX}px`,
  top: `${view.value.offY}px`,
  display: ps.editMode.value && ps.hasElements.value ? 'block' : 'none',
  touchAction: 'none',
}))

function btn(active: boolean): string {
  return 'ctv:appearance-none ctv:cursor-pointer ctv:[font-family:inherit] ctv:rounded-sm ' +
    'ctv:px-2 ctv:py-0.5 ctv:text-2xs ctv:border ctv:focus-visible:outline-none ' +
    (active
      ? 'ctv:border-primary-background ctv:text-primary-foreground ctv:bg-primary-background/15'
      : 'ctv:border-border-default ctv:text-muted-foreground ctv:bg-secondary-background')
}

function miniBtn(active: boolean): string {
  return 'ctv:appearance-none ctv:cursor-pointer ctv:[font-family:inherit] ctv:rounded-sm ' +
    'ctv:px-1.5 ctv:py-0.5 ctv:text-2xs ctv:border ctv:focus-visible:outline-none ' +
    (active
      ? 'ctv:border-primary-background ctv:text-primary-foreground ctv:bg-primary-background/15'
      : 'ctv:border-border-subtle ctv:text-base-foreground ctv:bg-secondary-background')
}

function rowBtn(active: boolean): string {
  return 'ctv:appearance-none ctv:cursor-pointer ctv:[font-family:inherit] ctv:text-left ' +
    'ctv:rounded-sm ctv:border-none ctv:px-1.5 ctv:py-1 ctv:text-2xs ctv:bg-transparent ' +
    'ctv:hover:bg-secondary-background-hover ' +
    (active ? 'ctv:text-primary-foreground' : 'ctv:text-base-foreground')
}

const sepClass = 'ctv:w-px ctv:h-4 ctv:bg-border-subtle ctv:mx-0.5 ctv:shrink-0'

function elProp<T>(key: string, dflt: T): T {
  const el = ps.activeElement.value
  if (!el) return dflt
  return elementProp(el, ps.layout.value, key, dflt)
}

function frameStyle(isA: boolean) {
  const front = frontIsA.value === isA
  return {
    position: 'absolute' as const,
    left: `${view.value.offX}px`,
    top: `${view.value.offY}px`,
    width: `${ps.posterWidth()}px`,
    height: `${ps.posterHeight()}px`,
    border: '0',
    background: '#fff',
    transformOrigin: 'top left',
    transform: `scale(${view.value.scale})`,
    pointerEvents: 'none' as const,
    opacity: front ? '1' : '0',
  }
}

function frontFrame(): HTMLIFrameElement | null {
  return frontIsA.value ? frameA.value : frameB.value
}
function backFrame(): HTMLIFrameElement | null {
  return frontIsA.value ? frameB.value : frameA.value
}

let ro: ResizeObserver | null = null
function rescale() {
  const wrap = stageWrap.value
  if (!wrap) return
  const W = ps.posterWidth()
  const H = ps.posterHeight()
  const availW = Math.max(40, wrap.clientWidth)
  const availH = Math.max(40, wrap.clientHeight)
  const scale = Math.min(availW / W, availH / H)
  const cw = Math.round(W * scale)
  const ch = Math.max(1, Math.round(H * scale))
  view.value = {
    scale,
    offX: Math.floor((availW - cw) / 2),
    offY: Math.floor((availH - ch) / 2),
    cw, ch,
  }
  const cv = overlay.value
  if (cv) {
    cv.width = cw
    cv.height = ch
    cv.style.width = `${cw}px`
    cv.style.height = `${ch}px`
  }
  drawOverlay()
}

function drawOverlay() {
  const cv = overlay.value
  const ctx = cv?.getContext('2d')
  if (!cv || !ctx) return
  ctx.clearRect(0, 0, cv.width, cv.height)
  if (!(ps.editMode.value && ps.hasElements.value)) return
  if (ps.gridOn.value) {
    ctx.strokeStyle = 'rgba(120,140,160,0.18)'
    ctx.lineWidth = 1
    for (let i = 1; i < 12; i++) {
      const X = Math.round(cv.width * i / 12) + 0.5
      const Y = Math.round(cv.height * i / 12) + 0.5
      ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, cv.height); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, Y); ctx.lineTo(cv.width, Y); ctx.stroke()
    }
  }
  const selected = new Set(ps.selectedIds.value)
  const single = selected.size === 1
  ps.elements.value.forEach((el) => {
    const r = rectPx(ps.effRect(el), cv.width, cv.height)
    const active = selected.has(el.id)
    const imgEdit = ps.imgEditId.value === el.id
    const rot = ps.elementRot(el)
    ctx.lineWidth = active ? 2 : 1
    ctx.strokeStyle = imgEdit ? '#3fd6a0' : (active ? '#46b4e6' : 'rgba(70,180,230,0.5)')
    ctx.fillStyle = imgEdit ? 'rgba(63,214,160,0.08)'
      : (active ? 'rgba(70,180,230,0.10)' : 'rgba(70,180,230,0.04)')
    if (rot) {
      const corners = rotatedCorners(elTransformPx(el))
      ctx.beginPath()
      ctx.moveTo(corners[0]![0], corners[0]![1])
      for (const [cx2, cy2] of corners.slice(1)) ctx.lineTo(cx2, cy2)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    } else {
      ctx.fillRect(r.x, r.y, r.w, r.h)
      ctx.strokeRect(r.x, r.y, r.w, r.h)
    }
    ctx.fillStyle = imgEdit ? '#3fd6a0' : (active ? '#46b4e6' : 'rgba(200,220,235,0.8)')
    ctx.font = '11px monospace'
    ctx.fillText(imgEdit ? t('poster.imgDragHint') : (el.label || el.id), r.x + 4, r.y + 13)
    if (active && single && !imgEdit) {
      ctx.fillStyle = '#46b4e6'
      if (!rot) {
        for (const [hx, hy] of handlePtsPx(r)) {
          ctx.fillRect(hx - HANDLE / 2, hy - HANDLE / 2, HANDLE, HANDLE)
        }
      }
      const tpx = elTransformPx(el)
      const n = handlePos(tpx, 'n')
      const rp = handlePos(tpx, 'rotate')
      ctx.strokeStyle = '#46b4e6'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(rp.x, rp.y); ctx.stroke()
      ctx.beginPath(); ctx.arc(rp.x, rp.y, HANDLE / 2 + 1, 0, Math.PI * 2)
      ctx.fill()
    }
  })
  ctx.setLineDash([5, 4])
  ctx.strokeStyle = '#22d3ee'
  ctx.lineWidth = 1
  ps.guides.value.forEach((g) => {
    ctx.beginPath()
    if (g.axis === 'x') {
      const X = Math.round(g.pos * cv.width) + 0.5
      ctx.moveTo(X, 0); ctx.lineTo(X, cv.height)
    } else {
      const Y = Math.round(g.pos * cv.height) + 0.5
      ctx.moveTo(0, Y); ctx.lineTo(cv.width, Y)
    }
    ctx.stroke()
  })
  ctx.setLineDash([])
  for (const g of ps.snapGuides.value) {
    ctx.strokeStyle = '#ff3b6b'
    ctx.lineWidth = 1
    if (g.kind === 'gap' && g.spans && g.cross != null) {
      const crossPx = g.axis === 'x' ? g.cross * cv.height : g.cross * cv.width
      for (const [a, b] of g.spans) {
        const a0 = g.axis === 'x' ? a * cv.width : a * cv.height
        const b0 = g.axis === 'x' ? b * cv.width : b * cv.height
        ctx.beginPath()
        if (g.axis === 'x') {
          ctx.moveTo(a0, crossPx); ctx.lineTo(b0, crossPx)
          ctx.moveTo(a0, crossPx - 4); ctx.lineTo(a0, crossPx + 4)
          ctx.moveTo(b0, crossPx - 4); ctx.lineTo(b0, crossPx + 4)
        } else {
          ctx.moveTo(crossPx, a0); ctx.lineTo(crossPx, b0)
          ctx.moveTo(crossPx - 4, a0); ctx.lineTo(crossPx + 4, a0)
          ctx.moveTo(crossPx - 4, b0); ctx.lineTo(crossPx + 4, b0)
        }
        ctx.stroke()
      }
      continue
    }
    ctx.beginPath()
    if (g.axis === 'x') {
      const X = Math.round(g.pos * cv.width) + 0.5
      ctx.moveTo(X, 0); ctx.lineTo(X, cv.height)
    } else {
      const Y = Math.round(g.pos * cv.height) + 0.5
      ctx.moveTo(0, Y); ctx.lineTo(cv.width, Y)
    }
    ctx.stroke()
  }
  const m = marquee.value
  if (m) {
    ctx.strokeStyle = '#46b4e6'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.strokeRect(
      Math.min(m.x0, m.x1) + 0.5, Math.min(m.y0, m.y1) + 0.5,
      Math.abs(m.x1 - m.x0), Math.abs(m.y1 - m.y0),
    )
    ctx.setLineDash([])
  }
}

function handlePtsPx(r: Rect): [number, number][] {
  const mx = r.x + r.w / 2
  const my = r.y + r.h / 2
  return [
    [r.x, r.y], [mx, r.y], [r.x + r.w, r.y],
    [r.x, my], [r.x + r.w, my],
    [r.x, r.y + r.h], [mx, r.y + r.h], [r.x + r.w, r.y + r.h],
  ]
}

function evXY(e: PointerEvent | MouseEvent): [number, number] {
  const cv = overlay.value!
  const r = cv.getBoundingClientRect()
  const sx = r.width ? cv.width / r.width : 1
  const sy = r.height ? cv.height / r.height : 1
  return [(e.clientX - r.left) * sx, (e.clientY - r.top) * sy]
}

function rectsPx(): Rect[] {
  const cv = overlay.value!
  return ps.elements.value.map(el => rectPx(ps.effRect(el), cv.width, cv.height))
}

function livePatchRect(id: string, e: Rect, refit: boolean) {
  try {
    const doc = frontFrame()?.contentDocument
    if (!doc) return
    const key = (window.CSS && CSS.escape) ? CSS.escape(id) : id
    const el = doc.querySelector(`.pm-el[data-el="${key}"]`) as HTMLElement | null
    if (!el) return
    el.style.left = `${(e.x * 100).toFixed(3)}%`
    el.style.top = `${(e.y * 100).toFixed(3)}%`
    el.style.width = `${(e.w * 100).toFixed(3)}%`
    el.style.height = `${(e.h * 100).toFixed(3)}%`
    if (refit) {
      const fit = (frontFrame()?.contentWindow as any)?.__pmFit
      if (typeof fit === 'function') fit()
    }
  } catch {}
}

function livePatchImg(id: string) {
  try {
    const doc = frontFrame()?.contentDocument
    if (!doc) return
    const el = ps.elements.value.find(x => x.id === id)
    if (!el) return
    const key = (window.CSS && CSS.escape) ? CSS.escape(id) : id
    const im = doc.querySelector(`.pm-el[data-el="${key}"] img`) as HTMLElement | null
    if (!im) return
    const p = ps.elementImageProps(el)
    im.style.transform =
      `translate(${(p.x * 100).toFixed(3)}%,${(p.y * 100).toFixed(3)}%) scale(${p.scale})`
  } catch {}
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  closeInline(true)
  picker.value = null
  const cv = overlay.value!
  const [px, py] = evXY(e)
  const editEl = ps.imgEditId.value
    ? ps.elements.value.find(el => el.id === ps.imgEditId.value)
    : null
  if (editEl) {
    const r = rectPx(ps.effRect(editEl), cv.width, cv.height)
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
      e.preventDefault()
      cv.setPointerCapture(e.pointerId)
      ps.selectOnly(ps.elements.value.indexOf(editEl))
      ps.startImgDrag(editEl, r.w, r.h, px, py)
      cv.style.cursor = 'grabbing'
      drawOverlay()
      return
    }
  }
  if (ps.selectedIds.value.length === 1 && ps.activeElement.value) {
    const t = elTransformPx(ps.activeElement.value)
    const rp = handlePos(t, 'rotate')
    if (Math.hypot(px - rp.x, py - rp.y) <= HANDLE + 2) {
      e.preventDefault()
      cv.setPointerCapture(e.pointerId)
      rotDrag.value = {
        id: ps.activeElement.value.id,
        baseDeg: ps.elementRot(ps.activeElement.value),
        grab: angleTo(t, { x: px, y: py }),
      }
      return
    }
  }
  const singleActive = ps.selectedIds.value.length === 1 ? ps.activeIdx.value : -1
  const hit = hitTest(px, py, rectsPx(), singleActive, HANDLE)
  if (!hit) {
    ps.imgEditId.value = null
    const gi = guideHitIndex(px, py)
    if (gi >= 0 && !e.shiftKey) {
      e.preventDefault()
      cv.setPointerCapture(e.pointerId)
      guideDrag.value = { index: gi }
      return
    }
    if (!e.shiftKey) {
      ps.clearSelection()
      e.preventDefault()
      cv.setPointerCapture(e.pointerId)
      marquee.value = { x0: px, y0: py, x1: px, y1: py }
    }
    drawOverlay()
    return
  }
  if (e.shiftKey) {
    e.preventDefault()
    ps.toggleSelect(hit.idx)
    drawOverlay()
    return
  }
  e.preventDefault()
  cv.setPointerCapture(e.pointerId)
  try { stageWrap.value?.focus({ preventScroll: true }) } catch {}
  ps.startDrag(hit, px / cv.width, py / cv.height)
  drawOverlay()
}

function onPointerMove(e: PointerEvent) {
  const cv = overlay.value!
  const [px, py] = evXY(e)
  if (rotDrag.value) {
    const d = rotDrag.value
    const el = ps.elements.value.find(x => x.id === d.id)
    if (!el) return
    const t = elTransformPx(el)
    let deg = d.baseDeg + (angleTo(t, { x: px, y: py }) - d.grab) * 180 / Math.PI
    if (e.shiftKey) deg = Math.round(deg / 15) * 15
    deg = ((deg % 360) + 360) % 360
    if (deg > 180) deg -= 360
    ps.setRect(d.id, { rot: Math.round(deg * 10) / 10 })
    livePatchRotate(d.id, ps.elementRot(el))
    drawOverlay()
    return
  }
  if (guideDrag.value) {
    const g = ps.guides.value[guideDrag.value.index]
    if (g) {
      ps.setGuidePos(guideDrag.value.index,
        g.axis === 'x' ? px / cv.width : py / cv.height)
      drawOverlay()
    }
    return
  }
  if (marquee.value) {
    marquee.value = { ...marquee.value, x1: px, y1: py }
    drawOverlay()
    return
  }
  if (ps.imgDrag.id) {
    ps.moveImgDrag(px, py)
    livePatchImg(ps.imgDrag.id)
    return
  }
  if (!ps.drag.mode) {
    if (ps.imgEditId.value) {
      const el = ps.elements.value.find(x => x.id === ps.imgEditId.value)
      if (el) {
        const r = rectPx(ps.effRect(el), cv.width, cv.height)
        if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
          cv.style.cursor = 'grab'
          return
        }
      }
    }
    const singleActive = ps.selectedIds.value.length === 1 ? ps.activeIdx.value : -1
    cv.style.cursor = cursorFor(hitTest(px, py, rectsPx(), singleActive, HANDLE))
    return
  }
  const rects = ps.moveDrag(
    px / cv.width, py / cv.height, e.altKey,
    SNAP_PX / cv.width, SNAP_PX / cv.height,
  )
  for (const r of rects) livePatchRect(r.id, r.rect, ps.drag.mode !== 'move')
  drawOverlay()
}

function onPointerUp(e: PointerEvent) {
  const cv = overlay.value
  try { cv?.releasePointerCapture(e.pointerId) } catch {}
  if (rotDrag.value) {
    rotDrag.value = null
    ps.commitLayout()
    ps.scheduleRefresh(0)
    drawOverlay()
    return
  }
  if (guideDrag.value) {
    const idx = guideDrag.value.index
    guideDrag.value = null
    const [px, py] = cv ? evXY(e) : [0, 0]
    if (cv && (px < -8 || py < -8 || px > cv.width + 8 || py > cv.height + 8)) {
      ps.removeGuide(idx)
    } else {
      ps.commitLayout()
    }
    drawOverlay()
    return
  }
  if (marquee.value) {
    const m = marquee.value
    marquee.value = null
    if (cv && (Math.abs(m.x1 - m.x0) > 4 || Math.abs(m.y1 - m.y0) > 4)) {
      ps.selectRegion({
        x: Math.min(m.x0, m.x1) / cv.width,
        y: Math.min(m.y0, m.y1) / cv.height,
        w: Math.abs(m.x1 - m.x0) / cv.width,
        h: Math.abs(m.y1 - m.y0) / cv.height,
      })
    }
    drawOverlay()
    return
  }
  if (ps.imgDrag.id) {
    ps.endImgDrag()
    if (cv) cv.style.cursor = 'grab'
    return
  }
  if (ps.drag.mode) {
    ps.endDrag()
    drawOverlay()
  }
}

function onDblClick(e: MouseEvent) {
  const cv = overlay.value!
  const [px, py] = evXY(e)
  const hit = hitTest(px, py, rectsPx(), ps.activeIdx.value, HANDLE)
  if (!hit) return
  const el = ps.elements.value[hit.idx]
  if (!el) return
  ps.selectOnly(hit.idx)
  if (el.type === 'text') {
    openInline(el, 'literal', 0)
  } else if (el.type === 'bars' || el.type === 'tree') {
    openInline(el, 'data', 0)
  } else if (el.type === 'cell') {
    const r = rectPx(ps.effRect(el), cv.width, cv.height)
    const capZone = Math.max(18, r.h * 0.22)
    if (py >= r.y + r.h - capZone) {
      const m = /cell(\d+)/.exec(el.id)
      openInline(el, 'label', m ? parseInt(m[1]!, 10) : 0)
    } else {
      openSlotPicker(el, px, py)
    }
  } else if (el.type === 'image') {
    openSlotPicker(el, px, py)
  } else if (el.type === 'shape') {
    openShapePicker(el, px, py)
  }
}

function onKeydown(e: KeyboardEvent) {
  if (inline.value || !ps.selectedIds.value.length) return
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    e.stopPropagation()
    ps.deleteActive()
    drawOverlay()
  }
}

function openInline(el: PosterElement, kind: 'literal' | 'data' | 'label', refIndex: number) {
  const cv = overlay.value!
  const r = rectPx(ps.effRect(el), cv.width, cv.height)
  let initial = ''
  if (kind === 'literal') {
    initial = String(elementProp(el, ps.layout.value, 'text', el.text ?? ''))
  } else if (kind === 'data') {
    initial = String(elementProp(el, ps.layout.value, 'data', el.data ?? ''))
  } else {
    const lines = ps.gridLabels().replace(/\r\n/g, '\n').split('\n')
    initial = lines[refIndex] ?? (el.label || '')
  }
  inline.value = { el, kind, refIndex, text: initial, rect: r }
  void nextTick(() => {
    inlineTa.value?.focus()
    inlineTa.value?.select()
  })
}

function closeInline(commit: boolean) {
  const box = inline.value
  if (!box) return
  inline.value = null
  if (!commit) return
  if (box.kind === 'literal') {
    ps.setRect(box.el.id, { text: box.text })
    ps.commitLayout()
    ps.scheduleRefresh(0)
  } else if (box.kind === 'data') {
    ps.setRect(box.el.id, { data: box.text })
    ps.commitLayout()
    ps.scheduleRefresh(0)
  } else {
    ps.setGridLabelLine(box.refIndex, box.text)
  }
}

function onInlineKeydown(e: KeyboardEvent) {
  e.stopPropagation()
  const multi = inline.value?.kind !== 'label'
  if (e.key === 'Escape') {
    e.preventDefault()
    closeInline(false)
  } else if (e.key === 'Enter' && (!multi || e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    closeInline(true)
  }
}

function openSlotPicker(el: PosterElement, px: number, py: number) {
  const cur = ps.slotOf(el)
  const cellCount = ps.elements.value.filter(e => e.type === 'cell' || e.type === 'image').length
  const k = Math.min(99, Math.max(ps.connectedImages(), cellCount, cur + 1, 1))
  const options = []
  for (let i = 0; i < k; i++) {
    options.push({
      key: `s${i}`,
      label: t('poster.slotN', { n: i }) + (i === cur ? ' ✓' : ''),
      active: i === cur,
      onPick: () => { ps.setSlot(el, i); drawOverlay() },
    })
  }
  picker.value = {
    title: t('poster.slotTitle', { label: el.label || el.id }),
    x: Math.min(px + view.value.offX, Math.max(0, view.value.cw - 130)),
    y: Math.min(py + view.value.offY, Math.max(0, view.value.ch - 40)),
    options,
  }
}

function openShapePicker(el: PosterElement, px: number, py: number) {
  const cur = {
    shape: String(elementProp(el, ps.layout.value, 'shape', 'rect')),
    fill: String(elementProp(el, ps.layout.value, 'fill', 'none')),
    stroke: String(elementProp(el, ps.layout.value, 'stroke', 'primary')),
  }
  const mk = (key: string, label: string, active: boolean, patch: Record<string, unknown>) => ({
    key, label: label + (active ? ' ✓' : ''), active,
    onPick: () => {
      ps.setRect(el.id, patch)
      ps.commitLayout()
      ps.scheduleRefresh(0)
      drawOverlay()
    },
  })
  picker.value = {
    title: t('poster.shapeTitle'),
    x: Math.min(px + view.value.offX, Math.max(0, view.value.cw - 140)),
    y: Math.min(py + view.value.offY, Math.max(0, view.value.ch - 40)),
    options: [
      mk('rect', t('poster.shapeRect'), cur.shape === 'rect', { shape: 'rect' }),
      mk('ellipse', t('poster.shapeEllipse'), cur.shape === 'ellipse', { shape: 'ellipse' }),
      mk('line', t('poster.shapeLine'), cur.shape === 'line', { shape: 'line' }),
      mk('f-accent', t('poster.fillAccent'), cur.fill === 'accent', { fill: 'accent' }),
      mk('f-primary', t('poster.fillPrimary'), cur.fill === 'primary', { fill: 'primary' }),
      mk('f-bg', t('poster.fillBg'), cur.fill === 'bg', { fill: 'bg' }),
      mk('f-none', t('poster.fillNone'), cur.fill === 'none', { fill: 'none' }),
      mk('s-accent', t('poster.strokeAccent'), cur.stroke === 'accent', { stroke: 'accent' }),
      mk('s-primary', t('poster.strokePrimary'), cur.stroke === 'primary', { stroke: 'primary' }),
      mk('s-none', t('poster.strokeNone'), cur.stroke === 'none', { stroke: 'none' }),
    ],
  }
}

function toggleEdit() {
  ps.editMode.value = !ps.editMode.value
  drawOverlay()
}

function toggleImgEdit() {
  const el = ps.activeElement.value
  if (!el || el.type !== 'image') return
  ps.imgEditId.value = ps.imgEditId.value === el.id ? null : el.id
  drawOverlay()
}

function toggleElFont() {
  ps.setElementProp('font', elProp<string>('font', 'body') === 'title' ? 'body' : 'title')
}

function bumpFontSize(delta: number) {
  const cur = Math.round(Number(elProp('font_size', 32)))
  ps.setElementProp('font_size', Math.max(6, Math.min(400, cur + delta)))
}

function onImgScale(v: number) {
  const el = ps.activeElement.value
  if (!el) return
  ps.setImgScale(el, v)
  livePatchImg(el.id)
}

function onImgScaleCommit() {
  ps.commitLayout()
  ps.scheduleRefresh(0)
}

function onAdd(type: string) {
  addMenuOpen.value = false
  ps.addElement(type)
  drawOverlay()
}

function onSizePreset(label: string) {
  ps.applySizePreset(label)
  sizeTick.value++
  void nextTick(rescale)
}

function onFont(key: 'font_title' | 'font_body', val: string) {
  ps.setFont(key, val === SYSTEM_FONT ? '' : val)
}

watch(() => ps.previewHtml.value + ps.refreshTick.value, () => {
  const back = backFrame()
  if (!back) return
  let done = false
  const finish = () => {
    if (done) return
    done = true
    back.removeEventListener('load', onLoad)
    frontIsA.value = !frontIsA.value
    rescale()
  }
  const onLoad = () => {
    requestAnimationFrame(() => requestAnimationFrame(finish))
  }
  back.addEventListener('load', onLoad)
  back.srcdoc = ps.previewHtml.value
  setTimeout(finish, 1500)
})

watch(() => [ps.editMode.value, ps.activeIdx.value, ps.selectedIds.value, ps.imgEditId.value, ps.elements.value], () => {
  drawOverlay()
}, { deep: false })

async function loadFonts() {
  try {
    const res = await listResources()
    fonts.value = (res.resources || [])
      .filter((r: any) => r.kind === 'font')
      .map((r: any) => String(r.filename))
  } catch {
    fonts.value = []
  }
}

onMounted(() => {
  ro = new ResizeObserver(rescale)
  if (stageWrap.value) ro.observe(stageWrap.value)
  rescale()
  void loadFonts()
  void ps.fetchTemplates()
  void ps.fetchElements()
  void ps.doRefresh()
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
})
</script>
