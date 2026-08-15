<template>

  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:rounded-lg ctv:bg-node-background ctv:p-1.5 ctv:text-xs">
    <div class="ctv:flex ctv:items-center ctv:gap-2">
      <label class="ctv:flex ctv:flex-1 ctv:items-center ctv:gap-1.5">
        <span class="ctv:shrink-0 ctv:text-muted-foreground">{{ $t('scene3d.promptStart') }}</span>
        <ComfyTVNumber
          class="ctv:flex-1 ctv:min-w-0"
          :model-value="strip.range.start"
          :min="0"
          :max="10000"
          :step="1"
          :precision="0"
          :show-buttons="false"
          @update:model-value="(v) => emit('patch', { start: v })"
        />
      </label>
      <label class="ctv:flex ctv:flex-1 ctv:items-center ctv:gap-1.5">
        <span class="ctv:shrink-0 ctv:text-muted-foreground">{{ $t('scene3d.promptEnd') }}</span>
        <ComfyTVNumber
          class="ctv:flex-1 ctv:min-w-0"
          :model-value="strip.range.end"
          :min="1"
          :max="10000"
          :step="1"
          :precision="0"
          :show-buttons="false"
          @update:model-value="(v) => emit('patch', { end: v })"
        />
      </label>
    </div>

    <textarea
      :value="strip.text"
      :placeholder="$t('scene3d.promptPlaceholder')"
      rows="4"
      class="ctv:w-full ctv:resize-y ctv:rounded-lg ctv:border-0 ctv:bg-secondary-background
             ctv:px-2 ctv:py-1.5 ctv:text-xs ctv:text-base-foreground ctv:outline-none ctv:[font-family:inherit]"
      @change="onTextChange"
    />
  </div>
</template>

<script setup lang="ts">

import ComfyTVNumber from '@/components/widgets/ComfyTVNumber.vue'
import type { ScenePromptStrip } from '@/widgets/three/scene3d/types'

defineProps<{
  strip: ScenePromptStrip
}>()

const emit = defineEmits<{
  patch: [patch: { start?: number | null; end?: number | null; text?: string }]
}>()

function onTextChange(event: Event): void {
  emit('patch', { text: (event.target as HTMLTextAreaElement).value })
}
</script>
