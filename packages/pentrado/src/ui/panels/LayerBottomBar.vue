<template>
  <div class="ctv:flex ctv:items-center ctv:justify-evenly ctv:border-t ctv:border-[#161616] ctv:bg-[#333333] ctv:px-1 ctv:py-0.5">
    <div class="ctv:relative">
      <button
        v-if="!active?.mask"
        type="button"
        :class="miniBtnClass"
        :disabled="!active || multiSelect"
        :title="$t('pentrado.addMask')"
        @click.stop="addMaskMenuOpen = !addMaskMenuOpen"
        @pointerdown.stop
      >
        <IconCircleDashed class="ctv:size-3.5" />
      </button>
      <button
        v-else
        type="button"
        :class="miniBtnClass"
        :title="$t('pentrado.deleteMask')"
        @click="editor.removeMask(active!.id)"
      >
        <IconCircleOff class="ctv:size-3.5" />
      </button>
      <div
        v-if="addMaskMenuOpen"
        :class="menuPopupClass"
        @pointerdown.stop
      >
        <button type="button" :class="menuItemClass" @click="addMaskWith('white')">
          {{ $t('pentrado.maskInitWhite') }}
        </button>
        <button type="button" :class="menuItemClass" @click="addMaskWith('black')">
          {{ $t('pentrado.maskInitBlack') }}
        </button>
        <button
          type="button"
          :class="menuItemClass"
          :disabled="!editor.hasSelection()"
          @click="addMaskWith('selection')"
        >
          {{ $t('pentrado.maskInitSelection') }}
        </button>
        <template v-if="active?.kind === 'raster'">
          <button type="button" :class="menuItemClass" @click="addMaskWith('alpha')">
            {{ $t('pentrado.maskInitAlpha') }}
          </button>
          <button type="button" :class="menuItemClass" @click="addMaskWith('gray')">
            {{ $t('pentrado.maskInitGray') }}
          </button>
        </template>
      </div>
    </div>
    <div class="ctv:relative">
      <button
        type="button"
        :class="miniBtnClass"
        :disabled="active?.kind !== 'raster' || active?.locks.content"
        :title="$t('pentrado.filters')"
        @click.stop="filterMenuOpen = !filterMenuOpen"
        @pointerdown.stop
      >
        <IconWand class="ctv:size-3.5" />
      </button>
      <div
        v-if="filterMenuOpen"
        :class="menuPopupClass"
        @pointerdown.stop
      >
        <button
          v-for="op in FILTER_OPS"
          :key="op"
          type="button"
          :class="menuItemClass"
          @click="filterMenuOpen = false; editor.startFilter(op)"
        >
          {{ $t(`pentrado.filter_${op}`) }}
        </button>
      </div>
    </div>
    <button
      type="button"
      :class="miniBtnClass"
      :title="$t('pentrado.addAdjustment')"
      @click="editor.addAdjustmentLayer()"
    >
      <IconSlidersHorizontal class="ctv:size-3.5" />
    </button>
    <button
      type="button"
      :class="miniBtnClass"
      :title="$t('pentrado.addFill')"
      @click="editor.addFillLayer()"
    >
      <IconPaintBucket class="ctv:size-3.5" />
    </button>
    <button
      type="button"
      :class="miniBtnClass"
      :title="$t('pentrado.addTextLayer')"
      @click="panel.addText"
    >
      <IconType class="ctv:size-3.5" />
    </button>
    <button
      type="button"
      :class="miniBtnClass"
      :title="$t('pentrado.newLayer')"
      @click="editor.addEmptyLayer()"
    >
      <IconSquarePlus class="ctv:size-3.5" />
    </button>
    <button
      type="button"
      :class="miniBtnClass"
      :disabled="!active"
      :title="$t('pentrado.deleteLayer')"
      @click="active && editor.removeLayer(active.id)"
    >
      <IconTrash class="ctv:size-3.5" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import IconCircleDashed from '~icons/lucide/circle-dashed'
import IconCircleOff from '~icons/lucide/circle-off'
import IconPaintBucket from '~icons/lucide/paint-bucket'
import IconSlidersHorizontal from '~icons/lucide/sliders-horizontal'
import IconSquarePlus from '~icons/lucide/square-plus'
import IconTrash from '~icons/lucide/trash-2'
import IconType from '~icons/lucide/type'
import IconWand from '~icons/lucide/wand'

import type { LayerEditorController, MaskInit } from '../useLayerEditorStage'
import type { useLayerListPanel } from '../useLayerListPanel'
import type { SceneNode } from '../../engine'
import { FILTER_OPS } from '../../filters'
import { menuItemClass, menuPopupClass, miniBtnClass } from './panelClasses'

type PanelApi = ReturnType<typeof useLayerListPanel>

const props = defineProps<{
  editor: LayerEditorController
  active: SceneNode | null
  panel: Pick<PanelApi, 'addText'>
}>()

const editor = props.editor

const multiSelect = computed(() => editor.selectedIds.value.size > 1)

const addMaskMenuOpen = ref(false)
const filterMenuOpen = ref(false)

function addMaskWith(init: MaskInit): void {
  addMaskMenuOpen.value = false
  if (editor.activeId.value) editor.addMask(editor.activeId.value, init)
}

function onGlobalPointerDown(): void {
  addMaskMenuOpen.value = false
  filterMenuOpen.value = false
}
onMounted(() => window.addEventListener('pointerdown', onGlobalPointerDown))
onBeforeUnmount(() => window.removeEventListener('pointerdown', onGlobalPointerDown))
</script>
