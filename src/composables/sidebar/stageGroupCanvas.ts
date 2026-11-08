import { clientToCanvasPos } from '@/composables/stages/assetLoaderNode'
import { app } from '@/lib/comfyApp'

export const STAGE_GROUP_DRAG_MIME = 'application/x-comfytv-stage-group'

const UID_PROPS = ['comfytv_stage_uid', 'comfytv_stage_uid_at']

export function serializeSelectedStages(): Record<string, unknown> | null {
  const canvas = (app as any)?.canvas
  if (!canvas?.selectedItems?.size) return null
  const data = canvas._serializeItems()
  if (!data?.nodes?.length) return null
  for (const node of data.nodes) {
    for (const key of UID_PROPS) delete node.properties?.[key]
  }
  return data
}

function viewCenter(): [number, number] {
  const rect = (app as any)?.canvas?.canvas?.getBoundingClientRect?.()
  if (!rect) return [0, 0]
  return clientToCanvasPos(rect.left + rect.width / 2, rect.top + rect.height / 2)
}

export function insertStageGroup(data: Record<string, unknown>, pos: [number, number] = viewCenter()): void {
  const canvas = (app as any).canvas
  canvas._deserializeItems(structuredClone(data), { position: pos })
  canvas.setDirty(true, true)
}
