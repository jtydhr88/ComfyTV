import { computed } from 'vue'

import { i18n } from '@/i18n'
import type { CameraPresetManifestEntry } from '@/widgets/three/load3d/cameraPresetAssets'
import type { CameraPresetTuning } from '@/widgets/three/load3d/interfaces'
import type {
  CharacterTransform,
  SceneCameraEntry
} from '@/widgets/three/scene3d/types'

export const FREE_PRESET_VALUE = '__free__'

export const OFFSET_AXES = ['x', 'y', 'z'] as const
export type OffsetAxis = (typeof OFFSET_AXES)[number]

export interface CameraPanelEmitters {
  bindPreset: (presetId: string | null) => void
  updateTuning: (tuning: Partial<CameraPresetTuning>) => void
}

export function useScene3dCameraPanel(
  getCamera: () => SceneCameraEntry,
  getPresets: () => CameraPresetManifestEntry[],
  emit: CameraPanelEmitters
) {
  const t = i18n.global.t

  const presetOptions = computed(() => [
    { value: FREE_PRESET_VALUE, label: t('scene3d.freeCamera') },
    ...getPresets().map((preset) => ({
      value: preset.id,
      label: `${preset.category} · ${preset.name}`
    }))
  ])

  const cameraTransform = computed<CharacterTransform>(() => ({
    position: getCamera().transform.position,
    quaternion: getCamera().transform.quaternion,
    scale: { x: 1, y: 1, z: 1 }
  }))

  function onPresetChange(value: string | number): void {
    if (typeof value !== 'string') return
    emit.bindPreset(value === FREE_PRESET_VALUE ? null : value)
  }

  const tuning = computed(() => getCamera().preset?.tuning ?? {})

  function offsetValue(axis: OffsetAxis): number {
    const value = tuning.value.positionOffset?.[axis] ?? 0
    return Math.round(value * 1000) / 1000
  }

  function onOffsetInput(axis: OffsetAxis, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value)
    if (!Number.isFinite(value)) return
    const current = tuning.value.positionOffset ?? { x: 0, y: 0, z: 0 }
    emit.updateTuning({
      positionOffset: { ...current, [axis]: value }
    })
  }

  const tuningSliders = computed(() => [
    {
      key: 'fovScale',
      label: t('scene3d.presetFovScale'),
      value: tuning.value.fovScale ?? 1,
      min: 0.5,
      max: 2,
      step: 0.05,
      format: (v: number) => `${v.toFixed(2)}x`,
      update: (v: number) => emit.updateTuning({ fovScale: v })
    },
    {
      key: 'pathScale',
      label: t('scene3d.presetPathScale'),
      value: tuning.value.pathScale ?? 1,
      min: 0.25,
      max: 4,
      step: 0.05,
      format: (v: number) => `${v.toFixed(2)}x`,
      update: (v: number) => emit.updateTuning({ pathScale: v })
    },
    {
      key: 'yawDegrees',
      label: t('scene3d.presetYaw'),
      value: tuning.value.yawDegrees ?? 0,
      min: -180,
      max: 180,
      step: 1,
      format: (v: number) => `${Math.round(v)}°`,
      update: (v: number) => emit.updateTuning({ yawDegrees: v })
    },
    {
      key: 'rollDegrees',
      label: t('scene3d.presetRoll'),
      value: tuning.value.rollDegrees ?? 0,
      min: -45,
      max: 45,
      step: 1,
      format: (v: number) => `${Math.round(v)}°`,
      update: (v: number) => emit.updateTuning({ rollDegrees: v })
    }
  ])

  function resetTuning(): void {
    emit.updateTuning({
      fovScale: 1,
      pathScale: 1,
      yawDegrees: 0,
      rollDegrees: 0,
      reverse: false,
      positionOffset: { x: 0, y: 0, z: 0 }
    })
  }

  return {
    presetOptions,
    cameraTransform,
    tuning,
    onPresetChange,
    offsetValue,
    onOffsetInput,
    tuningSliders,
    resetTuning
  }
}
