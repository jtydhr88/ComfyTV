import { computed, ref, watch } from 'vue'

import type { LGraphNode } from '@/lib/comfyApp'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import type { StageState } from '@/stores/stageStore'
import { onNodeConfigure, readWidgetStr, writeWidget } from '@/utils/widget'
import {
  nextPartId,
  parsePartsData,
  serializePartsData,
  type Part,
  type PartBox,
  type PartPoint,
} from '@/widgets/splitpart/types'

const PARTS_WIDGET = 'parts_data'

export function useSplitPartPrompts(node: LGraphNode, state: StageState) {
  const sourceImageUrl = computed(() => pickSourceImageUrl(state.inputs))

  const tool = ref<string>('point-pos')
  const parts = ref<Part[]>(parsePartsData(readWidgetStr(node, PARTS_WIDGET, '')))
  const activePartId = ref<number | null>(null)

  function addPoint(p: PartPoint): void {
    const active = parts.value.find((q) => q.id === activePartId.value)
    if (active && active.kind === 'points') {
      active.points = [...active.points, p]
      parts.value = [...parts.value]
      return
    }
    const id = nextPartId(parts.value)
    parts.value = [...parts.value, { id, kind: 'points', points: [p] }]
    activePartId.value = id
  }

  function addBox(box: PartBox): void {
    const id = nextPartId(parts.value)
    parts.value = [...parts.value, { id, kind: 'box', box }]
    activePartId.value = id
  }

  function startNewGroup(): void {
    activePartId.value = null
    if (tool.value === 'box') tool.value = 'point-pos'
  }

  function removePart(id: number): void {
    parts.value = parts.value.filter((p) => p.id !== id)
    if (activePartId.value === id) activePartId.value = null
  }

  function clearParts(): void {
    parts.value = []
    activePartId.value = null
  }

  watch(parts, (v) => {
    writeWidget(node, PARTS_WIDGET, serializePartsData(v))
  }, { deep: true })

  onNodeConfigure(node, () => {
    parts.value = parsePartsData(readWidgetStr(node, PARTS_WIDGET, ''))
    activePartId.value = null
  })

  return {
    sourceImageUrl,
    tool,
    parts,
    activePartId,
    addPoint,
    addBox,
    startNewGroup,
    removePart,
    clearParts,
  }
}
