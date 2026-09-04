<template>
  <template v-if="isWandLike">
    <label :class="fieldClass">
      {{ $t('pentrado.wandThreshold') }}
      <input v-model.number="editor.wandThreshold.value" type="range" min="0.01" max="1" step="0.01" class="ctv:w-20" />
      <span class="ctv:w-8 ctv:text-right ctv:font-mono">{{ editor.wandThreshold.value.toFixed(2) }}</span>
    </label>
    <label :class="fieldClass">
      <input v-model="editor.wandAntialias.value" type="checkbox" class="ctv:accent-[#1473e6]" />
      {{ $t('pentrado.wandAntialias') }}
    </label>
    <label :class="fieldClass">
      <input v-model="editor.wandContiguous.value" type="checkbox" class="ctv:accent-[#1473e6]" />
      {{ $t('pentrado.wandContiguous') }}
    </label>
    <label v-if="editor.tool.value === 'bucket'" :class="fieldClass">
      {{ $t('pentrado.brushColor') }}
      <input v-model="editor.brushColor.value" type="color" :class="colorInputClass" />
    </label>
  </template>
  <template v-if="editor.tool.value !== 'bucket'">
    <label :class="fieldClass">
      {{ $t('pentrado.selRadius') }}
      <input
        v-model.number="editor.selectionRadius.value"
        type="number" min="1" max="200" step="1"
        class="ctv:w-12 ctv:rounded-xs ctv:border ctv:border-[#3d3d3d] ctv:bg-[#1e1e1e] ctv:px-1 ctv:py-0.5 ctv:font-mono ctv:text-[11px] ctv:text-[#d6d6d6]"
      />
    </label>
    <button
      v-for="mod in SELECTION_MODS"
      :key="mod"
      type="button"
      :class="actionBtnClass"
      :disabled="!editor.hasSelection()"
      @click="editor.modifySelection(mod)"
    >
      {{ $t(`pentrado.sel_${mod}`) }}
    </button>
    <button type="button" :class="actionBtnClass" :disabled="!editor.hasSelection()" @click="editor.fillSelection()">
      {{ $t('pentrado.selFill') }}
    </button>
    <button type="button" :class="actionBtnClass" :disabled="!editor.hasSelection()" @click="editor.strokeSelection()">
      {{ $t('pentrado.selStroke') }}
    </button>
    <label :class="fieldClass">
      {{ $t('pentrado.brushColor') }}
      <input v-model="editor.brushColor.value" type="color" :class="colorInputClass" />
    </label>
    <span class="ctv:whitespace-nowrap ctv:text-[10px] ctv:text-[#9b9b9b]/70">
      {{ $t('pentrado.selOpsHint') }}
    </span>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { LayerEditorController } from '../useLayerEditorStage'
import { actionBtnClass, colorInputClass, fieldClass } from './toolbarClasses'

const props = defineProps<{
  editor: LayerEditorController
}>()

const editor = props.editor

const isWandLike = computed(() => editor.tool.value === 'wand' || editor.tool.value === 'bucket')
const SELECTION_MODS = ['feather', 'grow', 'shrink', 'border'] as const
</script>
