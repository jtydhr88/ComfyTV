<template>
  <video :src="url ?? undefined" data-ctv-media :class="{ 'ctv-alpha-checker': isAlphaSource }" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useProxiedVideoUrl } from '@/composables/widgets/useProxiedVideoUrl'

const props = defineProps<{
  src: string | null | undefined
}>()

const { url } = useProxiedVideoUrl(computed(() => props.src ?? null), { autoBuild: true })

const isAlphaSource = computed(() =>
  /\.webm([?&#]|$)/i.test(props.src ?? '')
  || /filename=[^&]*\.webm/i.test(props.src ?? ''))
</script>

<style scoped>
.ctv-alpha-checker {
  background-image:
    linear-gradient(45deg, #333 25%, transparent 25%, transparent 75%, #333 75%),
    linear-gradient(45deg, #333 25%, #222 25%, #222 75%, #333 75%);
  background-size: 16px 16px;
  background-position: 0 0, 8px 8px;
}
</style>
