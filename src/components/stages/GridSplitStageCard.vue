<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div ref="containerEl"
         class="ctv:relative ctv:w-full ctv:h-[280px] ctv:rounded-md ctv:overflow-hidden ctv:border ctv:border-border-subtle
                ctv:bg-black ctv:flex ctv:items-center ctv:justify-center">
      <div v-if="!sourceImageUrl"
           class="ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:text-white/50">
        <i class="pi pi-th-large ctv:text-[32px] ctv:opacity-60" />
        <div class="ctv:text-xs">{{ $t('gridSplit.connectImage') }}</div>
      </div>
      <template v-else>
        <img
          ref="imgEl"
          :src="sourceImageUrl"
          class="ctv:max-w-full ctv:max-h-full ctv:object-contain ctv:select-none ctv:pointer-events-none"
          draggable="false"
          @load="onImgLoad"
          @dragstart.prevent
        />
        <div class="ctv:absolute ctv:inset-0 ctv:pointer-events-none">
          <div
            v-for="(style, i) in vBands"
            :key="`v${i}`"
            class="ctv:absolute ctv:bg-white/70 ctv:shadow-[0_0_2px_rgb(0_0_0/0.7)]"
            :style="style"
          />
          <div
            v-for="(style, i) in hBands"
            :key="`h${i}`"
            class="ctv:absolute ctv:bg-white/70 ctv:shadow-[0_0_2px_rgb(0_0_0/0.7)]"
            :style="style"
          />
        </div>
      </template>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5">
      <span v-if="!sourceImageUrl" class="ctv:text-muted-foreground">{{ $t('gridSplit.connectImage') }}</span>
      <span v-else-if="splitting" class="ctv:text-muted-foreground">{{ $t('gridSplit.splitting', { n: rows * cols }) }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('gridSplit.done', { n: rows * cols }) }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('gridSplit.pickGrid') }}</span>
    </div>

    <div class="ctv:flex ctv:gap-1 ctv:flex-wrap">
      <button
        v-for="p in PRESETS"
        :key="p.label"
        type="button"
        class="ctv:flex-1 ctv:min-w-[44px] ctv:py-1 ctv:px-1.5 ctv:rounded ctv:text-xs ctv:font-mono ctv:cursor-pointer ctv:border"
        :class="rows === p.r && cols === p.c
          ? 'ctv:bg-secondary-background-selected ctv:border-primary-background ctv:text-primary-background ctv:font-semibold'
          : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:bg-secondary-background-hover'"
        @click="setGrid(p.r, p.c)"
      >{{ p.label }}</button>
    </div>
    <div class="ctv:flex ctv:gap-2">
      <div
        v-for="ctl in CONTROLS"
        :key="ctl.label"
        class="ctv:flex-1 ctv:flex ctv:items-center ctv:gap-1.5 ctv:py-0.5 ctv:px-1.5 ctv:rounded
               ctv:bg-secondary-background ctv:border ctv:border-border-subtle"
      >
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ ctl.label }}</span>
        <button
          type="button"
          class="ctv:size-5 ctv:rounded-sm ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:text-base-foreground ctv:text-[13px] ctv:leading-none ctv:cursor-pointer ctv:hover:bg-secondary-background-hover"
          @click="ctl.dec()"
        >−</button>
        <span class="ctv:ml-auto ctv:min-w-6 ctv:text-center ctv:font-mono ctv:text-xs ctv:text-base-foreground">{{ ctl.value }}</span>
        <button
          type="button"
          class="ctv:size-5 ctv:rounded-sm ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:text-base-foreground ctv:text-[13px] ctv:leading-none ctv:cursor-pointer ctv:hover:bg-secondary-background-hover"
          @click="ctl.inc()"
        >+</button>
      </div>
    </div>
    <label class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:py-0.5 ctv:px-1.5 ctv:rounded ctv:cursor-pointer
                  ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:select-none">
      <input
        type="checkbox"
        class="ctv:cursor-pointer ctv:accent-[var(--primary-background)]"
        :checked="outerBorder"
        @change="setOuterBorder(($event.target as HTMLInputElement).checked)"
      />
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('gridSplit.outerBorder') }}</span>
    </label>

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
import { computed, ref } from 'vue'
import { useElementSize } from '@vueuse/core'

import StageCard from '@/components/stages/StageCard.vue'
import { useGridSplit } from '@/composables/stages/useGridSplit'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'

const BORDER_STEP = 2
const MIN_LINE_PX = 2

const PRESETS = [
  { label: '1×2', r: 1, c: 2 },
  { label: '2×1', r: 2, c: 1 },
  { label: '2×2', r: 2, c: 2 },
  { label: '2×3', r: 2, c: 3 },
  { label: '3×3', r: 3, c: 3 },
] as const

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const { sourceImageUrl, rows, cols, setGrid, border, setBorder,
        outerBorder, setOuterBorder, splitting } =
  useGridSplit(props.node, props.state)

const CONTROLS = computed(() => [
  { label: t('gridSplit.rows'), value: rows.value,
    dec: () => setGrid(rows.value - 1, cols.value), inc: () => setGrid(rows.value + 1, cols.value) },
  { label: t('gridSplit.cols'), value: cols.value,
    dec: () => setGrid(rows.value, cols.value - 1), inc: () => setGrid(rows.value, cols.value + 1) },
  { label: t('gridSplit.border'), value: border.value,
    dec: () => setBorder(border.value - BORDER_STEP), inc: () => setBorder(border.value + BORDER_STEP) },
])

const containerEl = ref<HTMLDivElement | null>(null)
const imgEl = ref<HTMLImageElement | null>(null)
const natW = ref(0)
const natH = ref(0)
const { width: contW, height: contH } = useElementSize(containerEl)

function onImgLoad() {
  if (!imgEl.value) return
  natW.value = imgEl.value.naturalWidth
  natH.value = imgEl.value.naturalHeight
}

const displayed = computed(() => {
  const nw = natW.value, nh = natH.value, cw = contW.value, ch = contH.value
  if (nw <= 0 || nh <= 0 || cw <= 0 || ch <= 0) return null
  const imageAspect = nw / nh
  const containerAspect = cw / ch
  let w: number, h: number
  if (imageAspect > containerAspect) { w = cw; h = cw / imageAspect }
  else { h = ch; w = ch * imageAspect }
  return { w, h, ox: (cw - w) / 2, oy: (ch - h) / 2, scale: w / nw }
})

function dividerCenters(n: number, natSize: number, b: number, o: number): number[] {
  const cell = (natSize - (n - 1 + 2 * o) * b) / n
  const centers: number[] = []
  if (o && b > 0) centers.push(b / 2)
  for (let k = 1; k < n; k++) centers.push(o * b + k * cell + (k - 0.5) * b)
  if (o && b > 0) centers.push(natSize - b / 2)
  return centers
}

const vBands = computed(() => {
  const d = displayed.value
  if (!d) return []
  const b = Math.max(0, border.value)
  const o = outerBorder.value ? 1 : 0
  const thick = Math.max(MIN_LINE_PX, b * d.scale)
  return dividerCenters(cols.value, natW.value, b, o).map(centerNat => ({
    left: `${d.ox + centerNat * d.scale - thick / 2}px`,
    top: `${d.oy}px`,
    width: `${thick}px`,
    height: `${d.h}px`,
  }))
})

const hBands = computed(() => {
  const d = displayed.value
  if (!d) return []
  const b = Math.max(0, border.value)
  const o = outerBorder.value ? 1 : 0
  const thick = Math.max(MIN_LINE_PX, b * d.scale)
  return dividerCenters(rows.value, natH.value, b, o).map(centerNat => ({
    left: `${d.ox}px`,
    top: `${d.oy + centerNat * d.scale - thick / 2}px`,
    width: `${d.w}px`,
    height: `${thick}px`,
  }))
})
</script>
