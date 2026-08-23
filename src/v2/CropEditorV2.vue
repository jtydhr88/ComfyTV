<template>
  <div class="v2-crop" @pointerdown.stop>
    <div class="v2-crop__canvas">
      <CropCanvas
        :source-image-url="sourceImageUrl"
        :bounds="bounds"
        @update:bounds="setBounds"
      />
      <div v-if="!sourceImageUrl" class="v2-crop__empty">{{ $t('v2.cropHint') }}</div>
    </div>
    <div class="v2-crop__status">
      <span class="v2-crop__dims">{{ dims }}</span>
      <span class="v2-crop__spacer" />
      <span v-if="computing" class="v2-crop__busy">{{ $t('v2.applying') }}</span>
      <span v-else-if="state.output" class="v2-crop__ok">{{ $t('v2.appliedLive') }}</span>
      <span v-else class="v2-crop__idle">{{ $t('v2.dragToApply') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import CropCanvas from '@/components/widgets/CropCanvas.vue'
import { useCropStage } from '@/composables/stages/useCropStage'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'

const props = defineProps<{
  node: LGraphNode
  state: StageState
}>()

const { sourceImageUrl, bounds, setBounds, computing } = useCropStage(props.node, props.state)

const dims = computed(() => {
  const b = bounds.value
  return b.width > 0 && b.height > 0 ? `${Math.round(b.width)} × ${Math.round(b.height)}` : '—'
})
</script>

<style scoped>
.v2-crop {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
}
.v2-crop__canvas {
  position: relative;
  flex: 1;
  min-height: 0;
  border-radius: 12px;
  overflow: hidden;
  background: var(--v2-media-bg);
  display: flex;
  flex-direction: column;
}
.v2-crop__empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--v2-text-faint);
  font: 500 12px/1.5 system-ui, sans-serif;
  pointer-events: none;
}
.v2-crop__status {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-radius: 14px;
  background: var(--v2-slab-bg);
  border: 1px solid var(--v2-slab-border);
  font: 500 11px/1 system-ui, sans-serif;
  color: var(--v2-text-muted);
}
.v2-crop__dims { color: var(--v2-text-mid); font-variant-numeric: tabular-nums; }
.v2-crop__spacer { flex: 1; }
.v2-crop__busy,
.v2-crop__ok {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--v2-text-muted);
}
.v2-crop__busy::before,
.v2-crop__ok::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--v2-accent);
  box-shadow: 0 0 6px color-mix(in srgb, var(--v2-accent) 70%, transparent);
}
.v2-crop__busy::before { animation: v2croppulse 0.9s ease-in-out infinite; }
@keyframes v2croppulse {
  50% { opacity: 0.35; }
}
</style>
