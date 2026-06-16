import { computed, ref } from 'vue'

import {
  APERTURES,
  CAMERAS,
  FOCAL_LENGTHS,
  LENSES,
  composeCamera,
} from './cameraControlCatalog'

export function useCameraPrompt() {
  const camera = ref<string>('')
  const lens = ref<string>('')
  const focal = ref<string>('')
  const aperture = ref<string>('')

  const compiled = computed(() => composeCamera({
    camera: camera.value,
    lens: lens.value,
    focal: focal.value,
    aperture: aperture.value,
  }))

  function reset(): void {
    camera.value = ''
    lens.value = ''
    focal.value = ''
    aperture.value = ''
  }

  return {
    camera,
    lens,
    focal,
    aperture,
    compiled,
    reset,
    cameras: CAMERAS,
    lenses: LENSES,
    focalLengths: FOCAL_LENGTHS,
    apertures: APERTURES,
  }
}
