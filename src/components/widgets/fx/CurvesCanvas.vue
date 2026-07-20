<template>
  <canvas
    ref="cv"
    :width="W" :height="H"
    class="ctv:w-full ctv:rounded ctv:cursor-crosshair ctv:touch-none ctv:border ctv:border-border-subtle ctv:bg-black/60"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @contextmenu.stop.prevent="onRightClick"
  />
</template>

<script setup lang="ts">
import { ref, toRef } from 'vue'
import { CURVES_H, CURVES_W } from '@/composables/widgets/fx/curvesMath'
import { useCurvesCanvas } from '@/composables/widgets/fx/useCurvesCanvas'

const props = withDefaults(defineProps<{
  modelValue: [number, number][]
  color?: string
}>(), { color: '#e0e0e0' })

const emit = defineEmits<{ 'update:modelValue': [v: [number, number][]] }>()

const W = CURVES_W
const H = CURVES_H
const cv = ref<HTMLCanvasElement | null>(null)

const { onDown, onMove, onUp, onRightClick } = useCurvesCanvas({
  canvasEl: cv,
  modelValue: toRef(props, 'modelValue'),
  color: toRef(props, 'color'),
  onChange: (v) => emit('update:modelValue', v),
})
</script>
