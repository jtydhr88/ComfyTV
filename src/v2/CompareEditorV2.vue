<template>
  <div class="v2-ed" @pointerdown.stop>
    <div class="v2-ed__canvas">
      <ImageCompare
        class="v2-cmp__fill"
        :before-image="imageA"
        :after-image="imageB"
      />
      <div v-if="!imageA && !imageB" class="v2-ed__empty">{{ $t('v2.ed.compareHint') }}</div>
    </div>

    <div class="v2-ed__status">
      <span class="v2-ed__dims">A</span>
      <span :class="imageA ? 'v2-ed__ok' : ''">{{ imageA ? $t('v2.ed.wired') : $t('v2.ed.empty') }}</span>
      <span class="v2-ed__spacer" />
      <span class="v2-ed__dims">B</span>
      <span :class="imageB ? 'v2-ed__ok' : ''">{{ imageB ? $t('v2.ed.wired') : $t('v2.ed.empty') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import ImageCompare from '@/components/widgets/ImageCompare.vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'

const props = defineProps<{
  node: LGraphNode
  state: StageState
}>()

function resolvedInput(slot: string): string | null {
  const inp = props.state.inputs.find(i => i.slot === slot)
  if (!inp || inp.source !== 'upstream' || !inp.content) return null
  return inp.content
}

const imageA = computed(() => resolvedInput('image_a'))
const imageB = computed(() => resolvedInput('image_b'))
</script>

<style scoped>
.v2-cmp__fill {
  position: absolute;
  inset: 0;
}
</style>
