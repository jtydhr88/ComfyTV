<template>
  <div class="ctv:mx-2 ctv:border-t ctv:border-[#3d3d3d]" />
  <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
    <span :class="paramLabelClass">{{ $t('pentrado.shapeFill') }}</span>
    <input
      type="checkbox"
      class="ctv:accent-[#1473e6]"
      :checked="!!active.fill"
      @change="panel.onVectorFillToggle"
    />
    <input
      type="color"
      :disabled="!active.fill"
      :class="colorInputClass"
      :value="active.fill?.color ?? '#3b82f6'"
      @input="(e) => panel.onVectorFillColor((e.target as HTMLInputElement).value)"
    />
  </div>
  <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
    <span :class="paramLabelClass">{{ $t('pentrado.shapeStroke') }}</span>
    <input
      type="checkbox"
      class="ctv:accent-[#1473e6]"
      :checked="!!active.stroke"
      @change="panel.onVectorStrokeToggle"
    />
    <input
      type="color"
      :disabled="!active.stroke"
      :class="colorInputClass"
      :value="active.stroke?.color ?? '#ffffff'"
      @input="(e) => panel.onVectorStrokeColor((e.target as HTMLInputElement).value)"
    />
    <input
      type="range" min="1" max="100" step="1"
      :disabled="!active.stroke"
      class="ctv:flex-1 ctv:accent-[#1473e6] ctv:cursor-pointer ctv:disabled:opacity-30"
      :value="active.stroke?.width ?? 4"
      @input="(e) => panel.onVectorStrokeWidth(Number((e.target as HTMLInputElement).value))"
    />
    <span :class="paramValueClass">
      {{ active.stroke?.width ?? 4 }}
    </span>
  </div>
</template>

<script setup lang="ts">
import type { useLayerListPanel } from '../useLayerListPanel'
import type { VectorData } from '../../engine'
import { colorInputClass, paramLabelClass, paramValueClass } from './panelClasses'

type PanelApi = ReturnType<typeof useLayerListPanel>

defineProps<{
  active: VectorData
  panel: Pick<PanelApi, 'onVectorFillToggle' | 'onVectorFillColor' | 'onVectorStrokeToggle' | 'onVectorStrokeColor' | 'onVectorStrokeWidth'>
}>()
</script>
