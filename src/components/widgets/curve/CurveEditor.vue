<template>
  <svg
    ref="svgRef"
    class="ctv-curve-editor"
    :class="{ 'ctv-curve-disabled': disabled }"
    viewBox="-0.04 -0.04 1.08 1.08"
    preserveAspectRatio="xMidYMid meet"
    @pointerdown.stop="onSvgPointerDown"
    @contextmenu.prevent.stop
  >
    <line
      v-for="v in [0.25, 0.5, 0.75]"
      :key="'h' + v"
      :x1="0" :y1="v" :x2="1" :y2="v"
      stroke="currentColor" stroke-opacity="0.1" stroke-width="0.003"
    />
    <line
      v-for="v in [0.25, 0.5, 0.75]"
      :key="'v' + v"
      :x1="v" :y1="0" :x2="v" :y2="1"
      stroke="currentColor" stroke-opacity="0.1" stroke-width="0.003"
    />
    <line
      x1="0" y1="1" x2="1" y2="0"
      stroke="currentColor" stroke-opacity="0.15" stroke-width="0.003"
    />

    <path
      :d="curvePath"
      fill="none"
      :stroke="curveColor"
      stroke-width="0.008"
      stroke-linecap="round"
      :opacity="disabled ? 0.5 : 1"
    />

    <template v-if="!disabled">
      <circle
        v-for="(point, i) in modelValue"
        :key="i"
        :cx="point[0]"
        :cy="1 - point[1]"
        r="0.02"
        :fill="curveColor"
        stroke="white"
        stroke-width="0.004"
        class="ctv-curve-point"
        @pointerdown.stop="startDrag(i, $event)"
      />
    </template>
  </svg>
</template>

<script setup lang="ts">
import { toRef, useTemplateRef } from 'vue'

import { useCurveEditor } from '@/components/widgets/curve/useCurveEditor'
import type { CurveInterpolation, CurvePoint } from '@/components/widgets/curve/types'

const {
  curveColor = 'white',
  disabled = false,
  interpolation = 'monotone_cubic',
} = defineProps<{
  curveColor?: string
  disabled?: boolean
  interpolation?: CurveInterpolation
}>()

const modelValue = defineModel<CurvePoint[]>({ required: true })

const svgRef = useTemplateRef<SVGSVGElement>('svgRef')

const { curvePath, handleSvgPointerDown, startDrag } = useCurveEditor({
  svgRef,
  modelValue,
  interpolation: toRef(() => interpolation),
})

function onSvgPointerDown(e: PointerEvent) {
  if (!disabled) handleSvgPointerDown(e)
}
</script>

<style scoped>
.ctv-curve-editor {
  aspect-ratio: 1 / 1;
  width: 100%;
  border-radius: 5px;
  background: var(--secondary-background, rgba(255, 255, 255, 0.06));
  color: var(--base-foreground, #fff);
  cursor: crosshair;
  touch-action: none;
}
.ctv-curve-disabled {
  cursor: default;
}
.ctv-curve-point {
  cursor: grab;
}
.ctv-curve-point:active {
  cursor: grabbing;
}
</style>
