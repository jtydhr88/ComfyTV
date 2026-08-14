<template>

  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:rounded-lg ctv:bg-node-background ctv:p-1.5 ctv:text-xs">
    <label class="ctv:flex ctv:items-center ctv:gap-1.5">
      <span class="ctv:shrink-0 ctv:text-muted-foreground">{{ $t('scene3d.shotCamera') }}</span>
      <ComfyTVSelect
        class="ctv:flex-1 ctv:min-w-0"
        :model-value="shot.cameraId"
        :options="cameras"
        @update:model-value="(v) => emit('patch', { cameraId: String(v) })"
      />
    </label>

    <label class="ctv:flex ctv:items-center ctv:gap-1.5">
      <span class="ctv:shrink-0 ctv:text-muted-foreground">{{ $t('scene3d.shotLock') }}</span>
      <ComfyTVSelect
        class="ctv:flex-1 ctv:min-w-0"
        :model-value="shot.lock ?? ''"
        :options="lockOptions"
        @update:model-value="(v) => emit('patch', { lock: String(v) })"
      />
    </label>

    <div class="ctv:flex ctv:items-center ctv:gap-2">
      <label class="ctv:flex ctv:flex-1 ctv:items-center ctv:gap-1.5">
        <span class="ctv:shrink-0 ctv:text-muted-foreground">{{ $t('scene3d.shotDuration') }}</span>
        <ComfyTVNumber
          class="ctv:flex-1 ctv:min-w-0"
          :model-value="shot.durFrames"
          :min="1"
          :max="10000"
          :step="1"
          :precision="0"
          :show-buttons="false"
          @update:model-value="(v) => emit('patch', { durFrames: v })"
        />
      </label>
      <div class="ctv:flex ctv:shrink-0 ctv:gap-1">
        <button
          type="button"
          :class="moveBtnClass"
          :disabled="index <= 0"
          :aria-label="$t('scene3d.shotMoveUp')"
          :title="$t('scene3d.shotMoveUp')"
          @click="emit('move', -1)"
        >
          <IconChevronUp class="ctv:size-3.5" />
        </button>
        <button
          type="button"
          :class="moveBtnClass"
          :disabled="index >= count - 1"
          :aria-label="$t('scene3d.shotMoveDown')"
          :title="$t('scene3d.shotMoveDown')"
          @click="emit('move', 1)"
        >
          <IconChevronDown class="ctv:size-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconChevronUp from '~icons/lucide/chevron-up'

import ComfyTVNumber from '@/components/widgets/ComfyTVNumber.vue'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import type { SceneShotEntry } from '@/widgets/three/scene3d/types'

const props = defineProps<{
  shot: SceneShotEntry
  cameras: Array<{ value: string; label: string }>
  characters: Array<{ value: string; label: string }>
  index: number
  count: number
}>()

const emit = defineEmits<{
  patch: [patch: { cameraId?: string; lock?: string; durFrames?: number | null }]
  move: [delta: number]
}>()

const { t } = useI18n()

const lockOptions = computed(() => [
  { value: '', label: t('scene3d.shotLockNone') },
  ...props.characters
])

const moveBtnClass =
  'ctv:flex ctv:size-6 ctv:cursor-pointer ctv:items-center ctv:justify-center ctv:rounded-md ' +
  'ctv:border-0 ctv:bg-secondary-background ctv:text-muted-foreground ctv:transition-colors ' +
  'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground ctv:disabled:cursor-default ctv:disabled:opacity-40'
</script>
