<template>
  <div :class="dividerClass" />
  <div :class="segGroupClass">
    <button
      v-for="a in ARRANGE_ACTIONS"
      :key="a.op"
      type="button"
      :class="segBtnClass(false)"
      :disabled="a.needsThree && editor.selectedIdList.value.length < 3"
      :title="$t(a.labelKey)"
      @click="editor.arrangeSelected(a.op)"
    >
      <component :is="a.icon" class="ctv:size-3.5 ctv:disabled:opacity-30" />
    </button>
  </div>
</template>

<script setup lang="ts">
import IconAlignStartVertical from '~icons/lucide/align-start-vertical'
import IconAlignCenterVertical from '~icons/lucide/align-center-vertical'
import IconAlignEndVertical from '~icons/lucide/align-end-vertical'
import IconAlignStartHorizontal from '~icons/lucide/align-start-horizontal'
import IconAlignCenterHorizontal from '~icons/lucide/align-center-horizontal'
import IconAlignEndHorizontal from '~icons/lucide/align-end-horizontal'
import IconDistributeH from '~icons/lucide/align-horizontal-distribute-center'
import IconDistributeV from '~icons/lucide/align-vertical-distribute-center'
import IconSpaceH from '~icons/lucide/align-horizontal-space-between'
import IconSpaceV from '~icons/lucide/align-vertical-space-between'

import type { LayerEditorController } from '../useLayerEditorStage'
import type { ArrangeOp } from '../../engine'
import { dividerClass, segBtnClass, segGroupClass } from './toolbarClasses'

const props = defineProps<{
  editor: LayerEditorController
}>()

const editor = props.editor

const ARRANGE_ACTIONS: Array<{ op: ArrangeOp; labelKey: string; icon: unknown; needsThree?: boolean }> = [
  { op: 'left', labelKey: 'pentrado.arrangeLeft', icon: IconAlignStartVertical },
  { op: 'hcenter', labelKey: 'pentrado.arrangeHCenter', icon: IconAlignCenterVertical },
  { op: 'right', labelKey: 'pentrado.arrangeRight', icon: IconAlignEndVertical },
  { op: 'top', labelKey: 'pentrado.arrangeTop', icon: IconAlignStartHorizontal },
  { op: 'vcenter', labelKey: 'pentrado.arrangeVCenter', icon: IconAlignCenterHorizontal },
  { op: 'bottom', labelKey: 'pentrado.arrangeBottom', icon: IconAlignEndHorizontal },
  { op: 'hspread', labelKey: 'pentrado.arrangeHSpread', icon: IconDistributeH, needsThree: true },
  { op: 'vspread', labelKey: 'pentrado.arrangeVSpread', icon: IconDistributeV, needsThree: true },
  { op: 'hgap', labelKey: 'pentrado.arrangeHGap', icon: IconSpaceH, needsThree: true },
  { op: 'vgap', labelKey: 'pentrado.arrangeVGap', icon: IconSpaceV, needsThree: true },
]
</script>
