<template>
  <video :src="url ?? undefined" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useProxiedVideoUrl } from '@/composables/widgets/useProxiedVideoUrl'

const props = defineProps<{
  src: string | null | undefined
}>()

const { url } = useProxiedVideoUrl(computed(() => props.src ?? null))
</script>
