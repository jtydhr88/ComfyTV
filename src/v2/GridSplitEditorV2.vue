<template>
  <div class="v2-ed" @pointerdown.stop>
    <div ref="containerEl" class="v2-ed__canvas">
      <div class="v2-ed__fit">
        <img
          v-if="sourceImageUrl"
          ref="imgEl"
          :src="sourceImageUrl"
          draggable="false"
          @load="onImgLoad"
          @dragstart.prevent
        />
      </div>
      <div v-if="sourceImageUrl" class="v2-grid__overlay">
        <div v-for="(style, i) in vBands" :key="`v${i}`" class="v2-grid__band" :style="style" />
        <div v-for="(style, i) in hBands" :key="`h${i}`" class="v2-grid__band" :style="style" />
      </div>
      <div v-if="!sourceImageUrl" class="v2-ed__empty">{{ $t('gridSplit.connectImage') }}</div>
    </div>

    <div class="v2-ed__panel">
      <div class="v2-ed__chips">
        <button
          v-for="p in PRESETS"
          :key="p.label"
          type="button"
          class="v2-ed__chip"
          :data-on="rows === p.r && cols === p.c ? '1' : ''"
          @click="setGrid(p.r, p.c)"
        >{{ p.label }}</button>
      </div>
      <div class="v2-ed__chips">
        <div v-for="ctl in controls" :key="ctl.label" class="v2-ed__step">
          <span class="v2-ed__label">{{ ctl.label }}</span>
          <span class="v2-ed__stepval">{{ ctl.value }}</span>
          <button type="button" class="v2-ed__stepbtn" @click="ctl.dec()">−</button>
          <button type="button" class="v2-ed__stepbtn" @click="ctl.inc()">+</button>
        </div>
      </div>
      <div class="v2-ed__chips">
        <button
          type="button"
          class="v2-ed__chip"
          :data-on="outerBorder ? '1' : ''"
          @click="setOuterBorder(!outerBorder)"
        >{{ $t('gridSplit.outerBorder') }}</button>
      </div>
    </div>

    <div class="v2-ed__status">
      <span class="v2-ed__dims">{{ rows }} × {{ cols }}</span>
      <span class="v2-ed__spacer" />
      <span v-if="!sourceImageUrl">{{ $t('gridSplit.connectImage') }}</span>
      <span v-else-if="splitting" class="v2-ed__busy">{{ $t('gridSplit.splitting', { n: rows * cols }) }}</span>
      <span v-else-if="state.output" class="v2-ed__ok">{{ $t('gridSplit.done', { n: rows * cols }) }}</span>
      <span v-else>{{ $t('gridSplit.pickGrid') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useElementSize } from '@vueuse/core'

import { displayedImageRect, dividerBands, useGridSplit } from '@/composables/stages/useGridSplit'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'

const BORDER_STEP = 2

const PRESETS = [
  { label: '1×2', r: 1, c: 2 },
  { label: '2×1', r: 2, c: 1 },
  { label: '2×2', r: 2, c: 2 },
  { label: '2×3', r: 2, c: 3 },
  { label: '3×3', r: 3, c: 3 },
] as const

const props = defineProps<{
  node: LGraphNode
  state: StageState
}>()

const { sourceImageUrl, rows, cols, setGrid, border, setBorder,
        outerBorder, setOuterBorder, splitting } =
  useGridSplit(props.node, props.state)

const controls = computed(() => [
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

const displayed = computed(() =>
  displayedImageRect(natW.value, natH.value, contW.value, contH.value))

const vBands = computed(() => {
  const d = displayed.value
  if (!d) return []
  return dividerBands('v', d, natW.value, cols.value, border.value, outerBorder.value)
})

const hBands = computed(() => {
  const d = displayed.value
  if (!d) return []
  return dividerBands('h', d, natH.value, rows.value, border.value, outerBorder.value)
})
</script>

<style scoped>
.v2-grid__overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.v2-grid__band {
  position: absolute;
  background: rgba(167, 139, 250, 0.75);
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.7);
}
</style>
