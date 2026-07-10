<template>

  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:rounded-lg ctv:bg-node-background ctv:p-1.5 ctv:text-xs">
    <div class="ctv:flex ctv:items-center ctv:gap-2">
      <span class="ctv:w-14 ctv:shrink-0 ctv:text-muted-foreground">
        {{ $t(`scene3d.${primitive.shape}`) }}
      </span>
      <label class="ctv:flex ctv:items-center ctv:gap-1.5">
        <span class="ctv:text-muted-foreground">{{ $t('scene3d.color') }}</span>
        <input
          type="color"
          :value="primitive.color"
          class="ctv:h-6 ctv:w-8 ctv:cursor-pointer ctv:rounded-md ctv:border-0 ctv:bg-transparent ctv:p-0"
          @input="onColorInput"
        />
      </label>
    </div>
    <Scene3DTransformFields
      :transform="primitive.transform"
      @update-transform="emit('updateTransform', $event)"
    />
  </div>
</template>

<script setup lang="ts">

import Scene3DTransformFields from '@/components/widgets/scene3d/Scene3DTransformFields.vue'
import type {
  CharacterTransform,
  ScenePrimitiveEntry
} from '@/widgets/three/scene3d/types'

const { primitive } = defineProps<{
  primitive: ScenePrimitiveEntry
}>()

const emit = defineEmits<{
  updateColor: [color: string]
  updateTransform: [transform: CharacterTransform]
}>()

function onColorInput(event: Event) {
  emit('updateColor', (event.target as HTMLInputElement).value)
}
</script>
