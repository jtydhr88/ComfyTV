<template>
  <canvas
    ref="cv"
    :width="W" :height="H"
    class="ctv:w-full ctv:rounded ctv:cursor-crosshair ctv:touch-none ctv:border ctv:border-border-subtle ctv:bg-black/60"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @wheel.prevent="onWheel"
    @dblclick="onDbl"
  />
</template>

<script lang="ts">
export type { EqBand } from '@/composables/widgets/fx/eqMath'
</script>

<script setup lang="ts">
import { ref, toRef } from 'vue'
import { EQ_H, EQ_W, type EqBand } from '@/composables/widgets/fx/eqMath'
import { useEqGraph } from '@/composables/widgets/fx/useEqGraph'

const props = defineProps<{ modelValue: EqBand[] }>()
const emit = defineEmits<{ 'update:modelValue': [v: EqBand[]] }>()

const W = EQ_W
const H = EQ_H
const cv = ref<HTMLCanvasElement | null>(null)

const { onDown, onMove, onUp, onWheel, onDbl } = useEqGraph({
  canvasEl: cv,
  modelValue: toRef(props, 'modelValue'),
  onChange: (v) => emit('update:modelValue', v),
})
</script>
