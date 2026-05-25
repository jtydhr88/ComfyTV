<template>
  <div ref="canvasRef" class="scene-canvas" />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  initScene: (container: HTMLElement) => void
}>()

const canvasRef = ref<HTMLElement>()

onMounted(() => {
  if (canvasRef.value) {
    props.initScene(canvasRef.value)
  }
})
</script>

<style scoped>
.scene-canvas {
  width: 100%;
  height: 100%;
  display: block;
  position: relative;
}
</style>
