<template>
  <div class="ctv:mx-2 ctv:border-t ctv:border-[#3d3d3d]" />
  <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
    <span :class="paramLabelClass">{{ $t('pentrado.fillType') }}</span>
    <div class="ctv:min-w-0 ctv:flex-1">
      <ComfyTVSelect
        :model-value="active.fill.type"
        :options="panel.fillTypeOptions.value"
        @update:model-value="(v) => panel.onFillType(v as 'solid' | 'linear' | 'radial')"
      />
    </div>
  </div>
  <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
    <span :class="paramLabelClass">{{ $t('pentrado.fillColors') }}</span>
    <template v-if="active.fill.type === 'solid'">
      <input
        type="color"
        :class="colorInputClass"
        :value="active.fill.color"
        @input="(e) => panel.onFillSolidColor((e.target as HTMLInputElement).value)"
      />
    </template>
    <template v-else>
      <input
        type="color"
        :class="colorInputClass"
        :value="active.fill.stops[0].color"
        @input="(e) => panel.onFillStopColor(0, (e.target as HTMLInputElement).value)"
      />
      <input
        type="color"
        :class="colorInputClass"
        :value="active.fill.stops[active.fill.stops.length - 1].color"
        @input="(e) => panel.onFillStopColor(1, (e.target as HTMLInputElement).value)"
      />
    </template>
  </div>
  <div v-if="active.fill.type === 'linear'" class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
    <span :class="paramLabelClass">{{ $t('pentrado.fillAngle') }}</span>
    <input
      type="range" min="0" max="360" step="1"
      class="ctv:flex-1 ctv:accent-[#1473e6] ctv:cursor-pointer"
      :value="active.fill.angle"
      @input="(e) => panel.onFillAngle(Number((e.target as HTMLInputElement).value))"
    />
    <span :class="paramValueClass">
      {{ Math.round(active.fill.angle) }}°
    </span>
  </div>
  <div v-if="active.fill.type === 'radial'" class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
    <span :class="paramLabelClass">{{ $t('pentrado.fillRadius') }}</span>
    <input
      type="range" min="10" max="200" step="1"
      class="ctv:flex-1 ctv:accent-[#1473e6] ctv:cursor-pointer"
      :value="Math.round(active.fill.radius * 100)"
      @input="(e) => panel.onFillRadius(Number((e.target as HTMLInputElement).value) / 100)"
    />
    <span :class="paramValueClass">
      {{ Math.round(active.fill.radius * 100) }}%
    </span>
  </div>
</template>

<script setup lang="ts">
import ComfyTVSelect from '../../primitives/PSelect.vue'
import type { useLayerListPanel } from '../useLayerListPanel'
import type { FillData } from '../../engine'
import { colorInputClass, paramLabelClass, paramValueClass } from './panelClasses'

type PanelApi = ReturnType<typeof useLayerListPanel>

defineProps<{
  active: FillData
  panel: Pick<PanelApi, 'fillTypeOptions' | 'onFillType' | 'onFillSolidColor' | 'onFillStopColor' | 'onFillAngle' | 'onFillRadius'>
}>()
</script>
