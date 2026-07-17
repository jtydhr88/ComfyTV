<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:rounded-lg ctv:bg-node-background ctv:p-1.5 ctv:text-xs">
    <div class="ctv:flex ctv:items-center ctv:gap-1.5">
      <span class="ctv:shrink-0 ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">
        {{ $t('scene3d.cameraPreset') }}
      </span>

      <ComfyTVSelect
        class="ctv:flex-1 ctv:min-w-0"
        :model-value="camera.preset?.presetId ?? FREE_PRESET_VALUE"
        :options="presetOptions"
        :placeholder="$t('scene3d.freeCamera')"
        filterable
        @update:model-value="onPresetChange"
      />
      <button
        type="button"
        :class="iconBtnClass(lookingThrough)"
        :aria-pressed="lookingThrough"
        :title="$t(lookingThrough ? 'scene3d.exitLookThrough' : 'scene3d.lookThrough')"
        @click="emit('toggleView')"
      >
        <IconEyeOff v-if="lookingThrough" class="ctv:size-3.5" />
        <IconEye v-else class="ctv:size-3.5" />
      </button>
    </div>

    <template v-if="camera.preset">
      <label
        v-for="control in tuningSliders"
        :key="control.key"
        class="ctv:flex ctv:items-center ctv:gap-2"
      >
        <span class="ctv:w-20 ctv:shrink-0 ctv:text-2xs ctv:text-muted-foreground">
          {{ control.label }}
        </span>
        <ComfyTVSlider
          class="ctv:flex-1"
          :model-value="control.value"
          :min="control.min"
          :max="control.max"
          :step="control.step"
          @update:model-value="control.update"
        />
        <span class="ctv:w-12 ctv:shrink-0 ctv:text-right ctv:text-2xs ctv:text-muted-foreground">
          {{ control.format(control.value) }}
        </span>
      </label>
      <div class="ctv:flex ctv:items-center ctv:gap-2">
        <span class="ctv:w-20 ctv:shrink-0 ctv:text-2xs ctv:text-muted-foreground">
          {{ $t('scene3d.presetOffset') }}
        </span>
        <label
          v-for="axis in OFFSET_AXES"
          :key="axis"
          class="ctv:flex ctv:flex-1 ctv:min-w-0 ctv:items-center ctv:gap-1"
        >
          <span class="ctv:text-2xs ctv:uppercase ctv:text-muted-foreground">{{ axis }}</span>
          <input
            type="number"
            step="0.1"
            :value="offsetValue(axis)"
            :class="offsetFieldClass"
            @change="onOffsetInput(axis, $event)"
          />
        </label>
      </div>
      <div class="ctv:flex ctv:items-center ctv:gap-2">
        <span class="ctv:w-20 ctv:shrink-0 ctv:text-2xs ctv:text-muted-foreground">
          {{ $t('scene3d.presetReverse') }}
        </span>
        <ComfyTVToggle
          :model-value="camera.preset.tuning.reverse ?? false"
          @update:model-value="(v) => emit('updateTuning', { reverse: v })"
        />
        <div class="ctv:flex-1" />
        <button type="button" :class="chipBtnClass" @click="resetTuning">
          {{ $t('scene3d.resetTuning') }}
        </button>
      </div>
</template>

    
    <template v-else>
      <label class="ctv:flex ctv:items-center ctv:gap-2">
        <span class="ctv:w-20 ctv:shrink-0 ctv:text-2xs ctv:text-muted-foreground">
          {{ $t('scene3d.cameraFov') }}
        </span>
        <ComfyTVSlider
          class="ctv:flex-1"
          :model-value="camera.fov"
          :min="10"
          :max="140"
          :step="1"
          @update:model-value="(v) => emit('setFov', v)"
        />
        <span class="ctv:w-12 ctv:shrink-0 ctv:text-right ctv:text-2xs ctv:text-muted-foreground">
          {{ Math.round(camera.fov) }}°
        </span>
      </label>
      <Scene3DTransformFields
        :transform="cameraTransform"
        hide-scale
        @update-transform="(t) => emit('updateTransform', t)"
      />
</template>
  </div>
</template>

<script setup lang="ts">
import IconEye from '~icons/lucide/eye'
import IconEyeOff from '~icons/lucide/eye-off'

import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import ComfyTVSlider from '@/components/widgets/ComfyTVSlider.vue'
import ComfyTVToggle from '@/components/widgets/ComfyTVToggle.vue'
import Scene3DTransformFields from '@/components/widgets/scene3d/Scene3DTransformFields.vue'
import {
  FREE_PRESET_VALUE,
  OFFSET_AXES,
  useScene3dCameraPanel
} from '@/composables/widgets/useScene3dCameraPanel'
import type { CameraPresetManifestEntry } from '@/widgets/three/load3d/cameraPresetAssets'
import type { CameraPresetTuning } from '@/widgets/three/load3d/interfaces'
import type {
  CharacterTransform,
  SceneCameraEntry
} from '@/widgets/three/scene3d/types'

const { camera, presets } = defineProps<{
  camera: SceneCameraEntry
  presets: CameraPresetManifestEntry[]
  lookingThrough: boolean
}>()

const emit = defineEmits<{
  bindPreset: [presetId: string | null]
  updateTuning: [tuning: Partial<CameraPresetTuning>]
  setFov: [fov: number]
  updateTransform: [transform: CharacterTransform]
  toggleView: []
}>()

const {
  presetOptions,
  cameraTransform,
  onPresetChange,
  offsetValue,
  onOffsetInput,
  tuningSliders,
  resetTuning
} = useScene3dCameraPanel(
  () => camera,
  () => presets,
  {
    bindPreset: (presetId) => emit('bindPreset', presetId),
    updateTuning: (tuning) => emit('updateTuning', tuning)
  }
)

const offsetFieldClass =
  'ctv:w-full ctv:min-w-0 ctv:flex-1 ctv:rounded-lg ctv:border-0 ctv:bg-secondary-background ' +
  'ctv:px-2 ctv:py-1 ctv:text-xs ctv:text-base-foreground ctv:outline-none ctv:[font-family:inherit]'

function iconBtnClass(active: boolean) {
  return (
    'ctv:flex ctv:size-7 ctv:shrink-0 ctv:cursor-pointer ctv:items-center ctv:justify-center ' +
    'ctv:rounded-lg ctv:border-0 ctv:transition-colors ctv:outline-none ' +
    (active
      ? 'ctv:bg-secondary-background-selected ctv:text-base-foreground'
      : 'ctv:bg-secondary-background ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground')
  )
}

const chipBtnClass =
  'ctv:inline-flex ctv:items-center ctv:cursor-pointer ctv:[font-family:inherit] ' +
  'ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:px-2 ctv:py-0.5 ' +
  'ctv:text-2xs ctv:text-muted-foreground ctv:transition-colors ' +
  'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground'
</script>
