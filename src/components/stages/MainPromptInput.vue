<template>
  <div v-if="widget" ref="rootEl" class="ctv:relative ctv:pt-1 ctv:px-2 ctv:pb-1">
    <EditorContent :editor="editor" class="comfytv-prompt-editor" />
    <div class="ctv:flex ctv:gap-1 ctv:mt-1">
      <button
        type="button"
        :class="[iconBtnClass, helperOpen
          ? 'ctv:bg-primary-background/20 ctv:border-primary-background/50 ctv:text-primary-background'
          : 'ctv:bg-secondary-background ctv:border-border-default ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground']"
        :title="$t('promptHelper.open')"
        @click="helperOpen = !helperOpen"
      ><i class="pi pi-sparkles" /></button>
      <button
        type="button"
        :class="[iconBtnClass, cameraOpen
          ? 'ctv:bg-primary-background/20 ctv:border-primary-background/50 ctv:text-primary-background'
          : 'ctv:bg-secondary-background ctv:border-border-default ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground']"
        :title="$t('cameraPrompt.open')"
        @click="cameraOpen = !cameraOpen"
      ><i class="pi pi-video" /></button>
    </div>
    <PromptHelperPanel
      v-if="helperOpen"
      :groups="helper.groups"
      :is-active="helper.isActive"
      @apply="helper.apply"
    />
    <CameraPromptPanel v-if="cameraOpen" @insert="onCameraInsert" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { EditorContent } from '@tiptap/vue-3'
import 'tippy.js/dist/tippy.css'

import type { CameraSelection } from '@/composables/stages/cameraControlCatalog'
import { CAMERA_BUILDER } from '@/composables/stages/promptModules/builders'
import { useMainPromptInput } from '@/composables/stages/useMainPromptInput'
import { usePromptModules } from '@/composables/stages/usePromptModules'
import type { LGraphNode } from '@/lib/comfyApp'

import CameraPromptPanel from './CameraPromptPanel.vue'
import MentionList from './MentionList.vue'
import PromptHelperPanel from './PromptHelperPanel.vue'

const props = defineProps<{ node?: LGraphNode }>()

const rootEl = ref<HTMLElement | null>(null)

const { widget, editor, promptText, applyPromptText } = useMainPromptInput(
  () => props.node,
  MentionList,
)

const helperOpen = ref(false)
const helper = usePromptModules(() => promptText.value, applyPromptText)

const cameraOpen = ref(false)
function onCameraInsert(selection: CameraSelection) {
  helper.apply(CAMERA_BUILDER, selection as Record<string, string>)
}

const iconBtnClass = 'ctv:inline-flex ctv:items-center ctv:justify-center ctv:size-5 ctv:cursor-pointer'
  + ' ctv:rounded-sm ctv:border ctv:text-2xs ctv:leading-none ctv:[font-family:inherit] ctv:transition-colors'
</script>

<style>
.comfytv-prompt-prosemirror {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.35) transparent;
}
.comfytv-prompt-prosemirror::-webkit-scrollbar {
  width: 10px;
}
.comfytv-prompt-prosemirror::-webkit-scrollbar-track {
  background: transparent;
}
.comfytv-prompt-prosemirror::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.35);
  border-radius: 5px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.comfytv-prompt-prosemirror:hover::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.55);
}

.tippy-box[data-theme~='comfytv-transparent'] {
  background: transparent;
  box-shadow: none;
}
.tippy-box[data-theme~='comfytv-transparent'] > .tippy-content { padding: 0; }

.tippy-box[data-theme~='comfytv-tooltip'] {
  background: var(--interface-menu-surface, #1a1a1a);
  border: 1px solid var(--border-default, #3a3a3a);
  color: var(--base-foreground, #e0e0e0);
  font-size: 11px;
  line-height: 1.45;
  border-radius: 4px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}
.tippy-box[data-theme~='comfytv-tooltip'] > .tippy-content {
  padding: 6px 8px;
  white-space: pre-wrap;
  word-break: break-word;
}
.tippy-box[data-theme~='comfytv-tooltip'][data-placement^='top']    > .tippy-arrow::before { border-top-color: var(--border-default, #3a3a3a); }
.tippy-box[data-theme~='comfytv-tooltip'][data-placement^='bottom'] > .tippy-arrow::before { border-bottom-color: var(--border-default, #3a3a3a); }
.tippy-box[data-theme~='comfytv-tooltip'][data-placement^='left']   > .tippy-arrow::before { border-left-color: var(--border-default, #3a3a3a); }
.tippy-box[data-theme~='comfytv-tooltip'][data-placement^='right']  > .tippy-arrow::before { border-right-color: var(--border-default, #3a3a3a); }
</style>

<style scoped>
.comfytv-prompt-editor :deep(p) { margin: 0; }
.comfytv-prompt-editor :deep(p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: var(--muted-foreground, #888);
  opacity: 0.65;
  float: left;
  height: 0;
  pointer-events: none;
}
</style>
