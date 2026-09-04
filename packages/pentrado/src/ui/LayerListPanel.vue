<template>
  <div
    class="ctv:relative ctv:flex ctv:min-h-0 ctv:shrink-0 ctv:flex-col ctv:gap-1 ctv:min-w-48 ctv:max-w-[55%]"
    :style="{ width: panelWidth + 'px' }"
    @contextmenu.prevent
  >
    <div
      data-pentrado-resize
      class="ctv:absolute ctv:left-0 ctv:top-0 ctv:z-10 ctv:h-full ctv:w-1.5 ctv:cursor-col-resize
             ctv:hover:bg-primary-background/40"
      @pointerdown="onResizeStart"
    />
    <PanelSection :title="$t('pentrado.layers')" storage-key="pentrado.layerPanelCollapsed">
      <template #actions>
        <button
          v-if="assetPicker"
          type="button"
          :class="miniBtnClass"
          :title="$t('pentrado.addFromLibrary')"
          @click.stop="pickerOpen = !pickerOpen"
        >
          <IconImagePlus class="ctv:size-3.5" />
        </button>
        <button
          type="button"
          :class="miniBtnClass"
          :title="$t('pentrado.addFromFile')"
          @click.stop="fileInput?.click()"
        >
          <IconUpload class="ctv:size-3.5" />
        </button>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          multiple
          class="ctv:hidden"
          @change="onFilesPicked"
          @click.stop
        />
      </template>
    <component
      :is="assetPicker"
      v-if="pickerOpen && assetPicker"
      @pick="onMediaPicked"
      @close="pickerOpen = false"
    />

    <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1.5">
      <div
        class="ctv:min-w-0 ctv:flex-1"
        :class="!blendEnabled ? 'ctv:pointer-events-none ctv:opacity-40' : ''"
      >
        <ComfyTVSelect
          :model-value="active?.mode.blend ?? 'normal'"
          :options="blendOptions"
          @update:model-value="(v) => active && editor.setBlendMode(active.id, v as BlendFn)"
        />
      </div>
      <label
        class="ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-1 ctv:text-[10px] ctv:text-[#9b9b9b]"
        :class="!active ? 'ctv:pointer-events-none ctv:opacity-40' : ''"
      >
        {{ $t('pentrado.opacity') }}
        <input
          type="number" min="0" max="100" step="1"
          :class="numInputClass"
          class="ctv:w-11!"
          :value="active ? Math.round(active.opacity * 100) : 100"
          @change="(e) => active && editor.setOpacity(active.id, Math.max(0, Math.min(100, Number((e.target as HTMLInputElement).value))) / 100)"
        />%
      </label>
    </div>

    <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:px-2 ctv:py-1 ctv:text-[10px] ctv:text-[#9b9b9b]">
      <span>{{ $t('pentrado.lockLabel') }}</span>
      <button
        type="button"
        :class="[miniBtnClass, (active as any)?.lockAlpha ? 'ctv:text-[#1473e6]' : '']"
        :disabled="!active || active.kind !== 'raster'"
        :title="$t((active as any)?.lockAlpha ? 'pentrado.unlockAlpha' : 'pentrado.lockAlpha')"
        @click="active && editor.toggleLockAlpha(active.id)"
      >
        <IconDroplet class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="[miniBtnClass, active?.locks.content ? 'ctv:text-[#1473e6]' : '']"
        :disabled="!active"
        :title="$t(active?.locks.content ? 'pentrado.unlockLayer' : 'pentrado.lockLayer')"
        @click="active && editor.toggleLock(active.id)"
      >
        <IconBrush class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="[miniBtnClass, active?.locks.position ? 'ctv:text-[#1473e6]' : '']"
        :disabled="!active"
        :title="$t(active?.locks.position ? 'pentrado.unlockPosition' : 'pentrado.lockPosition')"
        @click="active && editor.toggleLockPosition(active.id)"
      >
        <IconMove class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="[miniBtnClass, active?.locks.content && active?.locks.position ? 'ctv:text-[#1473e6]' : '']"
        :disabled="!active"
        :title="$t(active?.locks.content && active?.locks.position ? 'pentrado.unlockAll' : 'pentrado.lockAll')"
        @click="active && editor.toggleLockAll(active.id)"
      >
        <IconLock class="ctv:size-3.5" />
      </button>
    </div>

    <div
      class="ctv:min-h-16 ctv:flex-1 ctv:overflow-y-auto ctv:border-y ctv:border-[#161616] ctv:bg-[#262626]"
      @dragover="onListDragOver"
      @drop="onListDrop"
    >
      <div
        v-if="displayRows.length === 0"
        class="ctv:py-4 ctv:text-center ctv:text-[10px] ctv:italic ctv:text-[#9b9b9b]/70"
      >
        {{ $t('pentrado.noLayers') }}
      </div>

      <div
        v-for="row in displayRows"
        :key="row.node.id"
        class="ctv:flex ctv:h-10 ctv:cursor-pointer ctv:items-stretch ctv:border-b ctv:border-[#1c1c1c] ctv:transition-colors"
        :class="[
          editor.selectedIds.value.has(row.node.id)
            ? (row.node.id === editor.activeId.value ? 'ctv:bg-[#44546a]' : 'ctv:bg-[#39455a]')
            : 'ctv:hover:bg-[#333333]',
          rowDropClass(row),
          dragId === row.node.id ? 'ctv:opacity-50' : '',
        ]"
        :draggable="renamingId !== row.node.id"
        @click="onRowClick(row.node, $event)"
        @dblclick="renamingId = row.node.id"
        @dragstart="onRowDragStart(row, $event)"
        @dragover="onRowDragOver(row, $event)"
        @drop="onRowDrop(row, $event)"
        @dragend="endDrag"
      >
        <LayerRowBody
          :editor="editor"
          :row="row"
          :collapsed-groups="collapsedGroups"
          :renaming-id="renamingId"
          :draw-thumb="drawThumb"
          :draw-mask-thumb="drawMaskThumb"
          @toggle-collapsed="toggleCollapsed"
          @rename-commit="commitRename"
          @rename-cancel="renamingId = null"
          @row-click="onRowClick"
          @mask-menu="openMaskMenu"
        />
      </div>
    </div>

    <LayerActionsBar v-if="active" :editor="editor" :active="active" />

    <LayerFxPanel v-if="active && fxCapable" :editor="editor" :active="active" />

    <template v-if="active">
      <AdjustmentPropsPanel
        v-if="active.kind === 'adjustment'"
        v-model:curve-channel="curveChannel"
        :editor="editor"
        :active="active"
        :adjust-options="adjustOptions"
        :adjust-param-defs="adjustParamDefs"
      />
      <VectorPropsPanel v-if="active.kind === 'vector'" :active="active as VectorData" :panel="panel" />
      <FillPropsPanel v-if="active.kind === 'fill'" :active="active as FillData" :panel="panel" />
    </template>

    <CanvasSizePanel :editor="editor" :panel="panel" />

    <FilterSessionPanel v-if="editor.filterSession.value" :editor="editor" :session="editor.filterSession.value" />

    <LayerBottomBar :editor="editor" :active="active" :panel="panel" />

    <MaskContextMenu
      v-if="maskMenu && maskMenuNode"
      :editor="editor"
      :menu="maskMenu"
      :node="maskMenuNode"
      @action="maskMenuAction"
    />
    </PanelSection>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import IconBrush from '~icons/lucide/brush'
import IconDroplet from '~icons/lucide/droplet'
import IconImagePlus from '~icons/lucide/image-plus'
import IconLock from '~icons/lucide/lock'
import IconMove from '~icons/lucide/move'
import IconUpload from '~icons/lucide/upload'

import PanelSection from './PanelSection.vue'
import ComfyTVSelect from '../primitives/PSelect.vue'
import AdjustmentPropsPanel from './panels/AdjustmentPropsPanel.vue'
import CanvasSizePanel from './panels/CanvasSizePanel.vue'
import FillPropsPanel from './panels/FillPropsPanel.vue'
import FilterSessionPanel from './panels/FilterSessionPanel.vue'
import LayerActionsBar from './panels/LayerActionsBar.vue'
import LayerBottomBar from './panels/LayerBottomBar.vue'
import LayerFxPanel from './panels/LayerFxPanel.vue'
import LayerRowBody from './panels/LayerRowBody.vue'
import MaskContextMenu from './panels/MaskContextMenu.vue'
import VectorPropsPanel from './panels/VectorPropsPanel.vue'
import { miniBtnClass, numInputClass } from './panels/panelClasses'
import type { LayerEditorController } from './useLayerEditorStage'
import { useLayerListPanel } from './useLayerListPanel'
import type { BlendFn, FillData, SceneNode, VectorData } from '../engine'

const props = defineProps<{
  editor: LayerEditorController
}>()

const editor = props.editor
const assetPicker = editor.host.components.AssetPicker

const PANEL_WIDTH_KEY = 'pentrado.layerPanelWidth'
const PANEL_MIN = 192
const PANEL_MAX = 560
const storedWidth = Number(globalThis.localStorage?.getItem(PANEL_WIDTH_KEY))
const panelWidth = ref(Number.isFinite(storedWidth) && storedWidth >= PANEL_MIN ? Math.min(storedWidth, PANEL_MAX) : 224)

function onResizeStart(e: PointerEvent): void {
  e.preventDefault()
  e.stopPropagation()
  const handle = e.currentTarget as HTMLElement
  const startX = e.clientX
  const startWidth = panelWidth.value
  const scale = (handle.getBoundingClientRect().height / handle.offsetHeight) || 1
  const onMove = (ev: PointerEvent) => {
    panelWidth.value = Math.min(PANEL_MAX, Math.max(PANEL_MIN, startWidth + (startX - ev.clientX) / scale))
  }
  const onUp = () => {
    handle.removeEventListener('pointermove', onMove)
    handle.removeEventListener('pointerup', onUp)
    handle.removeEventListener('pointercancel', onUp)
    try { handle.releasePointerCapture(e.pointerId) } catch {}
    try { globalThis.localStorage?.setItem(PANEL_WIDTH_KEY, String(Math.round(panelWidth.value))) } catch {}
  }
  handle.setPointerCapture(e.pointerId)
  handle.addEventListener('pointermove', onMove)
  handle.addEventListener('pointerup', onUp)
  handle.addEventListener('pointercancel', onUp)
}
const fileInput = ref<HTMLInputElement | null>(null)

const panel = useLayerListPanel(editor)
const {
  pickerOpen,
  renamingId,
  collapsedGroups,
  displayRows,
  active,
  blendOptions,
  adjustOptions,
  adjustParamDefs,
  toggleCollapsed,
  dragId,
  onRowDragStart,
  onRowDragOver,
  onRowDrop,
  onListDragOver,
  onListDrop,
  endDrag,
  rowDropClass,
  onMediaPicked,
  onFilesPicked,
  commitRename,
  drawThumb,
  drawMaskThumb,
} = panel

const blendEnabled = computed(() => !!active.value && active.value.kind !== 'adjustment')

function selectLayer(node: SceneNode, target?: 'content' | 'mask'): void {
  editor.setActiveLayer(node.id)
  if (target) editor.paintTarget.value = target
}

const fxCapable = computed(() =>
  !!active.value && ['raster', 'text', 'vector', 'fill'].includes(active.value.kind)
)

function onRowClick(node: SceneNode, e: MouseEvent): void {
  if (e.shiftKey) {
    const rows = displayRows.value.map((r) => r.node.id)
    const anchor = editor.activeId.value
    const ai = anchor ? rows.indexOf(anchor) : -1
    const ci = rows.indexOf(node.id)
    if (ai >= 0 && ci >= 0 && ai !== ci) {
      const range = ai < ci ? rows.slice(ai, ci + 1) : rows.slice(ci, ai + 1).reverse()
      editor.setSelectedLayers(range)
      return
    }
  }
  if (e.ctrlKey || e.metaKey) {
    const sel = [...editor.selectedIdList.value]
    const at = sel.indexOf(node.id)
    if (at >= 0) sel.splice(at, 1)
    else sel.push(node.id)
    editor.setSelectedLayers(sel)
    return
  }
  selectLayer(node)
}

const curveChannel = ref<'master' | 'red' | 'green' | 'blue'>('master')

const maskMenu = ref<{ nodeId: string; x: number; y: number } | null>(null)

function openMaskMenu(node: SceneNode, e: MouseEvent): void {
  selectLayer(node, 'mask')
  maskMenu.value = { nodeId: node.id, x: e.clientX, y: e.clientY }
}

const maskMenuNode = computed<SceneNode | null>(() => {
  if (!maskMenu.value) return null
  const row = editor.layers.value.find((r) => r.node.id === maskMenu.value!.nodeId)
  return row?.node.mask ? row.node : null
})

function maskMenuAction(fn: (id: string) => void): void {
  const m = maskMenu.value
  maskMenu.value = null
  if (m) fn(m.nodeId)
}

function onGlobalPointerDown(): void {
  maskMenu.value = null
}
onMounted(() => window.addEventListener('pointerdown', onGlobalPointerDown))
onBeforeUnmount(() => window.removeEventListener('pointerdown', onGlobalPointerDown))
</script>
