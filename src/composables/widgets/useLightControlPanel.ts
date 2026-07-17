import { computed } from 'vue'

import {
  lightPositionApplies,
  targetApplies,
  type LightTransformGizmoMode,
} from '@/widgets/three/light/LightBallWidget'
import type { LightInfoEntry } from '@/widgets/three/light/types'

export interface TransformModeOption {
  value: LightTransformGizmoMode
  labelKey: string
  enabled: boolean
}

export function selectedLightAt(
  lights: LightInfoEntry[],
  index: number,
): LightInfoEntry | null {
  return lights[index] ?? null
}

export function transformModeOptions(selected: LightInfoEntry | null): TransformModeOption[] {
  return [
    {
      value: 'none',
      labelKey: 'lightBall.transformNone',
      enabled: true,
    },
    {
      value: 'light-position',
      labelKey: 'lightBall.transformPosition',
      enabled: selected !== null && lightPositionApplies(selected.type),
    },
    {
      value: 'target',
      labelKey: 'lightBall.transformTarget',
      enabled: selected !== null && targetApplies(selected.type),
    },
  ]
}

export function parseLightNumber(raw: string): number | null {
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

export function useLightControlPanel(props: {
  lights: LightInfoEntry[]
  selectedIndex: number
}) {
  const selectedLight = computed(() => selectedLightAt(props.lights, props.selectedIndex))
  const transformOptions = computed(() => transformModeOptions(selectedLight.value))
  return { selectedLight, transformOptions }
}
