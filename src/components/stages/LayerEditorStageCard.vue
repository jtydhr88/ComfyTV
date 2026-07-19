<template>
  <Teleport to="body" :disabled="!fullscreen">
    <div
      class="ctv:flex ctv:flex-col ctv:gap-1 ctv:text-xs ctv:text-base-foreground ctv:outline-none"
      :class="fullscreen
        ? 'ctv:fixed ctv:inset-0 ctv:z-[1400] ctv:bg-base-background ctv:p-2'
        : 'ctv:size-full'"
      tabindex="0"
      @pointerdown.stop
      @mousedown.stop
      @contextmenu.stop.prevent
      @keydown="onKeyDown"
      @keyup="onKeyUp"
    >
      <LayerEditorToolBar :editor="editor">
        <template #trailing>
          <button
            type="button"
            :class="iconToolBtnClass"
            :title="$t(fullscreen ? 'layerEditor.exitFullscreen' : 'layerEditor.fullscreen')"
            @click="toggleFullscreen"
          >
            <IconMinimize v-if="fullscreen" class="ctv:size-4" />
            <IconMaximize v-else class="ctv:size-4" />
          </button>
        </template>
      </LayerEditorToolBar>

      <div class="ctv:flex ctv:min-h-0 ctv:flex-1 ctv:gap-1">
        <div class="ctv:relative ctv:min-w-0 ctv:flex-1">
          <LayerEditorCanvas ref="canvasEl" :editor="editor" />
          <TextEditPopup :editor="editor" />
        </div>
        <LayerListPanel :editor="editor" />
      </div>

      <StageCard
        class="ctv:h-auto! ctv:grow-0 ctv:shrink-0"
        :state="stageState"
        :node="node"
        :on-run-request="onRunRequest"
        :on-cancel-request="onCancelRequest"
        :on-disconnect="onDisconnect"
        :on-action="onAction"
        hide-context
        hide-output
        hide-actions
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import IconMaximize from '~icons/lucide/maximize-2'
import IconMinimize from '~icons/lucide/minimize-2'

import type { LGraphNode } from '@/lib/comfyApp'
import StageCard from '@/components/stages/StageCard.vue'
import LayerEditorCanvas from '@/components/widgets/LayerEditorCanvas.vue'
import LayerEditorToolBar from '@/components/widgets/LayerEditorToolBar.vue'
import LayerListPanel from '@/components/widgets/LayerListPanel.vue'
import TextEditPopup from '@/components/widgets/TextEditPopup.vue'
import { useLayerEditorHotkeys } from '@/composables/widgets/useLayerEditorHotkeys'
import { useLayerEditorStage } from '@/composables/widgets/useLayerEditorStage'
import { useStageStore, type StageState } from '@/stores/stageStore'
import { onNodeConfigure, readWidgetStr } from '@/utils/widget'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const stageState = props.state
const stageStore = useStageStore()
const canvasEl = ref<InstanceType<typeof LayerEditorCanvas> | null>(null)
const fullscreen = ref(false)

const editor = useLayerEditorStage(props.node, {
  onCaptured: (url) => stageStore.setOutputSlot(stageState, 0, url),
  onBatchCaptured: (json) => stageStore.setOutputSlot(stageState, 1, json),
})

function syncOutputSlots(): void {
  const image = readWidgetStr(props.node, 'captured_image', '')
  const images = readWidgetStr(props.node, 'captured_images', '')
  stageStore.setOutputSlot(stageState, 0, image || null)
  stageStore.setOutputSlot(stageState, 1, images || null)
}

onNodeConfigure(props.node, syncOutputSlots)
syncOutputSlots()

async function toggleFullscreen(): Promise<void> {
  fullscreen.value = !fullscreen.value
  await nextTick()
  editor.fitView()
}

const { onKeyDown, onKeyUp } = useLayerEditorHotkeys(editor, {
  setSpaceDown: (v) => canvasEl.value?.setSpaceDown(v),
  isFullscreen: () => fullscreen.value,
  exitFullscreen: () => { void toggleFullscreen() },
})

const iconToolBtnClass =
  'ctv:inline-flex ctv:size-7 ctv:items-center ctv:justify-center ctv:rounded-md ctv:border-0 ' +
  'ctv:bg-transparent ctv:text-muted-foreground ctv:cursor-pointer ctv:transition-colors ' +
  'ctv:hover:bg-secondary-background ctv:hover:text-base-foreground'
</script>
