<template>
  <div
    ref="containerRef"
    class="compare"
    @pointerdown.stop
  >
    <template v-if="beforeImage || afterImage">
      <img
        v-if="afterImage"
        :src="afterImage"
        :alt="$t('imageCompare.after')"
        class="layer"
        draggable="false"
        @dragstart.prevent
      />
      <img
        v-if="beforeImage"
        :src="beforeImage"
        :alt="$t('imageCompare.before')"
        class="layer"
        draggable="false"
        :style="hasBoth ? { clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` } : undefined"
        @dragstart.prevent
      />
      <template v-if="hasBoth">
        <div class="divider" :style="{ left: `${sliderPosition}%` }" />
        <div class="handle" :style="{ left: `${sliderPosition}%` }" />
        <span class="tag tag-a">{{ $t('imageCompare.before') }}</span>
        <span class="tag tag-b">{{ $t('imageCompare.after') }}</span>
      </template>
    </template>

    <div v-else class="empty">{{ $t('imageCompare.noImages') }}</div>
  </div>
</template>

<script setup lang="ts">
import { useMouseInElement } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  beforeImage: string | null
  afterImage: string | null
}>()

const containerRef = ref<HTMLElement | null>(null)
const sliderPosition = ref(50)

const hasBoth = computed(() => Boolean(props.beforeImage && props.afterImage))

const { elementX, elementWidth, isOutside } = useMouseInElement(containerRef)
watch([elementX, elementWidth, isOutside], ([x, width, outside]) => {
  if (!outside && width > 0) {
    sliderPosition.value = Math.max(0, Math.min(100, (x / width) * 100))
  }
})
</script>

<style scoped>
.compare {
  position: relative;
  width: 100%;
  height: 320px;
  background: #0a0a0f;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: ew-resize;
}
.layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
}
.divider {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.6);
  pointer-events: none;
  z-index: 5;
}
.handle {
  position: absolute;
  top: 50%;
  width: 24px;
  height: 24px;
  transform: translate(-50%, -50%);
  border: 2px solid #fff;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(2px);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  pointer-events: none;
  z-index: 6;
}
.tag {
  position: absolute;
  top: 8px;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.3px;
  pointer-events: none;
  z-index: 7;
}
.tag-a { left: 8px; }
.tag-b { right: 8px; }
.empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  text-align: center;
  padding: 0 16px;
}
</style>
