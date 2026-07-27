<template>
  <div
    class="ctv:flex ctv:h-9 ctv:shrink-0 ctv:items-center ctv:gap-2 ctv:overflow-x-auto ctv:rounded-md
           ctv:border ctv:border-[#161616] ctv:bg-[#2b2b2b] ctv:px-2 ctv:text-[11px] ctv:text-[#9b9b9b]"
  >
    <div class="ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-1 ctv:text-[#d6d6d6]">
      <component :is="activeToolIcon" class="ctv:size-3.5" />
      <span class="ctv:whitespace-nowrap">{{ $t(activeToolLabelKey) }}</span>
    </div>

    <div :class="dividerClass" />

    <template v-if="isPaintTool">
      <div class="ctv:flex ctv:h-6 ctv:items-center ctv:gap-0.5 ctv:rounded ctv:bg-[#1e1e1e] ctv:p-0.5">
        <button
          v-for="target in PAINT_TARGETS"
          :key="target.id"
          type="button"
          :class="segBtnClass(editor.paintTarget.value === target.id)"
          :aria-pressed="editor.paintTarget.value === target.id"
          @click="editor.paintTarget.value = target.id"
        >
          {{ $t(target.labelKey) }}
        </button>
      </div>

      <label :class="fieldClass">
        {{ $t('layerEditor.brushSize') }}
        <input v-model.number="editor.brushSize.value" type="range" min="2" max="400" step="1" class="ctv:w-20" />
        <span class="ctv:w-7 ctv:text-right ctv:font-mono">{{ editor.brushSize.value }}</span>
      </label>

      <label :class="fieldClass">
        {{ $t('layerEditor.brushHardness') }}
        <input v-model.number="editor.brushHardness.value" type="range" min="0" max="1" step="0.01" class="ctv:w-16" />
      </label>

      <label :class="fieldClass">
        {{ $t('layerEditor.brushOpacity') }}
        <input v-model.number="editor.brushOpacity.value" type="range" min="0" max="1" step="0.01" class="ctv:w-16" />
      </label>

      <label v-if="showBrushColor" :class="fieldClass">
        {{ $t('layerEditor.brushColor') }}
        <input v-model="editor.brushColor.value" type="color" :class="colorInputClass" />
      </label>
    </template>

    <template v-else-if="isShapeTool">
      <div class="ctv:flex ctv:h-6 ctv:items-center ctv:gap-0.5 ctv:rounded ctv:bg-[#1e1e1e] ctv:p-0.5">
        <button
          v-for="option in SHAPE_OPTIONS"
          :key="option.id"
          type="button"
          :class="segBtnClass(editor.shapeKind.value === option.id)"
          :aria-pressed="editor.shapeKind.value === option.id"
          :title="$t(option.labelKey)"
          @click="editor.shapeKind.value = option.id"
        >
          <component :is="option.icon" class="ctv:size-3.5" />
        </button>
      </div>

      <div class="ctv:flex ctv:h-6 ctv:items-center ctv:gap-0.5 ctv:rounded ctv:bg-[#1e1e1e] ctv:p-0.5">
        <button
          type="button"
          :class="segBtnClass(!editor.shapeCombine.value)"
          :aria-pressed="!editor.shapeCombine.value"
          @click="editor.shapeCombine.value = false"
        >
          {{ $t('layerEditor.shapeNewLayer') }}
        </button>
        <button
          type="button"
          :class="segBtnClass(editor.shapeCombine.value)"
          :aria-pressed="editor.shapeCombine.value"
          @click="editor.shapeCombine.value = true"
        >
          {{ $t('layerEditor.shapeCombine') }}
        </button>
      </div>

      <label
        v-if="editor.shapeKind.value === 'polygon' || editor.shapeKind.value === 'star'"
        :class="fieldClass"
      >
        {{ $t('layerEditor.shapeSides') }}
        <input
          v-model.number="editor.shapeSides.value"
          type="range" min="3" max="24" step="1"
          class="ctv:w-16"
        />
        <span class="ctv:w-5 ctv:text-right ctv:font-mono">{{ editor.shapeSides.value }}</span>
      </label>

      <label v-if="editor.shapeKind.value === 'star'" :class="fieldClass">
        {{ $t('layerEditor.shapeStarRatio') }}
        <input
          v-model.number="editor.shapeStarRatio.value"
          type="range" min="0.1" max="0.9" step="0.05"
          class="ctv:w-16"
        />
        <span class="ctv:w-7 ctv:text-right ctv:font-mono">{{ editor.shapeStarRatio.value.toFixed(2) }}</span>
      </label>

      <label v-if="editor.shapeKind.value === 'spiral'" :class="fieldClass">
        {{ $t('layerEditor.shapeTurns') }}
        <input
          v-model.number="editor.shapeTurns.value"
          type="range" min="1" max="8" step="1"
          class="ctv:w-16"
        />
        <span class="ctv:w-5 ctv:text-right ctv:font-mono">{{ editor.shapeTurns.value }}</span>
      </label>

      <label v-if="!strokeOnlyShape" :class="fieldClass">
        <input v-model="editor.shapeFillEnabled.value" type="checkbox" class="ctv:accent-[#1473e6]" />
        {{ $t('layerEditor.shapeFill') }}
        <input
          v-model="editor.shapeFillColor.value"
          type="color"
          :disabled="!editor.shapeFillEnabled.value"
          :class="colorInputClass"
        />
      </label>

      <label :class="fieldClass">
        <input
          v-if="!strokeOnlyShape"
          v-model="editor.shapeStrokeEnabled.value"
          type="checkbox"
          class="ctv:accent-[#1473e6]"
        />
        {{ $t('layerEditor.shapeStroke') }}
        <input
          v-model="editor.shapeStrokeColor.value"
          type="color"
          :disabled="!strokeOnlyShape && !editor.shapeStrokeEnabled.value"
          :class="colorInputClass"
        />
      </label>

      <label :class="fieldClass">
        {{ $t('layerEditor.shapeStrokeWidth') }}
        <input
          v-model.number="editor.shapeStrokeWidth.value"
          type="range" min="1" max="100" step="1"
          :disabled="!strokeOnlyShape && !editor.shapeStrokeEnabled.value"
          class="ctv:w-20 ctv:disabled:opacity-30"
        />
        <span class="ctv:w-7 ctv:text-right ctv:font-mono">{{ editor.shapeStrokeWidth.value }}</span>
      </label>
    </template>

    <template v-else-if="isWarpTool">
      <div class="ctv:flex ctv:h-6 ctv:items-center ctv:gap-0.5 ctv:rounded ctv:bg-[#1e1e1e] ctv:p-0.5">
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
        {{ $t('layerEditor.warpApply') }}
      </button>
      <button
        type="button"
        :class="actionBtnClass"
        :disabled="!editor.warpDirty.value"
        @click="editor.warpCancel()"
      >
        <IconX class="ctv:size-3.5" />
        {{ $t('layerEditor.warpCancel') }}
      </button>
    </template>

    <div class="ctv:flex-1" />

    <button
      type="button"
      :class="iconBtnClass"
      :disabled="!editor.canUndo.value"
      :title="$t('layerEditor.undo')"
      @click="editor.undo"
    >
      <IconUndo class="ctv:size-4" />
    </button>
    <button
      type="button"
      :class="iconBtnClass"
      :disabled="!editor.canRedo.value"
      :title="$t('layerEditor.redo')"
      @click="editor.redo"
    >
      <IconRedo class="ctv:size-4" />
    </button>

    <div :class="dividerClass" />

    <button
      type="button"
      :class="actionBtnClass"
      :disabled="editor.capturing.value"
      :title="$t('layerEditor.captureHint')"
      @click="editor.captureBatch"
    >
      <IconLoader v-if="editor.capturing.value" class="ctv:size-3.5 ctv:animate-spin" />
      <IconCamera v-else class="ctv:size-3.5" />
      {{ $t('layerEditor.capture') }}
    </button>

    <button
      type="button"
      :class="actionBtnClass"
      :disabled="editor.importingPsd.value"
      :title="$t('layerEditor.importPsdHint')"
      @click="psdFileInput?.click()"
    >
      <IconLoader v-if="editor.importingPsd.value" class="ctv:size-3.5 ctv:animate-spin" />
      <IconFileUp v-else class="ctv:size-3.5" />
      {{ $t('layerEditor.importPsd') }}
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
      :title="$t('layerEditor.exportPsdHint')"
      @click="editor.exportPsd"
    >
      <IconLoader v-if="editor.exportingPsd.value" class="ctv:size-3.5 ctv:animate-spin" />
      <IconFileDown v-else class="ctv:size-3.5" />
      {{ $t('layerEditor.exportPsd') }}
    </button>

    <button
      type="button"
      :class="iconBtnClass"
      :disabled="editor.exportingPsd.value"
      :title="$t('layerEditor.exportPsdAssetHint')"
      @click="editor.exportPsdToLibrary"
    >
      <IconLibrary class="ctv:size-4" />
    </button>

    <button
      type="button"
      :class="iconBtnClass"
      :title="$t('layerEditor.fitView')"
      @click="editor.fitView"
    >
      <IconScan class="ctv:size-4" />
    </button>

    <slot name="trailing" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import IconBrush from '~icons/lucide/brush'
import IconCamera from '~icons/lucide/camera'
import IconCheck from '~icons/lucide/check'
import IconCircle from '~icons/lucide/circle'
import IconEraser from '~icons/lucide/eraser'
import IconFileDown from '~icons/lucide/file-down'
import IconFileUp from '~icons/lucide/file-up'
import IconLibrary from '~icons/lucide/library'
import IconGrid from '~icons/lucide/grid-3x3'
import IconHexagon from '~icons/lucide/hexagon'
import IconLoader from '~icons/lucide/loader-2'
import IconMinus from '~icons/lucide/minus'
import IconMousePointer from '~icons/lucide/mouse-pointer-2'
import IconRedo from '~icons/lucide/redo-2'
import IconScan from '~icons/lucide/scan'
import IconShapes from '~icons/lucide/shapes'
import IconShell from '~icons/lucide/shell'
import IconSpline from '~icons/lucide/spline'
import IconSquare from '~icons/lucide/square'
import IconStar from '~icons/lucide/star'
import IconSquareDashed from '~icons/lucide/square-dashed'
import IconType from '~icons/lucide/type'
import IconUndo from '~icons/lucide/undo-2'
import IconX from '~icons/lucide/x'

import type { LayerEditorController } from '@/composables/widgets/useLayerEditorStage'
import { STROKE_ONLY_SHAPES, type ShapeKind } from '@/widgets/layerEditor/engine'
import type { ToolId } from '@/widgets/layerEditor/types'

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
  select: { labelKey: 'layerEditor.toolSelect', icon: IconMousePointer },
  marquee: { labelKey: 'layerEditor.toolMarquee', icon: IconSquareDashed },
  brush: { labelKey: 'layerEditor.toolBrush', icon: IconBrush },
  eraser: { labelKey: 'layerEditor.toolEraser', icon: IconEraser },
  text: { labelKey: 'layerEditor.toolText', icon: IconType },
  shape: { labelKey: 'layerEditor.toolShape', icon: IconShapes },
  warp: { labelKey: 'layerEditor.toolWarp', icon: IconGrid },
}

const SHAPE_OPTIONS: Array<{ id: ShapeKind; labelKey: string; icon: unknown }> = [
  { id: 'rect', labelKey: 'layerEditor.shapeRect', icon: IconSquare },
  { id: 'ellipse', labelKey: 'layerEditor.shapeEllipse', icon: IconCircle },
  { id: 'line', labelKey: 'layerEditor.shapeLine', icon: IconMinus },
  { id: 'polygon', labelKey: 'layerEditor.shapePolygon', icon: IconHexagon },
  { id: 'star', labelKey: 'layerEditor.shapeStar', icon: IconStar },
  { id: 'arc', labelKey: 'layerEditor.shapeArc', icon: IconSpline },
  { id: 'spiral', labelKey: 'layerEditor.shapeSpiral', icon: IconShell },
]

const strokeOnlyShape = computed(() => STROKE_ONLY_SHAPES.has(editor.shapeKind.value))

const PAINT_TARGETS: Array<{ id: 'content' | 'mask'; labelKey: string }> = [
  { id: 'content', labelKey: 'layerEditor.targetContent' },
  { id: 'mask', labelKey: 'layerEditor.targetMask' },
]

const activeToolIcon = computed(() => TOOL_META[editor.tool.value].icon)
const activeToolLabelKey = computed(() => TOOL_META[editor.tool.value].labelKey)
const isPaintTool = computed(() => editor.tool.value === 'brush' || editor.tool.value === 'eraser')
const isShapeTool = computed(() => editor.tool.value === 'shape')
const isWarpTool = computed(() => editor.tool.value === 'warp')
const WARP_GRID_SIZES = [3, 4, 5]
const showBrushColor = computed(
  () => editor.tool.value === 'brush' && editor.paintTarget.value === 'content'
)

const dividerClass = 'ctv:h-5 ctv:w-px ctv:shrink-0 ctv:bg-[#161616]'
const fieldClass = 'ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-1 ctv:whitespace-nowrap'
const colorInputClass =
  'ctv:size-6 ctv:cursor-pointer ctv:rounded ctv:border ctv:border-[#161616] ctv:bg-transparent ctv:p-0 ctv:disabled:opacity-30'

function segBtnClass(active: boolean): string {
  return [
    'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:rounded-sm ctv:border-0 ctv:px-1.5 ctv:py-0.5',
    'ctv:text-[11px] ctv:cursor-pointer ctv:[font-family:inherit] ctv:transition-colors',
    active
      ? 'ctv:bg-[#4a4a4a] ctv:text-[#f0f0f0]'
      : 'ctv:bg-transparent ctv:text-[#9b9b9b] ctv:hover:text-[#d6d6d6]',
  ].join(' ')
}

const iconBtnClass =
  'ctv:inline-flex ctv:size-7 ctv:shrink-0 ctv:items-center ctv:justify-center ctv:rounded ctv:border-0 ' +
  'ctv:bg-transparent ctv:text-[#9b9b9b] ctv:cursor-pointer ctv:transition-colors ' +
  'ctv:hover:bg-[#3a3a3a] ctv:hover:text-[#d6d6d6] ' +
  'ctv:disabled:opacity-30 ctv:disabled:cursor-default ctv:disabled:hover:bg-transparent'

const actionBtnClass =
  'ctv:inline-flex ctv:h-6 ctv:shrink-0 ctv:items-center ctv:gap-1 ctv:rounded ctv:border ctv:border-[#161616] ' +
  'ctv:bg-[#3a3a3a] ctv:px-2 ctv:text-[11px] ctv:text-[#d6d6d6] ctv:cursor-pointer ' +
  'ctv:[font-family:inherit] ctv:transition-colors ctv:hover:bg-[#4a4a4a] ' +
  'ctv:disabled:opacity-40 ctv:disabled:cursor-default'
</script>
