<template>
  <div class="ctv:mx-2 ctv:border-t ctv:border-[#3d3d3d]" />
  <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
    <span :class="paramLabelClass">{{ $t('pentrado.adjustmentOp') }}</span>
    <div class="ctv:min-w-0 ctv:flex-1">
      <ComfyTVSelect
        :model-value="adj.op"
        :options="adjustOptions"
        @update:model-value="(v) => editor.updateAdjustment(active.id, { op: v as string })"
      />
    </div>
  </div>
  <template v-for="def in adjustParamDefs" :key="def.key">
    <div v-if="def.color" class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
      <span :class="paramLabelClass">{{ $t(`pentrado.adj_${def.key}`) }}</span>
      <input
        type="color"
        :class="colorInputClass"
        :value="adjColorHex(def.key)"
        @input="(e) => onAdjColor(def.key, (e.target as HTMLInputElement).value)"
      />
    </div>
    <FxSlider
      v-else
      class="ctv:px-2 ctv:pt-1"
      :model-value="adj.params[def.key] ?? def.default"
      :label="$t(`pentrado.adj_${def.key}`)"
      :min="def.min"
      :max="def.max"
      :step="def.step ?? (def.max - def.min) / 200"
      :decimals="def.max > 10 ? 0 : 2"
      :reset-to="def.default"
      :gradient="ADJ_GRADIENTS[def.key]"
      @update:model-value="(v) => editor.updateAdjustment(active.id, { params: { [def.key]: v } })"
    />
  </template>

  <template v-if="adj.op === 'curves'">
    <div class="ctv:flex ctv:items-center ctv:gap-0.5 ctv:px-2 ctv:pt-1">
      <button
        v-for="ch in CURVE_CHANNELS"
        :key="ch.id"
        type="button"
        class="ctv:inline-flex ctv:items-center ctv:rounded-sm ctv:border-0 ctv:px-1.5 ctv:py-0.5 ctv:text-[10px]
               ctv:cursor-pointer ctv:[font-family:inherit] ctv:transition-colors"
        :class="curveChannel === ch.id
          ? 'ctv:bg-[#4a4a4a] ctv:text-[#f0f0f0]'
          : 'ctv:bg-transparent ctv:text-[#9b9b9b] ctv:hover:text-[#d6d6d6]'"
        :style="{ color: curveChannel === ch.id ? ch.color : undefined }"
        @click="emit('update:curveChannel', ch.id)"
      >
        {{ $t(`pentrado.curveCh_${ch.id}`) }}
      </button>
    </div>
    <div class="ctv:px-2 ctv:pt-1">
      <CurvesCanvas
        :model-value="curvePoints"
        :color="curveColor"
        @update:model-value="onCurvePoints"
      />
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import ComfyTVSelect from '../../primitives/PSelect.vue'
import CurvesCanvas from '../../primitives/PCurves.vue'
import FxSlider from '../../primitives/PSlider.vue'
import {
  CONTRAST_STOPS,
  CR_STOPS,
  GAMMA_STOPS,
  HUE_STOPS,
  LUMA_STOPS,
  MG_STOPS,
  SAT_STOPS,
  TEMP_KELVIN_STOPS,
  YB_STOPS,
  type ColorStop,
} from '../../primitives/colorStops'
import type { LayerEditorController } from '../useLayerEditorStage'
import type { useLayerListPanel } from '../useLayerListPanel'
import type { SceneNode } from '../../engine'
import { colorInputClass, paramLabelClass } from './panelClasses'

type PanelApi = ReturnType<typeof useLayerListPanel>
type CurveChannel = 'master' | 'red' | 'green' | 'blue'

const props = defineProps<{
  editor: LayerEditorController
  active: SceneNode
  adjustOptions: PanelApi['adjustOptions']['value']
  adjustParamDefs: PanelApi['adjustParamDefs']['value']
  curveChannel: CurveChannel
}>()

const emit = defineEmits<{
  (e: 'update:curveChannel', v: CurveChannel): void
}>()

const editor = props.editor
const adj = computed(() => props.active as any)

function adjColorHex(key: string): string {
  const v = Math.max(0, Math.min(0xffffff, Math.round(adj.value?.params?.[key] ?? 0)))
  return `#${v.toString(16).padStart(6, '0')}`
}
function onAdjColor(key: string, hex: string): void {
  editor.updateAdjustment(props.active.id, { params: { [key]: parseInt(hex.replace('#', ''), 16) } })
}

const ADJ_GRADIENTS: Record<string, ColorStop[]> = {
  brightness: LUMA_STOPS,
  contrast: CONTRAST_STOPS,
  hue: HUE_STOPS,
  saturation: SAT_STOPS,
  lightness: LUMA_STOPS,
  inBlack: LUMA_STOPS,
  inWhite: LUMA_STOPS,
  gamma: GAMMA_STOPS,
  outBlack: LUMA_STOPS,
  outWhite: LUMA_STOPS,
  temperature: TEMP_KELVIN_STOPS,
  exposure: LUMA_STOPS,
  black: LUMA_STOPS,
  shadowsR: CR_STOPS,
  midtonesR: CR_STOPS,
  highlightsR: CR_STOPS,
  shadowsG: MG_STOPS,
  midtonesG: MG_STOPS,
  highlightsG: MG_STOPS,
  shadowsB: YB_STOPS,
  midtonesB: YB_STOPS,
  highlightsB: YB_STOPS,
  amount: SAT_STOPS,
  level: LUMA_STOPS,
}

const CURVE_CHANNELS: Array<{ id: CurveChannel; color: string }> = [
  { id: 'master', color: '#e0e0e0' },
  { id: 'red', color: '#f87171' },
  { id: 'green', color: '#4ade80' },
  { id: 'blue', color: '#60a5fa' },
]
const curveColor = computed(() => CURVE_CHANNELS.find((c) => c.id === props.curveChannel)!.color)
const curvePoints = computed<[number, number][]>(() => {
  void editor.layers.value
  const a = props.active
  if (!a || a.kind !== 'adjustment') return [[0, 0], [1, 1]]
  const raw = (a as { curves?: Record<string, string> }).curves?.[props.curveChannel]
  if (!raw) return [[0, 0], [1, 1]]
  try {
    const parsed = JSON.parse(raw) as [number, number][]
    return Array.isArray(parsed) && parsed.length >= 2 ? parsed : [[0, 0], [1, 1]]
  } catch {
    return [[0, 0], [1, 1]]
  }
})
function onCurvePoints(v: [number, number][]): void {
  editor.updateAdjustment(props.active.id, { curves: { [props.curveChannel]: JSON.stringify(v) } })
}
</script>
