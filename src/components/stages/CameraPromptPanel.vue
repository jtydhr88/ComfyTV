<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-2 ctv:mt-1 ctv:p-2 ctv:rounded ctv:text-xs
              ctv:bg-interface-menu-surface ctv:text-base-foreground
              ctv:border ctv:border-border-default">
    <div class="ctv:grid ctv:grid-cols-2 ctv:gap-1.5">
      <label class="ctv:flex ctv:flex-col ctv:gap-0.5">
        <span :class="labelClass">{{ $t('cameraPrompt.camera') }}</span>
        <ComfyTVSelect :model-value="camera" :options="cameraOptions"
                       @update:model-value="camera = String($event)" />
      </label>
      <label class="ctv:flex ctv:flex-col ctv:gap-0.5">
        <span :class="labelClass">{{ $t('cameraPrompt.lens') }}</span>
        <ComfyTVSelect :model-value="lens" :options="lensOptions"
                       @update:model-value="lens = String($event)" />
      </label>
      <label class="ctv:flex ctv:flex-col ctv:gap-0.5">
        <span :class="labelClass">{{ $t('cameraPrompt.focal') }}</span>
        <ComfyTVSelect :model-value="focal" :options="focalOptions"
                       @update:model-value="focal = String($event)" />
      </label>
      <label class="ctv:flex ctv:flex-col ctv:gap-0.5">
        <span :class="labelClass">{{ $t('cameraPrompt.aperture') }}</span>
        <ComfyTVSelect :model-value="aperture" :options="apertureOptions"
                       @update:model-value="aperture = String($event)" />
      </label>
    </div>

    <div v-if="compiled"
         class="ctv:py-1 ctv:px-1.5 ctv:rounded-sm ctv:text-2xs ctv:leading-snug ctv:font-mono
                ctv:bg-secondary-background ctv:text-muted-foreground ctv:break-words">
      {{ compiled }}
    </div>
    <div v-else class="ctv:text-2xs ctv:italic ctv:text-muted-foreground/60">
      {{ $t('cameraPrompt.empty') }}
    </div>

    <div class="ctv:flex ctv:gap-1.5">
      <button
        type="button"
        :class="insertBtnClass"
        :disabled="!compiled"
        @click="$emit('insert', { camera, lens, focal, aperture })"
      >{{ $t('cameraPrompt.insert') }}</button>
      <button type="button" :class="clearBtnClass" @click="reset">{{ $t('cameraPrompt.clear') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import type { CameraSelection } from '@/composables/stages/cameraControlCatalog'
import { useCameraPrompt } from '@/composables/stages/useCameraPrompt'

defineEmits<{ insert: [selection: CameraSelection] }>()

const {
  camera, lens, focal, aperture, compiled, reset,
  cameras, lenses, focalLengths, apertures,
} = useCameraPrompt()

const NONE = { label: '—', value: '' }
const cameraOptions = [NONE, ...cameras.map(c => ({ label: c.label, value: c.label }))]
const lensOptions = [NONE, ...lenses.map(l => ({ label: l.label, value: l.label }))]
const focalOptions = [NONE, ...focalLengths.map(f => ({ label: f.label, value: String(f.mm) }))]
const apertureOptions = [NONE, ...apertures.map(a => ({ label: a.label, value: a.f }))]

const labelClass = 'ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground'

const BTN_BASE = 'ctv:inline-flex ctv:items-center ctv:justify-center ctv:h-6 ctv:px-2.5 ctv:rounded-sm'
  + ' ctv:text-2xs ctv:font-medium ctv:cursor-pointer ctv:border ctv:[font-family:inherit] ctv:transition-colors'
const insertBtnClass = BTN_BASE
  + ' ctv:bg-primary-background ctv:text-base-foreground ctv:border-transparent'
  + ' ctv:hover:bg-primary-background-hover ctv:disabled:opacity-40 ctv:disabled:cursor-not-allowed'
const clearBtnClass = BTN_BASE
  + ' ctv:bg-secondary-background ctv:text-muted-foreground ctv:border-border-default'
  + ' ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground'
</script>
