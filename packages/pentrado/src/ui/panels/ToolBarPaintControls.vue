<template>
  <div v-if="showPaintTargetSeg" :class="segGroupClass">
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
    {{ $t('pentrado.brushSize') }}
    <input v-model.number="editor.brushSize.value" type="range" min="2" max="400" step="1" class="ctv:w-20" />
    <span class="ctv:w-7 ctv:text-right ctv:font-mono">{{ editor.brushSize.value }}</span>
  </label>

  <label :class="fieldClass">
    {{ $t('pentrado.brushHardness') }}
    <input v-model.number="editor.brushHardness.value" type="range" min="0" max="1" step="0.01" class="ctv:w-16" />
  </label>

  <label :class="fieldClass">
    {{ $t('pentrado.brushOpacity') }}
    <input v-model.number="editor.brushOpacity.value" type="range" min="0" max="1" step="0.01" class="ctv:w-16" />
  </label>

  <label v-if="showBrushColor" :class="fieldClass">
    {{ $t('pentrado.brushColor') }}
    <input v-model="editor.brushColor.value" type="color" :class="colorInputClass" />
  </label>

  <template v-if="showSymmetry">
    <div :class="dividerClass" />
    <div :class="segGroupClass">
      <button
        v-for="mode in SYMMETRY_MODES"
        :key="mode"
        type="button"
        :class="segBtnClass(editor.symmetryMode.value === mode)"
        :aria-pressed="editor.symmetryMode.value === mode"
        :title="$t(`pentrado.symmetry_${mode}`)"
        @click="editor.symmetryMode.value = mode"
      >
        {{ $t(`pentrado.symmetry_${mode}`) }}
      </button>
    </div>
    <label v-if="editor.symmetryMode.value === 'mandala'" :class="fieldClass">
      {{ $t('pentrado.symmetrySectors') }}
      <input v-model.number="editor.symmetrySectors.value" type="number" min="2" max="16" step="1" class="ctv:w-12" />
    </label>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { LayerEditorController } from '../useLayerEditorStage'
import { colorInputClass, dividerClass, fieldClass, segBtnClass, segGroupClass } from './toolbarClasses'

const props = defineProps<{
  editor: LayerEditorController
}>()

const editor = props.editor

const PAINT_TARGETS: Array<{ id: 'content' | 'mask'; labelKey: string }> = [
  { id: 'content', labelKey: 'pentrado.targetContent' },
  { id: 'mask', labelKey: 'pentrado.targetMask' },
]
const SYMMETRY_MODES = ['none', 'mirror-h', 'mirror-v', 'mirror-both', 'mandala'] as const

const showSymmetry = computed(() => ['brush', 'eraser', 'airbrush'].includes(editor.tool.value))
const showBrushColor = computed(
  () => (editor.tool.value === 'brush' || editor.tool.value === 'airbrush') && editor.paintTarget.value === 'content'
)
const showPaintTargetSeg = computed(() => editor.tool.value === 'brush' || editor.tool.value === 'eraser')
</script>
