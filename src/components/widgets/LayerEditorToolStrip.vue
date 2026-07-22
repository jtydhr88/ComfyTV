<template>
  <div
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
import IconMousePointer from '~icons/lucide/mouse-pointer-2'
import IconShapes from '~icons/lucide/shapes'
import IconSquareDashed from '~icons/lucide/square-dashed'
import IconType from '~icons/lucide/type'

import type { LayerEditorController } from '@/composables/widgets/useLayerEditorStage'
import type { ToolId } from '@/widgets/layerEditor/types'

const props = defineProps<{
  editor: LayerEditorController
}>()

const editor = props.editor

const TOOL_OPTIONS: Array<{ id: ToolId; labelKey: string; icon: unknown }> = [
  { id: 'select', labelKey: 'layerEditor.toolSelect', icon: IconMousePointer },
  { id: 'marquee', labelKey: 'layerEditor.toolMarquee', icon: IconSquareDashed },
  { id: 'shape', labelKey: 'layerEditor.toolShape', icon: IconShapes },
  { id: 'text', labelKey: 'layerEditor.toolText', icon: IconType },
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
