<template>
  <div class="ctv:flex ctv:flex-col ctv:items-center ctv:gap-0.5 ctv:select-none">
    <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ label }}</span>
    <canvas
      ref="cv"
      :width="size" :height="size"
      class="ctv:rounded-full ctv:cursor-crosshair ctv:touch-none"
      :style="{ width: `${size}px`, height: `${size}px` }"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @dblclick="resetWheel"
    />
    <span class="ctv:text-2xs ctv:font-mono ctv:text-muted-foreground">
      {{ fmtOffset(modelValue.r) }} {{ fmtOffset(modelValue.g) }} {{ fmtOffset(modelValue.b) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, toRef } from 'vue'
import { fmtOffset, type RgbOffsets } from '@/composables/widgets/fx/colorWheelMath'
import { useColorWheel } from '@/composables/widgets/fx/useColorWheel'

const props = withDefaults(defineProps<{
  modelValue: RgbOffsets
  label: string
  size?: number
}>(), { size: 78 })

const emit = defineEmits<{ 'update:modelValue': [v: RgbOffsets] }>()

const cv = ref<HTMLCanvasElement | null>(null)

const { onDown, onMove, onUp } = useColorWheel({
  canvasEl: cv,
  modelValue: toRef(props, 'modelValue'),
  size: toRef(props, 'size'),
  onChange: (v) => emit('update:modelValue', v),
})

function resetWheel() {
  emit('update:modelValue', { r: 0, g: 0, b: 0 })
}
</script>
