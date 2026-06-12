<template>
  <div ref="canvasRef" class="ctv:relative ctv:block ctv:size-full" />
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
