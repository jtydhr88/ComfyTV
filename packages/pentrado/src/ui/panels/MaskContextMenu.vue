<template>
  <div
    class="ctv:fixed ctv:z-50 ctv:flex ctv:min-w-36 ctv:flex-col ctv:rounded-md ctv:border ctv:border-[#161616]
           ctv:bg-[#2b2b2b] ctv:py-1 ctv:shadow-lg"
    :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
    @pointerdown.stop
  >
    <button type="button" :class="menuItemClass" @click="emit('action', () => { editor.maskView.value = !editor.maskView.value })">
      {{ $t('pentrado.maskShow') }}
    </button>
    <button type="button" :class="menuItemClass" @click="emit('action', (id) => editor.toggleMaskEnabled(id))">
      {{ $t(node.mask!.enabled ? 'pentrado.maskDisable' : 'pentrado.maskEnable') }}
    </button>
    <button type="button" :class="menuItemClass" @click="emit('action', (id) => editor.invertMask(id))">
      {{ $t('pentrado.maskInvert') }}
    </button>
    <button
      v-if="node.kind === 'raster'"
      type="button"
      :class="menuItemClass"
      @click="emit('action', (id) => editor.applyMask(id))"
    >
      {{ $t('pentrado.maskApply') }}
    </button>
    <button type="button" :class="menuItemClass" @click="emit('action', (id) => editor.maskToSelection(id))">
      {{ $t('pentrado.maskToSelection') }}
    </button>
    <button type="button" :class="menuItemClass" @click="emit('action', (id) => editor.removeMask(id))">
      {{ $t('pentrado.deleteMask') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { LayerEditorController } from '../useLayerEditorStage'
import type { SceneNode } from '../../engine'
import { menuItemClass } from './panelClasses'

defineProps<{
  editor: LayerEditorController
  menu: { nodeId: string; x: number; y: number }
  node: SceneNode
}>()

const emit = defineEmits<{
  (e: 'action', fn: (id: string) => void): void
}>()
</script>
