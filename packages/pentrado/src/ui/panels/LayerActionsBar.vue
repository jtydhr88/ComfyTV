<template>
  <div class="ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-0.5 ctv:px-1.5 ctv:py-0.5">
    <button type="button" :class="miniBtnClass" :title="$t('pentrado.moveUp')" @click="editor.moveLayer(active.id, 1)">
      <IconChevronUp class="ctv:size-3.5" />
    </button>
    <button type="button" :class="miniBtnClass" :title="$t('pentrado.moveDown')" @click="editor.moveLayer(active.id, -1)">
      <IconChevronDownArrange class="ctv:size-3.5" />
    </button>
    <button type="button" :class="miniBtnClass" :title="$t('pentrado.duplicateLayer')" @click="editor.duplicateLayer(active.id)">
      <IconCopy class="ctv:size-3.5" />
    </button>
    <button type="button" :class="miniBtnClass" :title="$t('pentrado.groupLayers')" @click="editor.groupActiveLayer()">
      <IconFolderPlus class="ctv:size-3.5" />
    </button>
    <button
      v-if="editor.canClipMask(active.id)"
      type="button"
      :class="[miniBtnClass, active.clip ? 'ctv:text-[#1473e6]' : '']"
      :title="$t('pentrado.clipMask')"
      @click="editor.toggleClipMask(active.id)"
    >
      <IconCornerDownRight class="ctv:size-3.5" />
    </button>
    <button
      v-if="active.kind === 'group'"
      type="button"
      :class="miniBtnClass"
      :title="$t('pentrado.ungroupLayers')"
      @click="editor.ungroupActiveLayer()"
    >
      <IconFolderMinus class="ctv:size-3.5" />
    </button>
    <button type="button" :class="miniBtnClass" :title="$t('pentrado.mergeDown')" @click="editor.mergeDown(active.id)">
      <IconArrowDownToLine class="ctv:size-3.5" />
    </button>
    <button type="button" :class="miniBtnClass" :title="$t('pentrado.mergeVisible')" @click="editor.mergeVisible()">
      <IconCombine class="ctv:size-3.5" />
    </button>
    <button type="button" :class="miniBtnClass" :title="$t('pentrado.newFromVisible')" @click="editor.newFromVisible()">
      <IconImagePlus class="ctv:size-3.5" />
    </button>
    <button type="button" :class="miniBtnClass" :title="$t('pentrado.copyVisible')" @click="editor.copyVisible()">
      <IconClipboardCopy class="ctv:size-3.5" />
    </button>
    <button
      v-if="editor.lastFilter.value"
      type="button"
      :class="miniBtnClass"
      :title="`${$t('pentrado.repeatFilter')}: ${$t(`pentrado.filter_${editor.lastFilter.value.op}`)}`"
      @click="editor.repeatLastFilter()"
    >
      <IconRepeat class="ctv:size-3.5" />
    </button>
    <template v-if="active.kind === 'vector'">
      <button type="button" :class="miniBtnClass" :title="$t('pentrado.pathToSelection')" @click="editor.pathToSelection(active.id)">
        <IconBoxSelect class="ctv:size-3.5" />
      </button>
      <button type="button" :class="miniBtnClass" :title="$t('pentrado.strokePath')" @click="editor.strokePathBrush(active.id)">
        <IconSpline class="ctv:size-3.5" />
      </button>
    </template>
    <button
      v-if="active.kind === 'text'"
      type="button"
      :class="miniBtnClass"
      :title="$t('pentrado.textToPath')"
      @click="editor.textToPath(active.id)"
    >
      <IconSpline class="ctv:size-3.5" />
    </button>
    <template v-if="active.kind === 'raster'">
      <button type="button" :class="miniBtnClass" :title="$t('pentrado.cropToContent')" @click="editor.cropToContent(active.id)">
        <IconCrop class="ctv:size-3.5" />
      </button>
      <button type="button" :class="miniBtnClass" :title="$t('pentrado.layerToCanvasSize')" @click="editor.layerToCanvasSize(active.id)">
        <IconMaximize class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="miniBtnClass"
        :disabled="!editor.canRasterize(active.id)"
        :title="$t('pentrado.rasterizeLayer')"
        @click="editor.rasterizeLayer(active.id)"
      >
        <IconFrame class="ctv:size-3.5" />
      </button>
    </template>
    <div class="ctv:flex-1" />
    <button type="button" :class="miniBtnClass" :title="$t('pentrado.flattenImage')" @click="editor.flattenImage()">
      <IconLayers class="ctv:size-3.5" />
    </button>
  </div>
</template>

<script setup lang="ts">
import IconArrowDownToLine from '~icons/lucide/arrow-down-to-line'
import IconBoxSelect from '~icons/lucide/box-select'
import IconChevronDownArrange from '~icons/lucide/chevron-down'
import IconChevronUp from '~icons/lucide/chevron-up'
import IconClipboardCopy from '~icons/lucide/clipboard-copy'
import IconCombine from '~icons/lucide/combine'
import IconCopy from '~icons/lucide/copy'
import IconCornerDownRight from '~icons/lucide/corner-down-right'
import IconCrop from '~icons/lucide/crop'
import IconFolderMinus from '~icons/lucide/folder-minus'
import IconFolderPlus from '~icons/lucide/folder-plus'
import IconFrame from '~icons/lucide/frame'
import IconImagePlus from '~icons/lucide/image-plus'
import IconLayers from '~icons/lucide/layers'
import IconMaximize from '~icons/lucide/maximize'
import IconRepeat from '~icons/lucide/repeat'
import IconSpline from '~icons/lucide/spline'

import type { LayerEditorController } from '../useLayerEditorStage'
import type { SceneNode } from '../../engine'
import { miniBtnClass } from './panelClasses'

const props = defineProps<{
  editor: LayerEditorController
  active: SceneNode
}>()

const editor = props.editor
</script>
