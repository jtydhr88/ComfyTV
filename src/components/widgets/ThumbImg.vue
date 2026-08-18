<template>
  <img :src="displaySrc" @error="onError" />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { thumbUrl } from '@/utils/thumbUrl'

const props = withDefaults(defineProps<{
  src: string | null | undefined
  thumbMax?: number
}>(), { thumbMax: 512 })

const failed = ref(false)
watch(() => props.src, () => { failed.value = false })

const displaySrc = computed(() => {
  const src = props.src ?? ''
  if (!src) return undefined
  return failed.value ? src : thumbUrl(src, props.thumbMax)
})

function onError() {
  if (!failed.value && displaySrc.value !== props.src) failed.value = true
}
</script>
