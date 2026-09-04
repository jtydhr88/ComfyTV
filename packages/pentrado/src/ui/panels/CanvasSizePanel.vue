<template>
  <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:px-2 ctv:py-1 ctv:text-[10px] ctv:text-[#9b9b9b]">
    <span>{{ $t('pentrado.sectionCanvas') }}</span>
    <input
      type="number" min="64" max="4096" step="8"
      :class="numInputClass"
      :value="editor.canvasSize.value.width"
      @change="panel.onArtboardSize($event, 'w')"
    />
    <span>×</span>
    <input
      type="number" min="64" max="4096" step="8"
      :class="numInputClass"
      :value="editor.canvasSize.value.height"
      @change="panel.onArtboardSize($event, 'h')"
    />
    <span>px</span>
  </div>

  <div class="ctv:px-2 ctv:pb-1">
    <select
      :class="presetSelectClass"
      :title="$t('pentrado.canvasPresetHint')"
      @change="panel.onCanvasPreset"
    >
      <option value="" selected>{{ $t('pentrado.canvasPreset') }}</option>
      <optgroup
        v-for="group in CANVAS_PRESET_GROUPS"
        :key="group.id"
        :label="$t(group.labelKey)"
      >
        <option v-for="p in group.presets" :key="p.id" :value="p.id">{{ p.label }}</option>
      </optgroup>
    </select>
  </div>
</template>

<script setup lang="ts">
import type { LayerEditorController } from '../useLayerEditorStage'
import type { useLayerListPanel } from '../useLayerListPanel'
import { CANVAS_PRESET_GROUPS } from '../../canvasPresets'
import { numInputClass, presetSelectClass } from './panelClasses'

type PanelApi = ReturnType<typeof useLayerListPanel>

defineProps<{
  editor: LayerEditorController
  panel: Pick<PanelApi, 'onArtboardSize' | 'onCanvasPreset'>
}>()
</script>
