<template>
  <div @contextmenu.prevent
    class="ctv:flex ctv:w-9 ctv:shrink-0 ctv:flex-col ctv:items-center ctv:gap-px ctv:rounded-md
           ctv:border ctv:border-[#161616] ctv:bg-[#2b2b2b] ctv:py-1"
  >
    <button
      v-for="option in TOOL_OPTIONS"
      :key="option.id"
      type="button"
      :class="stripBtnClass(editor.tool.value === option.id)"
      :aria-pressed="editor.tool.value === option.id"
      :title="$t(option.labelKey)"
      @click="editor.tool.value = option.id"
    >
      <component :is="option.icon" class="ctv:size-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import IconBrush from '~icons/lucide/brush'
import IconCircleDashed from '~icons/lucide/circle-dashed'
import IconEraser from '~icons/lucide/eraser'
import IconGrid from '~icons/lucide/grid-3x3'
import IconLasso from '~icons/lucide/lasso'
import IconMousePointer from '~icons/lucide/mouse-pointer-2'
import IconPaintBucket from '~icons/lucide/paint-bucket'
import IconScaling from '~icons/lucide/scaling'
import IconWandSparkles from '~icons/lucide/wand-sparkles'
import IconShapes from '~icons/lucide/shapes'
import IconSquareDashed from '~icons/lucide/square-dashed'
import IconType from '~icons/lucide/type'

import type { LayerEditorController } from './useLayerEditorStage'
import type { ToolId } from '../types'

const props = defineProps<{
  editor: LayerEditorController
}>()

const editor = props.editor

const TOOL_OPTIONS: Array<{ id: ToolId; labelKey: string; icon: unknown }> = [
  { id: 'select', labelKey: 'pictor.toolSelect', icon: IconMousePointer },
  { id: 'transform', labelKey: 'pictor.toolTransform', icon: IconScaling },
  { id: 'marquee', labelKey: 'pictor.toolMarquee', icon: IconSquareDashed },
  { id: 'marquee-ellipse', labelKey: 'pictor.toolMarqueeEllipse', icon: IconCircleDashed },
  { id: 'lasso', labelKey: 'pictor.toolLasso', icon: IconLasso },
  { id: 'wand', labelKey: 'pictor.toolWand', icon: IconWandSparkles },
  { id: 'brush', labelKey: 'pictor.toolBrush', icon: IconBrush },
  { id: 'eraser', labelKey: 'pictor.toolEraser', icon: IconEraser },
  { id: 'bucket', labelKey: 'pictor.toolBucket', icon: IconPaintBucket },
  { id: 'shape', labelKey: 'pictor.toolShape', icon: IconShapes },
  { id: 'warp', labelKey: 'pictor.toolWarp', icon: IconGrid },
  { id: 'text', labelKey: 'pictor.toolText', icon: IconType },
]

function stripBtnClass(active: boolean): string {
  return [
    'ctv:inline-flex ctv:size-7 ctv:items-center ctv:justify-center ctv:rounded ctv:border-0',
    'ctv:cursor-pointer ctv:transition-colors',
    active
      ? 'ctv:bg-[#1a1a1a] ctv:text-[#e8e8e8] ctv:shadow-[inset_0_0_0_1px_#0d0d0d]'
      : 'ctv:bg-transparent ctv:text-[#9b9b9b] ctv:hover:bg-[#3a3a3a] ctv:hover:text-[#d6d6d6]',
  ].join(' ')
}
</script>
