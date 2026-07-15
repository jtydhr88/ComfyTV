<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1 ctv:shrink-0">
    <div class="ctv:flex ctv:h-8 ctv:items-center ctv:gap-2">
      <div class="ctv:flex ctv:h-7 ctv:items-center ctv:gap-0.5 ctv:rounded-lg ctv:bg-secondary-background ctv:p-0.5">
        <button
          v-for="option in TOOL_OPTIONS"
          :key="option.id"
          type="button"
          :class="toolBtnClass(editor.tool.value === option.id)"
          :aria-pressed="editor.tool.value === option.id"
          :title="$t(option.labelKey)"
          @click="editor.tool.value = option.id"
        >
          <component :is="option.icon" class="ctv:size-3.5" />
          {{ $t(option.labelKey) }}
        </button>
      </div>

      <div class="ctv:h-5 ctv:w-px ctv:bg-border-subtle" />

      <button
        type="button"
        :class="historyBtnClass"
        :disabled="!editor.canUndo.value"
        :title="$t('layerEditor.undo')"
        @click="editor.undo"
      >
        <IconUndo class="ctv:size-4" />
      </button>
      <button
        type="button"
        :class="historyBtnClass"
        :disabled="!editor.canRedo.value"
        :title="$t('layerEditor.redo')"
        @click="editor.redo"
      >
        <IconRedo class="ctv:size-4" />
      </button>

      <div class="ctv:h-5 ctv:w-px ctv:bg-border-subtle" />

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
        :title="$t('layerEditor.fitView')"
        @click="editor.fitView"
      >
        <IconScan class="ctv:size-3.5" />
      </button>

      <div class="ctv:flex-1" />

      <slot name="trailing" />
    </div>

  </div>
</template>

<script setup lang="ts">
import IconCamera from '~icons/lucide/camera'
import IconLoader from '~icons/lucide/loader-2'
import IconMousePointer from '~icons/lucide/mouse-pointer-2'
import IconRedo from '~icons/lucide/redo-2'
import IconScan from '~icons/lucide/scan'
import IconType from '~icons/lucide/type'
import IconUndo from '~icons/lucide/undo-2'

import type { LayerEditorController } from '@/composables/widgets/useLayerEditorStage'
import type { ToolId } from '@/widgets/layerEditor/types'

const props = defineProps<{
  editor: LayerEditorController
}>()

const editor = props.editor

const TOOL_OPTIONS: Array<{ id: ToolId; labelKey: string; icon: unknown }> = [
  { id: 'select', labelKey: 'layerEditor.toolSelect', icon: IconMousePointer },
  { id: 'text', labelKey: 'layerEditor.toolText', icon: IconType },
]

function toolBtnClass(active: boolean): string {
  return [
    'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:rounded-md ctv:border-0 ctv:px-2 ctv:py-1',
    'ctv:text-2xs ctv:cursor-pointer ctv:[font-family:inherit] ctv:transition-colors',
    active
      ? 'ctv:bg-secondary-background-selected ctv:text-primary-background ctv:font-semibold'
      : 'ctv:bg-transparent ctv:text-muted-foreground ctv:hover:text-base-foreground',
  ].join(' ')
}

const historyBtnClass =
  'ctv:inline-flex ctv:size-7 ctv:items-center ctv:justify-center ctv:rounded-md ctv:border-0 ' +
  'ctv:bg-transparent ctv:text-muted-foreground ctv:cursor-pointer ctv:transition-colors ' +
  'ctv:hover:bg-secondary-background ctv:hover:text-base-foreground ' +
  'ctv:disabled:opacity-30 ctv:disabled:cursor-default ctv:disabled:hover:bg-transparent'

const actionBtnClass =
  'ctv:inline-flex ctv:h-7 ctv:items-center ctv:gap-1 ctv:rounded-lg ctv:border ctv:border-border-subtle ' +
  'ctv:bg-secondary-background ctv:px-2 ctv:text-2xs ctv:text-base-foreground ctv:cursor-pointer ' +
  'ctv:[font-family:inherit] ctv:transition-colors ctv:hover:bg-secondary-background-hover ' +
  'ctv:disabled:opacity-40 ctv:disabled:cursor-default'
</script>
