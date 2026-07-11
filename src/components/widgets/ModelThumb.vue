<template>
  <img
    v-if="thumbUrl"
    :src="thumbUrl"
    :alt="alt ?? ''"
    loading="lazy"
    draggable="false"
    class="ctv:size-full ctv:object-cover"
  />
  <div v-else class="ctv:flex ctv:size-full ctv:items-center ctv:justify-center ctv:text-muted-foreground">
    <slot>
      <i class="pi pi-box" />
    </slot>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

import {
  findModelPreviewUrl,
  modelLookupName,
  onModelPreviewChanged,
} from '@/api/nativeAssets'

const props = defineProps<{
  src: string
  alt?: string
}>()

const thumbUrl = ref<string | null>(null)
let resolveSeq = 0

async function resolve(src: string): Promise<void> {
  const mySeq = ++resolveSeq
  const url = src ? await findModelPreviewUrl(src) : null
  if (mySeq !== resolveSeq) return
  thumbUrl.value = url
}

watch(() => props.src, (src) => { void resolve(src) }, { immediate: true })

const stopListening = onModelPreviewChanged((name, url) => {
  if (name === modelLookupName(props.src)) thumbUrl.value = url
})
onBeforeUnmount(() => {
  resolveSeq++
  stopListening()
})
</script>
