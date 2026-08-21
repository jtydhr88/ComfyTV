import type { UseStageNodeResult } from '@/composables/stages/useStageNode'
import type { ComfyNode } from '@/lib/comfyApp'
import type { StageKind, StageVariant } from '@/stores/stageStore'

export type V2Shell = (
  node: ComfyNode,
  kind: StageKind,
  variant: StageVariant,
) => UseStageNodeResult

export const V2_SHELLS: Record<string, V2Shell> = {}
