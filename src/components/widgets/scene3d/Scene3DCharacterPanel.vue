<template>

  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:rounded-lg ctv:bg-node-background ctv:p-1.5 ctv:text-xs">

    <label class="ctv:flex ctv:min-w-0 ctv:items-center ctv:gap-1.5">
      <span class="ctv:shrink-0 ctv:text-muted-foreground">{{ $t('scene3d.animationClip') }}</span>
      <ComfyTVSelect
        class="ctv:flex-1 ctv:min-w-0"
        :model-value="character.animation.clip"
        :options="clipNames"
        @update:model-value="(v) => emit('updateAnimation', { clip: String(v) })"
      />
    </label>

    <div class="ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-x-3 ctv:gap-y-1.5">
      <label class="ctv:flex ctv:items-center ctv:gap-1.5">
        <span class="ctv:text-muted-foreground">{{ $t('scene3d.speed') }}</span>
        <input
          type="number"
          min="0.01"
          step="0.1"
          :value="character.animation.speed"
          :class="narrowFieldClass"
          @change="onAnimationNumber('speed', $event)"
        />
      </label>
      <label class="ctv:flex ctv:items-center ctv:gap-1.5">
        <span class="ctv:text-muted-foreground">{{ $t('scene3d.startOffset') }}</span>
        <input
          type="number"
          step="0.1"
          :value="character.animation.startOffset"
          :class="narrowFieldClass"
          @change="onAnimationNumber('startOffset', $event)"
        />
      </label>
      <label class="ctv:flex ctv:items-center ctv:gap-1.5">
        <span class="ctv:text-muted-foreground">{{ $t('scene3d.loop') }}</span>
        <ComfyTVToggle
          :model-value="character.animation.loop"
          @update:model-value="(v) => emit('updateAnimation', { loop: v })"
        />
      </label>
    </div>
    <Scene3DTransformFields
      :transform="character.transform"
      @update-transform="emit('updateTransform', $event)"
    />
    <div v-if="fittable" class="ctv:flex ctv:justify-end">
      <button
        type="button"
        :class="chipBtnClass"
        :title="$t('scene3d.fitToSceneHint')"
        @click="emit('fit')"
      >
        <IconScaling class="ctv:mr-1 ctv:size-3" />
        {{ $t('scene3d.fitToScene') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">

import IconScaling from '~icons/lucide/scaling'

import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import ComfyTVToggle from '@/components/widgets/ComfyTVToggle.vue'
import Scene3DTransformFields from '@/components/widgets/scene3d/Scene3DTransformFields.vue'
import type {
  CharacterAnimationConfig,
  CharacterTransform
} from '@/widgets/three/scene3d/types'

const narrowFieldClass =
  'ctv:w-14 ctv:flex-none ctv:rounded-lg ctv:border-0 ctv:bg-secondary-background ' +
  'ctv:px-2 ctv:py-1 ctv:text-xs ctv:text-base-foreground ctv:outline-none ctv:[font-family:inherit]'

const chipBtnClass =
  'ctv:inline-flex ctv:items-center ctv:cursor-pointer ctv:[font-family:inherit] ' +
  'ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:px-2 ctv:py-0.5 ' +
  'ctv:text-2xs ctv:text-muted-foreground ctv:transition-colors ' +
  'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground'

const { character, clipNames, fittable } = defineProps<{
  character: {
    animation: CharacterAnimationConfig
    transform: CharacterTransform
  }
  clipNames: string[]
  fittable?: boolean
}>()

const emit = defineEmits<{
  updateAnimation: [patch: Partial<CharacterAnimationConfig>]
  updateTransform: [transform: CharacterTransform]
  fit: []
}>()

function onAnimationNumber(field: 'speed' | 'startOffset', event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  emit('updateAnimation', { [field]: value })
}
</script>
