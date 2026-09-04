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

    <div class="ctv:mt-auto ctv:flex ctv:flex-col ctv:items-center ctv:gap-0.5 ctv:pt-1" data-testid="pentrado-fgbg">
      <div class="ctv:relative ctv:size-7">
        <input
          v-model="editor.backgroundColor.value"
          type="color"
          data-testid="pentrado-bg-color"
          :title="$t('pentrado.backgroundColor')"
          :class="swatchClass"
          class="ctv:absolute ctv:right-0 ctv:bottom-0"
        />
        <input
          v-model="editor.brushColor.value"
          type="color"
          data-testid="pentrado-fg-color"
          :title="$t('pentrado.foregroundColor')"
          :class="swatchClass"
          class="ctv:absolute ctv:top-0 ctv:left-0 ctv:z-1"
        />
      </div>
      <div class="ctv:flex ctv:gap-0.5">
        <button
          type="button"
          :class="miniColorBtnClass"
          :title="$t('pentrado.swapColors')"
          data-testid="pentrado-swap-colors"
          @click="editor.swapColors()"
        >
          <IconArrowLeftRight class="ctv:size-3" />
        </button>
        <button
          type="button"
          :class="miniColorBtnClass"
          :title="$t('pentrado.resetColors')"
          @click="editor.resetColors()"
        >
          <IconRotateCcw class="ctv:size-3" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconArrowLeftRight from '~icons/lucide/arrow-left-right'
import IconBlend from '~icons/lucide/blend'
import IconBrush from '~icons/lucide/brush'
import IconRotateCcw from '~icons/lucide/rotate-ccw'
import IconCircleDashed from '~icons/lucide/circle-dashed'
import IconEraser from '~icons/lucide/eraser'
import IconFlame from '~icons/lucide/flame'
import IconCrop from '~icons/lucide/crop'
import IconGrid from '~icons/lucide/grid-3x3'
import IconHand from '~icons/lucide/hand'
import IconLasso from '~icons/lucide/lasso'
import IconMousePointer from '~icons/lucide/mouse-pointer-2'
import IconPaintBucket from '~icons/lucide/paint-bucket'
import IconPenTool from '~icons/lucide/pen-tool'
import IconPipette from '~icons/lucide/pipette'
import IconScaling from '~icons/lucide/scaling'
import IconSprayCan from '~icons/lucide/spray-can'
import IconStamp from '~icons/lucide/stamp'
import IconSun from '~icons/lucide/sun'
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
  { id: 'select', labelKey: 'pentrado.toolSelect', icon: IconMousePointer },
  { id: 'transform', labelKey: 'pentrado.toolTransform', icon: IconScaling },
  { id: 'crop', labelKey: 'pentrado.toolCrop', icon: IconCrop },
  { id: 'marquee', labelKey: 'pentrado.toolMarquee', icon: IconSquareDashed },
  { id: 'marquee-ellipse', labelKey: 'pentrado.toolMarqueeEllipse', icon: IconCircleDashed },
  { id: 'lasso', labelKey: 'pentrado.toolLasso', icon: IconLasso },
  { id: 'wand', labelKey: 'pentrado.toolWand', icon: IconWandSparkles },
  { id: 'brush', labelKey: 'pentrado.toolBrush', icon: IconBrush },
  { id: 'eraser', labelKey: 'pentrado.toolEraser', icon: IconEraser },
  { id: 'airbrush', labelKey: 'pentrado.toolAirbrush', icon: IconSprayCan },
  { id: 'smudge', labelKey: 'pentrado.toolSmudge', icon: IconHand },
  { id: 'clone', labelKey: 'pentrado.toolClone', icon: IconStamp },
  { id: 'dodge', labelKey: 'pentrado.toolDodge', icon: IconSun },
  { id: 'burn', labelKey: 'pentrado.toolBurn', icon: IconFlame },
  { id: 'picker', labelKey: 'pentrado.toolPicker', icon: IconPipette },
  { id: 'gradient', labelKey: 'pentrado.toolGradient', icon: IconBlend },
  { id: 'bucket', labelKey: 'pentrado.toolBucket', icon: IconPaintBucket },
  { id: 'shape', labelKey: 'pentrado.toolShape', icon: IconShapes },
  { id: 'pen', labelKey: 'pentrado.toolPen', icon: IconPenTool },
  { id: 'warp', labelKey: 'pentrado.toolWarp', icon: IconGrid },
  { id: 'text', labelKey: 'pentrado.toolText', icon: IconType },
]

const swatchClass =
  'ctv:size-4.5 ctv:cursor-pointer ctv:rounded-xs ctv:border ctv:border-[#161616] ctv:bg-transparent ctv:p-0'

const miniColorBtnClass =
  'ctv:inline-flex ctv:size-4 ctv:items-center ctv:justify-center ctv:rounded ctv:border-0 ' +
  'ctv:bg-transparent ctv:text-[#9b9b9b] ctv:cursor-pointer ctv:hover:text-[#d6d6d6]'

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
