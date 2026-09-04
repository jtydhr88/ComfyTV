<template>
  <div @contextmenu.prevent
    class="ctv:flex ctv:h-9 ctv:shrink-0 ctv:items-center ctv:gap-2 ctv:overflow-x-auto ctv:rounded-md
           ctv:border ctv:border-[#161616] ctv:bg-[#2b2b2b] ctv:px-2 ctv:text-[11px] ctv:text-[#9b9b9b]"
  >
    <div class="ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-1 ctv:text-[#d6d6d6]">
      <component :is="activeToolIcon" class="ctv:size-3.5" />
      <span class="ctv:whitespace-nowrap">{{ $t(activeToolLabelKey) }}</span>
    </div>

    <div :class="dividerClass" />

    <ToolBarPaintControls v-if="isPaintTool" :editor="editor" />

    <template v-else-if="isGradientTool">
      <div :class="segGroupClass">
        <button
          v-for="shape in (['linear', 'radial'] as const)"
          :key="shape"
          type="button"
          :class="segBtnClass(editor.gradientShape.value === shape)"
          :aria-pressed="editor.gradientShape.value === shape"
          @click="editor.gradientShape.value = shape"
        >
          {{ $t(`pentrado.gradient_${shape}`) }}
        </button>
      </div>
      <label :class="fieldClass">
        {{ $t('pentrado.brushColor') }}
        <input v-model="editor.brushColor.value" type="color" :class="colorInputClass" />
      </label>
      <label :class="fieldClass">
        <input v-model="editor.gradientToTransparent.value" type="checkbox" />
        {{ $t('pentrado.gradientToTransparent') }}
      </label>
      <label v-if="!editor.gradientToTransparent.value" :class="fieldClass">
        {{ $t('pentrado.backgroundColor') }}
        <input v-model="editor.backgroundColor.value" type="color" :class="colorInputClass" />
      </label>
      <label :class="fieldClass">
        <input v-model="editor.gradientReverse.value" type="checkbox" />
        {{ $t('pentrado.gradientReverse') }}
      </label>
    </template>

    <ToolBarShapeControls
      v-else-if="isShapeTool || isPenTool"
      :editor="editor"
      :is-shape-tool="isShapeTool"
      :is-pen-tool="isPenTool"
    />

    <ToolBarSelectionControls v-else-if="isSelectionTool" :editor="editor" />

    <template v-else-if="isCropTool">
      <span class="ctv:whitespace-nowrap ctv:text-[10px] ctv:text-[#7a7a7a]">
        {{ $t('pentrado.cropHint') }}
      </span>
      <button
        type="button"
        :class="actionBtnClass"
        :disabled="!editor.cropPending.value"
        @click="editor.applyCrop(); editor.tool.value = 'select'"
      >
        <IconCheck class="ctv:size-3.5" />
        {{ $t('pentrado.cropApply') }}
      </button>
      <button
        type="button"
        :class="actionBtnClass"
        :disabled="!editor.cropPending.value"
        @click="editor.cancelCrop()"
      >
        <IconX class="ctv:size-3.5" />
        {{ $t('pentrado.cropCancel') }}
      </button>
    </template>

    <template v-else-if="isTransformTool">
      <button
        type="button"
        :class="actionBtnClass"
        :disabled="!editor.transformDirty.value"
        @click="editor.transformApply(); editor.tool.value = 'select'"
      >
        <IconCheck class="ctv:size-3.5" />
        {{ $t('pentrado.transformApply') }}
      </button>
      <button
        type="button"
        :class="actionBtnClass"
        :disabled="!editor.transformDirty.value"
        @click="editor.transformCancel(); editor.tool.value = 'select'"
      >
        <IconX class="ctv:size-3.5" />
        {{ $t('pentrado.transformCancel') }}
      </button>
      <label :class="fieldClass" :title="$t('pentrado.snapGridHint')">
        {{ $t('pentrado.snapGrid') }}
        <input
          type="number" min="0" max="512" step="8"
          :value="editor.snapGridSize.value"
          class="ctv:w-14 ctv:rounded-xs ctv:border ctv:border-[#3d3d3d] ctv:bg-[#1e1e1e] ctv:px-1 ctv:py-0.5 ctv:font-mono ctv:text-[11px] ctv:text-[#d6d6d6]"
          @change="editor.setSnapGrid(Number(($event.target as HTMLInputElement).value) || 0)"
        />
      </label>
      <span class="ctv:whitespace-nowrap ctv:text-[10px] ctv:text-[#9b9b9b]/70">
        {{ $t('pentrado.transformHint') }}
      </span>
    </template>

    <template v-else-if="isWarpTool">
      <div :class="segGroupClass">
        <button
          v-for="n in WARP_GRID_SIZES"
          :key="n"
          type="button"
          :class="segBtnClass(editor.warpPoints.value === n)"
          :aria-pressed="editor.warpPoints.value === n"
          @click="editor.warpPoints.value = n"
        >
          {{ n }}×{{ n }}
        </button>
      </div>

      <button
        type="button"
        :class="actionBtnClass"
        :disabled="!editor.warpDirty.value"
        @click="editor.warpApply()"
      >
        <IconCheck class="ctv:size-3.5" />
        {{ $t('pentrado.warpApply') }}
      </button>
      <button
        type="button"
        :class="actionBtnClass"
        :disabled="!editor.warpDirty.value"
        @click="editor.warpCancel()"
      >
        <IconX class="ctv:size-3.5" />
        {{ $t('pentrado.warpCancel') }}
      </button>
    </template>

    <ToolBarArrange v-if="multiSelected" :editor="editor" />

    <div class="ctv:flex-1" />

    <button
      type="button"
      :class="iconBtnClass"
      :disabled="!editor.canUndo.value"
      :title="$t('pentrado.undo')"
      @click="editor.undo"
    >
      <IconUndo class="ctv:size-4" />
    </button>
    <button
      type="button"
      :class="iconBtnClass"
      :disabled="!editor.canRedo.value"
      :title="$t('pentrado.redo')"
      @click="editor.redo"
    >
      <IconRedo class="ctv:size-4" />
    </button>

    <div :class="dividerClass" />

    <template v-for="action in editor.host.toolbarActions" :key="action.id">
      <button
        type="button"
        :class="action.label ? actionBtnClass : iconBtnClass"
        :disabled="action.busy?.(editor) ?? false"
        :title="action.title"
        @click="action.run(editor)"
      >
        <IconLoader v-if="action.busy?.(editor)" class="ctv:size-3.5 ctv:animate-spin" />
        <component :is="action.icon" v-else-if="action.icon" :class="action.label ? 'ctv:size-3.5' : 'ctv:size-4'" />
        {{ action.label }}
      </button>
    </template>

    <button
      type="button"
      :class="actionBtnClass"
      :disabled="editor.importingPsd.value"
      :title="$t('pentrado.importPsdHint')"
      @click="psdFileInput?.click()"
    >
      <IconLoader v-if="editor.importingPsd.value" class="ctv:size-3.5 ctv:animate-spin" />
      <IconFileUp v-else class="ctv:size-3.5" />
      {{ $t('pentrado.importPsd') }}
    </button>
    <input
      ref="psdFileInput"
      type="file"
      accept=".psd,.psb"
      class="ctv:hidden"
      @change="onPsdFilePicked"
    />

    <button
      type="button"
      :class="actionBtnClass"
      :disabled="editor.exportingPsd.value"
      :title="$t('pentrado.exportPsdHint')"
      @click="editor.exportPsd"
    >
      <IconLoader v-if="editor.exportingPsd.value" class="ctv:size-3.5 ctv:animate-spin" />
      <IconFileDown v-else class="ctv:size-3.5" />
      {{ $t('pentrado.exportPsd') }}
    </button>

    <button
      type="button"
      :class="iconBtnClass"
      :title="$t('pentrado.fitView')"
      @click="editor.fitView"
    >
      <IconScan class="ctv:size-4" />
    </button>

    <slot name="trailing" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import IconBlend from '~icons/lucide/blend'
import IconBrush from '~icons/lucide/brush'
import IconCheck from '~icons/lucide/check'
import IconEraser from '~icons/lucide/eraser'
import IconFlame from '~icons/lucide/flame'
import IconHand from '~icons/lucide/hand'
import IconPipette from '~icons/lucide/pipette'
import IconSprayCan from '~icons/lucide/spray-can'
import IconStamp from '~icons/lucide/stamp'
import IconSun from '~icons/lucide/sun'
import IconFileDown from '~icons/lucide/file-down'
import IconFileUp from '~icons/lucide/file-up'
import IconGrid from '~icons/lucide/grid-3x3'
import IconLoader from '~icons/lucide/loader-2'
import IconCircleDashed from '~icons/lucide/circle-dashed'
import IconLasso from '~icons/lucide/lasso'
import IconMousePointer from '~icons/lucide/mouse-pointer-2'
import IconPaintBucket from '~icons/lucide/paint-bucket'
import IconPenTool from '~icons/lucide/pen-tool'
import IconWandSparkles from '~icons/lucide/wand-sparkles'
import IconRedo from '~icons/lucide/redo-2'
import IconCrop from '~icons/lucide/crop'
import IconScaling from '~icons/lucide/scaling'
import IconScan from '~icons/lucide/scan'
import IconShapes from '~icons/lucide/shapes'
import IconSquareDashed from '~icons/lucide/square-dashed'
import IconType from '~icons/lucide/type'
import IconUndo from '~icons/lucide/undo-2'
import IconX from '~icons/lucide/x'

import ToolBarArrange from './panels/ToolBarArrange.vue'
import ToolBarPaintControls from './panels/ToolBarPaintControls.vue'
import ToolBarSelectionControls from './panels/ToolBarSelectionControls.vue'
import ToolBarShapeControls from './panels/ToolBarShapeControls.vue'
import {
  actionBtnClass, colorInputClass, dividerClass, fieldClass, iconBtnClass, segBtnClass, segGroupClass,
} from './panels/toolbarClasses'
import type { LayerEditorController } from './useLayerEditorStage'
import type { ToolId } from '../types'

const props = defineProps<{
  editor: LayerEditorController
}>()

const editor = props.editor

const psdFileInput = ref<HTMLInputElement | null>(null)

function onPsdFilePicked(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) void editor.importPsdFile(file)
}

const TOOL_META: Record<ToolId, { labelKey: string; icon: unknown }> = {
  select: { labelKey: 'pentrado.toolSelect', icon: IconMousePointer },
  transform: { labelKey: 'pentrado.toolTransform', icon: IconScaling },
  crop: { labelKey: 'pentrado.toolCrop', icon: IconCrop },
  marquee: { labelKey: 'pentrado.toolMarquee', icon: IconSquareDashed },
  'marquee-ellipse': { labelKey: 'pentrado.toolMarqueeEllipse', icon: IconCircleDashed },
  lasso: { labelKey: 'pentrado.toolLasso', icon: IconLasso },
  wand: { labelKey: 'pentrado.toolWand', icon: IconWandSparkles },
  bucket: { labelKey: 'pentrado.toolBucket', icon: IconPaintBucket },
  brush: { labelKey: 'pentrado.toolBrush', icon: IconBrush },
  eraser: { labelKey: 'pentrado.toolEraser', icon: IconEraser },
  airbrush: { labelKey: 'pentrado.toolAirbrush', icon: IconSprayCan },
  smudge: { labelKey: 'pentrado.toolSmudge', icon: IconHand },
  clone: { labelKey: 'pentrado.toolClone', icon: IconStamp },
  dodge: { labelKey: 'pentrado.toolDodge', icon: IconSun },
  burn: { labelKey: 'pentrado.toolBurn', icon: IconFlame },
  picker: { labelKey: 'pentrado.toolPicker', icon: IconPipette },
  gradient: { labelKey: 'pentrado.toolGradient', icon: IconBlend },
  pen: { labelKey: 'pentrado.toolPen', icon: IconPenTool },
  text: { labelKey: 'pentrado.toolText', icon: IconType },
  shape: { labelKey: 'pentrado.toolShape', icon: IconShapes },
  warp: { labelKey: 'pentrado.toolWarp', icon: IconGrid },
}

const multiSelected = computed(() => editor.selectedIdList.value.length >= 2)

const activeToolIcon = computed(() => TOOL_META[editor.tool.value].icon)
const activeToolLabelKey = computed(() => TOOL_META[editor.tool.value].labelKey)
const isPaintTool = computed(() =>
  ['brush', 'eraser', 'airbrush', 'smudge', 'clone', 'dodge', 'burn'].includes(editor.tool.value)
)
const isGradientTool = computed(() => editor.tool.value === 'gradient')
const isShapeTool = computed(() => editor.tool.value === 'shape')
const isPenTool = computed(() => editor.tool.value === 'pen')
const isWarpTool = computed(() => editor.tool.value === 'warp')
const isTransformTool = computed(() => editor.tool.value === 'transform')
const isCropTool = computed(() => editor.tool.value === 'crop')
const isSelectionTool = computed(() =>
  ['marquee', 'marquee-ellipse', 'lasso', 'wand', 'bucket'].includes(editor.tool.value)
)
const WARP_GRID_SIZES = [3, 4, 5]
</script>
