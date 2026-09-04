<template>
  <span v-if="isPenTool" class="ctv:whitespace-nowrap ctv:text-[10px] ctv:text-[#7a7a7a]">
    {{ $t('pentrado.penHint') }}
  </span>
  <div v-if="isShapeTool" :class="segGroupClass">
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

  <div v-if="isShapeTool" :class="segGroupClass">
    <button
      type="button"
      :class="segBtnClass(!editor.shapeCombine.value)"
      :aria-pressed="!editor.shapeCombine.value"
      @click="editor.shapeCombine.value = false"
    >
      {{ $t('pentrado.shapeNewLayer') }}
    </button>
    <button
      type="button"
      :class="segBtnClass(editor.shapeCombine.value)"
      :aria-pressed="editor.shapeCombine.value"
      @click="editor.shapeCombine.value = true"
    >
      {{ $t('pentrado.shapeCombine') }}
    </button>
  </div>

  <label
    v-if="editor.shapeKind.value === 'polygon' || editor.shapeKind.value === 'star'"
    :class="fieldClass"
  >
    {{ $t('pentrado.shapeSides') }}
    <input
      v-model.number="editor.shapeSides.value"
      type="range" min="3" max="24" step="1"
      class="ctv:w-16"
    />
    <span class="ctv:w-5 ctv:text-right ctv:font-mono">{{ editor.shapeSides.value }}</span>
  </label>

  <label v-if="editor.shapeKind.value === 'star'" :class="fieldClass">
    {{ $t('pentrado.shapeStarRatio') }}
    <input
      v-model.number="editor.shapeStarRatio.value"
      type="range" min="0.1" max="0.9" step="0.05"
      class="ctv:w-16"
    />
    <span class="ctv:w-7 ctv:text-right ctv:font-mono">{{ editor.shapeStarRatio.value.toFixed(2) }}</span>
  </label>

  <label v-if="editor.shapeKind.value === 'spiral'" :class="fieldClass">
    {{ $t('pentrado.shapeTurns') }}
    <input
      v-model.number="editor.shapeTurns.value"
      type="range" min="1" max="8" step="1"
      class="ctv:w-16"
    />
    <span class="ctv:w-5 ctv:text-right ctv:font-mono">{{ editor.shapeTurns.value }}</span>
  </label>

  <label v-if="!strokeOnlyShape" :class="fieldClass">
    <input v-model="editor.shapeFillEnabled.value" type="checkbox" class="ctv:accent-[#1473e6]" />
    {{ $t('pentrado.shapeFill') }}
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
    {{ $t('pentrado.shapeStroke') }}
    <input
      v-model="editor.shapeStrokeColor.value"
      type="color"
      :disabled="!strokeOnlyShape && !editor.shapeStrokeEnabled.value"
      :class="colorInputClass"
    />
  </label>

  <label :class="fieldClass">
    {{ $t('pentrado.shapeStrokeWidth') }}
    <input
      v-model.number="editor.shapeStrokeWidth.value"
      type="range" min="1" max="100" step="1"
      :disabled="!strokeOnlyShape && !editor.shapeStrokeEnabled.value"
      class="ctv:w-20 ctv:disabled:opacity-30"
    />
    <span class="ctv:w-7 ctv:text-right ctv:font-mono">{{ editor.shapeStrokeWidth.value }}</span>
  </label>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import IconCircle from '~icons/lucide/circle'
import IconHexagon from '~icons/lucide/hexagon'
import IconMinus from '~icons/lucide/minus'
import IconShell from '~icons/lucide/shell'
import IconSpline from '~icons/lucide/spline'
import IconSquare from '~icons/lucide/square'
import IconStar from '~icons/lucide/star'

import type { LayerEditorController } from '../useLayerEditorStage'
import { STROKE_ONLY_SHAPES, type ShapeKind } from '../../engine'
import { colorInputClass, fieldClass, segBtnClass, segGroupClass } from './toolbarClasses'

const props = defineProps<{
  editor: LayerEditorController
  isShapeTool: boolean
  isPenTool: boolean
}>()

const editor = props.editor

const SHAPE_OPTIONS: Array<{ id: ShapeKind; labelKey: string; icon: unknown }> = [
  { id: 'rect', labelKey: 'pentrado.shapeRect', icon: IconSquare },
  { id: 'ellipse', labelKey: 'pentrado.shapeEllipse', icon: IconCircle },
  { id: 'line', labelKey: 'pentrado.shapeLine', icon: IconMinus },
  { id: 'polygon', labelKey: 'pentrado.shapePolygon', icon: IconHexagon },
  { id: 'star', labelKey: 'pentrado.shapeStar', icon: IconStar },
  { id: 'arc', labelKey: 'pentrado.shapeArc', icon: IconSpline },
  { id: 'spiral', labelKey: 'pentrado.shapeSpiral', icon: IconShell },
]

const strokeOnlyShape = computed(() => STROKE_ONLY_SHAPES.has(editor.shapeKind.value))
</script>
